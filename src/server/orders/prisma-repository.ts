import type { PrismaClient } from "@prisma/client";
import type { OrderRepository } from "./service";

type PrismaWithOrderAccess = Pick<
  PrismaClient,
  "$transaction" | "sku" | "store"
>;

export function createPrismaOrderRepository(
  db: PrismaWithOrderAccess,
): OrderRepository {
  return {
    async getOrderCreationContext(input) {
      const store = await db.store.findFirst({
        where: {
          id: input.storeId,
          organizationId: input.organizationId,
          status: "ACTIVE",
        },
        select: {
          organization: {
            select: {
              currency: true,
            },
          },
        },
      });

      if (!store) {
        return null;
      }

      const skus = await db.sku.findMany({
        where: {
          organizationId: input.organizationId,
          id: {
            in: input.skuIds,
          },
        },
        select: {
          id: true,
          name: true,
          barcode: true,
          priceAmount: true,
          status: true,
          inventoryBalances: {
            where: {
              organizationId: input.organizationId,
              storeId: input.storeId,
            },
            select: {
              quantityOnHand: true,
            },
            take: 1,
          },
        },
      });

      return {
        currency: store.organization.currency,
        skus: skus.map((sku) => ({
          id: sku.id,
          name: sku.name,
          barcode: sku.barcode,
          priceAmount: sku.priceAmount,
          status: sku.status,
          inventoryBalance: sku.inventoryBalances[0] ?? null,
        })),
      };
    },

    async createPendingOrder(input) {
      return db.$transaction(async (tx) => {
        const order = await tx.order.create({
          data: {
            organizationId: input.organizationId,
            storeId: input.storeId,
            customerId: input.customerId,
            createdByMembershipId: input.createdByMembershipId,
            status: "PENDING_PAYMENT",
            subtotalAmount: input.subtotalAmount,
            taxAmount: input.taxAmount,
            totalAmount: input.totalAmount,
            currency: input.currency,
            items: {
              create: input.items.map((item) => ({
                organizationId: input.organizationId,
                skuId: item.skuId,
                skuNameSnapshot: item.skuNameSnapshot,
                barcodeSnapshot: item.barcodeSnapshot,
                unitPriceAmount: item.unitPriceAmount,
                quantity: item.quantity,
                lineTotalAmount: item.lineTotalAmount,
              })),
            },
            payment: {
              create: {
                organizationId: input.organizationId,
                provider: input.paymentProvider,
                status: "PENDING",
                amount: input.totalAmount,
                currency: input.currency,
              },
            },
          },
          include: {
            items: {
              select: {
                id: true,
                skuId: true,
                skuNameSnapshot: true,
                barcodeSnapshot: true,
                unitPriceAmount: true,
                quantity: true,
                lineTotalAmount: true,
              },
            },
            payment: {
              select: {
                id: true,
              },
            },
          },
        });

        if (!order.payment) {
          throw new Error("Payment creation failed");
        }

        await tx.auditLog.create({
          data: {
            organizationId: input.organizationId,
            storeId: input.storeId,
            actorMembershipId: input.createdByMembershipId,
            action: "order.created",
            entityType: "Order",
            entityId: order.id,
            metadata: {
              paymentId: order.payment.id,
              totalAmount: input.totalAmount,
              itemCount: input.items.length,
            },
          },
        });

        return {
          orderId: order.id,
          paymentId: order.payment.id,
          organizationId: order.organizationId,
          storeId: order.storeId,
          status: "PENDING_PAYMENT",
          paymentStatus: "PENDING",
          subtotalAmount: order.subtotalAmount,
          taxAmount: order.taxAmount,
          totalAmount: order.totalAmount,
          currency: order.currency,
          items: order.items,
        };
      });
    },
  };
}
