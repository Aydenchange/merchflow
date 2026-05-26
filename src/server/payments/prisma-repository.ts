import type { Prisma, PrismaClient } from "@prisma/client";
import { PaymentNotFoundError } from "./errors";
import type { PaymentRepository } from "./service";
import type {
  NormalizedPaymentSuccessInput,
  PaymentStockShortage,
  PaymentSuccessResult,
} from "./types";

type PrismaWithPaymentAccess = Pick<PrismaClient, "$transaction">;

type SaleItem = {
  skuId: string;
  quantity: number;
};

export function createPrismaPaymentRepository(
  db: PrismaWithPaymentAccess,
): PaymentRepository {
  return {
    async processPaymentSuccess(input) {
      try {
        return await db.$transaction(async (tx) => {
          const payment = await tx.payment.findFirst({
            where: {
              id: input.paymentId,
              provider: input.provider,
            },
            include: {
              order: {
                include: {
                  items: {
                    select: {
                      skuId: true,
                      quantity: true,
                    },
                  },
                },
              },
            },
          });

          if (!payment) {
            throw new PaymentNotFoundError({
              provider: input.provider,
              paymentId: input.paymentId,
            });
          }

          const event = await tx.paymentEvent.create({
            data: {
              organizationId: payment.organizationId,
              paymentId: payment.id,
              provider: input.provider,
              providerEventId: input.providerEventId,
              eventType: input.eventType,
              payload: input.payload as Prisma.InputJsonObject,
              processingStatus: "PROCESSED",
            },
            select: {
              id: true,
            },
          });

          if (
            payment.status !== "PENDING" ||
            payment.order.status !== "PENDING_PAYMENT"
          ) {
            return markSuccessIgnored(tx, input, payment, event.id);
          }

          const saleItems = aggregateSaleItems(payment.order.items);
          const shortages = await findStockShortages(tx, payment, saleItems);

          if (shortages.length > 0) {
            return markRequiresReview(tx, input, payment, event.id, shortages);
          }

          const deduction = await deductSaleStock(tx, payment, saleItems, input);

          if (deduction.shortages.length > 0) {
            return markRequiresReview(
              tx,
              input,
              payment,
              event.id,
              deduction.shortages,
            );
          }

          await tx.payment.update({
            where: {
              id: payment.id,
            },
            data: {
              status: "SUCCEEDED",
              ...(input.providerPaymentId
                ? { providerPaymentId: input.providerPaymentId }
                : {}),
            },
          });

          await tx.order.update({
            where: {
              id: payment.order.id,
            },
            data: {
              status: "PAID",
              paidAt: input.processedAt,
            },
          });

          await tx.paymentEvent.update({
            where: {
              id: event.id,
            },
            data: {
              processedAt: input.processedAt,
              processingStatus: "PROCESSED",
            },
          });

          await tx.auditLog.create({
            data: {
              organizationId: payment.organizationId,
              storeId: payment.order.storeId,
              actorMembershipId: null,
              action: "payment.succeeded",
              entityType: "Order",
              entityId: payment.order.id,
              metadata: {
                paymentId: payment.id,
                provider: input.provider,
                providerEventId: input.providerEventId,
                stockLedgerIds: deduction.stockLedgerIds,
              },
            },
          });

          return {
            status: "processed",
            providerEventId: input.providerEventId,
            paymentId: payment.id,
            orderId: payment.order.id,
            stockLedgerIds: deduction.stockLedgerIds,
          };
        });
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          return {
            status: "duplicate",
            providerEventId: input.providerEventId,
          };
        }

        throw error;
      }
    },
  };
}

function aggregateSaleItems(items: SaleItem[]): SaleItem[] {
  const saleItems: SaleItem[] = [];
  const itemBySkuId = new Map<string, SaleItem>();

  for (const item of items) {
    const existingItem = itemBySkuId.get(item.skuId);

    if (existingItem) {
      existingItem.quantity += item.quantity;
      continue;
    }

    const saleItem = {
      skuId: item.skuId,
      quantity: item.quantity,
    };

    saleItems.push(saleItem);
    itemBySkuId.set(item.skuId, saleItem);
  }

  return saleItems;
}

async function findStockShortages(
  tx: Prisma.TransactionClient,
  payment: PaymentWithOrder,
  saleItems: SaleItem[],
): Promise<PaymentStockShortage[]> {
  const balances = await tx.inventoryBalance.findMany({
    where: {
      organizationId: payment.organizationId,
      storeId: payment.order.storeId,
      skuId: {
        in: saleItems.map((item) => item.skuId),
      },
    },
    select: {
      skuId: true,
      quantityOnHand: true,
    },
  });
  const balanceBySkuId = new Map(
    balances.map((balance) => [balance.skuId, balance.quantityOnHand]),
  );

  return saleItems.flatMap((item) => {
    const quantityOnHand = balanceBySkuId.get(item.skuId) ?? 0;

    if (quantityOnHand >= item.quantity) {
      return [];
    }

    return [
      {
        skuId: item.skuId,
        requestedQuantity: item.quantity,
        quantityOnHand,
      },
    ];
  });
}

async function deductSaleStock(
  tx: Prisma.TransactionClient,
  payment: PaymentWithOrder,
  saleItems: SaleItem[],
  input: NormalizedPaymentSuccessInput,
) {
  const deductedItems: SaleItem[] = [];

  for (const item of saleItems) {
    const updateResult = await tx.inventoryBalance.updateMany({
      where: {
        organizationId: payment.organizationId,
        storeId: payment.order.storeId,
        skuId: item.skuId,
        quantityOnHand: {
          gte: item.quantity,
        },
      },
      data: {
        quantityOnHand: {
          decrement: item.quantity,
        },
      },
    });

    if (updateResult.count !== 1) {
      await compensateDeductedStock(tx, payment, deductedItems);

      return {
        stockLedgerIds: [],
        shortages: [
          {
            skuId: item.skuId,
            requestedQuantity: item.quantity,
            quantityOnHand: 0,
          },
        ],
      };
    }

    deductedItems.push(item);
  }

  const stockLedgerIds: string[] = [];

  for (const item of saleItems) {
    const ledger = await tx.stockLedger.create({
      data: {
        organizationId: payment.organizationId,
        storeId: payment.order.storeId,
        skuId: item.skuId,
        quantityDelta: -item.quantity,
        reason: "SALE",
        relatedOrderId: payment.order.id,
        actorMembershipId: payment.order.createdByMembershipId,
        note: `Payment success event ${input.providerEventId}`,
      },
      select: {
        id: true,
      },
    });

    stockLedgerIds.push(ledger.id);
  }

  return {
    stockLedgerIds,
    shortages: [],
  };
}

async function compensateDeductedStock(
  tx: Prisma.TransactionClient,
  payment: PaymentWithOrder,
  deductedItems: SaleItem[],
) {
  for (const item of deductedItems) {
    await tx.inventoryBalance.updateMany({
      where: {
        organizationId: payment.organizationId,
        storeId: payment.order.storeId,
        skuId: item.skuId,
      },
      data: {
        quantityOnHand: {
          increment: item.quantity,
        },
      },
    });
  }
}

async function markRequiresReview(
  tx: Prisma.TransactionClient,
  input: NormalizedPaymentSuccessInput,
  payment: PaymentWithOrder,
  eventId: string,
  shortages: PaymentStockShortage[],
): Promise<PaymentSuccessResult> {
  await tx.payment.update({
    where: {
      id: payment.id,
    },
    data: {
      status: "REQUIRES_REVIEW",
      ...(input.providerPaymentId
        ? { providerPaymentId: input.providerPaymentId }
        : {}),
    },
  });

  await tx.order.update({
    where: {
      id: payment.order.id,
    },
    data: {
      status: "PAYMENT_REQUIRES_REVIEW",
    },
  });

  await tx.paymentEvent.update({
    where: {
      id: eventId,
    },
    data: {
      processedAt: input.processedAt,
      processingStatus: "FAILED_REVIEW",
    },
  });

  await tx.auditLog.create({
    data: {
      organizationId: payment.organizationId,
      storeId: payment.order.storeId,
      actorMembershipId: null,
      action: "payment.requires_review",
      entityType: "Order",
      entityId: payment.order.id,
      metadata: {
        paymentId: payment.id,
        provider: input.provider,
        providerEventId: input.providerEventId,
        shortages,
      },
    },
  });

  return {
    status: "requires_review",
    providerEventId: input.providerEventId,
    paymentId: payment.id,
    orderId: payment.order.id,
    shortages,
  };
}

async function markSuccessIgnored(
  tx: Prisma.TransactionClient,
  input: NormalizedPaymentSuccessInput,
  payment: PaymentWithOrder,
  eventId: string,
): Promise<PaymentSuccessResult> {
  const reason = "Payment or order is not pending";

  await tx.paymentEvent.update({
    where: {
      id: eventId,
    },
    data: {
      processedAt: input.processedAt,
      processingStatus: "PROCESSED",
    },
  });

  await tx.auditLog.create({
    data: {
      organizationId: payment.organizationId,
      storeId: payment.order.storeId,
      actorMembershipId: null,
      action: "payment.success_ignored",
      entityType: "Order",
      entityId: payment.order.id,
      metadata: {
        paymentId: payment.id,
        provider: input.provider,
        providerEventId: input.providerEventId,
        reason,
      },
    },
  });

  return {
    status: "ignored",
    providerEventId: input.providerEventId,
    paymentId: payment.id,
    orderId: payment.order.id,
    reason,
  };
}

type PaymentWithOrder = Prisma.PaymentGetPayload<{
  include: {
    order: {
      include: {
        items: {
          select: {
            skuId: true;
            quantity: true;
          };
        };
      };
    };
  };
}>;

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}
