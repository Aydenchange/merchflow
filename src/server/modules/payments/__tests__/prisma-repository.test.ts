import { describe, expect, it, vi } from "vitest";
import { createPrismaPaymentRepository } from "../prisma-repository";
import type { NormalizedPaymentSuccessInput } from "../service";

type TransactionClient = {
  payment: {
    findFirst: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  paymentEvent: {
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  inventoryBalance: {
    findMany: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
  stockLedger: {
    create: ReturnType<typeof vi.fn>;
  };
  order: {
    update: ReturnType<typeof vi.fn>;
  };
  auditLog: {
    create: ReturnType<typeof vi.fn>;
  };
};

function createTransactionClient(): TransactionClient {
  return {
    payment: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    paymentEvent: {
      create: vi.fn(),
      update: vi.fn(),
    },
    inventoryBalance: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    stockLedger: {
      create: vi.fn(),
    },
    order: {
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  };
}

function createDb(tx: TransactionClient) {
  return {
    async $transaction<T>(callback: (client: TransactionClient) => Promise<T>) {
      return callback(tx);
    },
  } as unknown as Parameters<typeof createPrismaPaymentRepository>[0];
}

function successInput(
  overrides: Partial<NormalizedPaymentSuccessInput> = {},
): NormalizedPaymentSuccessInput {
  return {
    provider: "simulated_pos",
    providerEventId: "evt_1",
    paymentId: "payment_1",
    providerPaymentId: "provider_payment_1",
    eventType: "payment.succeeded",
    payload: { type: "payment.succeeded" },
    processedAt: new Date("2026-05-26T12:00:00.000Z"),
    ...overrides,
  };
}

function paymentRecord(overrides = {}) {
  return {
    id: "payment_1",
    organizationId: "org_1",
    provider: "simulated_pos",
    providerPaymentId: null,
    status: "PENDING",
    order: {
      id: "order_1",
      organizationId: "org_1",
      storeId: "store_1",
      status: "PENDING_PAYMENT",
      createdByMembershipId: "membership_1",
      items: [
        {
          skuId: "sku_1",
          quantity: 2,
        },
      ],
    },
    ...overrides,
  };
}

describe("prisma payment repository", () => {
  it("processes payment success once and deducts sale stock", async () => {
    const tx = createTransactionClient();
    tx.payment.findFirst.mockResolvedValue(paymentRecord());
    tx.paymentEvent.create.mockResolvedValue({ id: "event_1" });
    tx.inventoryBalance.findMany.mockResolvedValue([
      {
        skuId: "sku_1",
        quantityOnHand: 8,
      },
    ]);
    tx.inventoryBalance.updateMany.mockResolvedValue({ count: 1 });
    tx.stockLedger.create.mockResolvedValue({ id: "ledger_1" });
    tx.payment.update.mockResolvedValue({});
    tx.order.update.mockResolvedValue({});
    tx.paymentEvent.update.mockResolvedValue({});
    tx.auditLog.create.mockResolvedValue({});

    const result = await createPrismaPaymentRepository(
      createDb(tx),
    ).processPaymentSuccess(successInput());

    expect(tx.payment.findFirst).toHaveBeenCalledWith({
      where: {
        id: "payment_1",
        provider: "simulated_pos",
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
    expect(tx.paymentEvent.create).toHaveBeenCalledWith({
      data: {
        organizationId: "org_1",
        paymentId: "payment_1",
        provider: "simulated_pos",
        providerEventId: "evt_1",
        eventType: "payment.succeeded",
        payload: { type: "payment.succeeded" },
        processingStatus: "PROCESSED",
      },
      select: {
        id: true,
      },
    });
    expect(tx.inventoryBalance.updateMany).toHaveBeenCalledWith({
      where: {
        organizationId: "org_1",
        storeId: "store_1",
        skuId: "sku_1",
        quantityOnHand: {
          gte: 2,
        },
      },
      data: {
        quantityOnHand: {
          decrement: 2,
        },
      },
    });
    expect(tx.stockLedger.create).toHaveBeenCalledWith({
      data: {
        organizationId: "org_1",
        storeId: "store_1",
        skuId: "sku_1",
        quantityDelta: -2,
        reason: "SALE",
        relatedOrderId: "order_1",
        actorMembershipId: "membership_1",
        note: "Payment success event evt_1",
      },
      select: {
        id: true,
      },
    });
    expect(tx.payment.update).toHaveBeenCalledWith({
      where: {
        id: "payment_1",
      },
      data: {
        status: "SUCCEEDED",
        providerPaymentId: "provider_payment_1",
      },
    });
    expect(tx.order.update).toHaveBeenCalledWith({
      where: {
        id: "order_1",
      },
      data: {
        status: "PAID",
        paidAt: new Date("2026-05-26T12:00:00.000Z"),
      },
    });
    expect(tx.paymentEvent.update).toHaveBeenCalledWith({
      where: {
        id: "event_1",
      },
      data: {
        processedAt: new Date("2026-05-26T12:00:00.000Z"),
        processingStatus: "PROCESSED",
      },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        organizationId: "org_1",
        storeId: "store_1",
        actorMembershipId: null,
        action: "payment.succeeded",
        entityType: "Order",
        entityId: "order_1",
        metadata: {
          paymentId: "payment_1",
          provider: "simulated_pos",
          providerEventId: "evt_1",
          stockLedgerIds: ["ledger_1"],
        },
      },
    });
    expect(result).toEqual({
      status: "processed",
      providerEventId: "evt_1",
      paymentId: "payment_1",
      orderId: "order_1",
      stockLedgerIds: ["ledger_1"],
    });
  });

  it("returns duplicate result when provider event id was already claimed", async () => {
    const tx = createTransactionClient();
    tx.payment.findFirst.mockResolvedValue(paymentRecord());
    tx.paymentEvent.create.mockRejectedValue({ code: "P2002" });

    const result = await createPrismaPaymentRepository(
      createDb(tx),
    ).processPaymentSuccess(successInput());

    expect(result).toEqual({
      status: "duplicate",
      providerEventId: "evt_1",
    });
    expect(tx.inventoryBalance.updateMany).not.toHaveBeenCalled();
    expect(tx.stockLedger.create).not.toHaveBeenCalled();
  });

  it("moves payment and order to review when stock is insufficient", async () => {
    const tx = createTransactionClient();
    tx.payment.findFirst.mockResolvedValue(paymentRecord());
    tx.paymentEvent.create.mockResolvedValue({ id: "event_1" });
    tx.inventoryBalance.findMany.mockResolvedValue([
      {
        skuId: "sku_1",
        quantityOnHand: 1,
      },
    ]);
    tx.payment.update.mockResolvedValue({});
    tx.order.update.mockResolvedValue({});
    tx.paymentEvent.update.mockResolvedValue({});
    tx.auditLog.create.mockResolvedValue({});

    const result = await createPrismaPaymentRepository(
      createDb(tx),
    ).processPaymentSuccess(successInput());

    expect(tx.inventoryBalance.updateMany).not.toHaveBeenCalled();
    expect(tx.stockLedger.create).not.toHaveBeenCalled();
    expect(tx.payment.update).toHaveBeenCalledWith({
      where: {
        id: "payment_1",
      },
      data: {
        status: "REQUIRES_REVIEW",
        providerPaymentId: "provider_payment_1",
      },
    });
    expect(tx.order.update).toHaveBeenCalledWith({
      where: {
        id: "order_1",
      },
      data: {
        status: "PAYMENT_REQUIRES_REVIEW",
      },
    });
    expect(tx.paymentEvent.update).toHaveBeenCalledWith({
      where: {
        id: "event_1",
      },
      data: {
        processedAt: new Date("2026-05-26T12:00:00.000Z"),
        processingStatus: "FAILED_REVIEW",
      },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        organizationId: "org_1",
        storeId: "store_1",
        actorMembershipId: null,
        action: "payment.requires_review",
        entityType: "Order",
        entityId: "order_1",
        metadata: {
          paymentId: "payment_1",
          provider: "simulated_pos",
          providerEventId: "evt_1",
          shortages: [
            {
              skuId: "sku_1",
              requestedQuantity: 2,
              quantityOnHand: 1,
            },
          ],
        },
      },
    });
    expect(result).toEqual({
      status: "requires_review",
      providerEventId: "evt_1",
      paymentId: "payment_1",
      orderId: "order_1",
      shortages: [
        {
          skuId: "sku_1",
          requestedQuantity: 2,
          quantityOnHand: 1,
        },
      ],
    });
  });

  it("records and ignores success event for non-pending payment state", async () => {
    const tx = createTransactionClient();
    tx.payment.findFirst.mockResolvedValue(
      paymentRecord({
        status: "SUCCEEDED",
        order: {
          id: "order_1",
          organizationId: "org_1",
          storeId: "store_1",
          status: "PAID",
          createdByMembershipId: "membership_1",
          items: [{ skuId: "sku_1", quantity: 2 }],
        },
      }),
    );
    tx.paymentEvent.create.mockResolvedValue({ id: "event_1" });
    tx.paymentEvent.update.mockResolvedValue({});
    tx.auditLog.create.mockResolvedValue({});

    const result = await createPrismaPaymentRepository(
      createDb(tx),
    ).processPaymentSuccess(successInput());

    expect(tx.inventoryBalance.updateMany).not.toHaveBeenCalled();
    expect(tx.stockLedger.create).not.toHaveBeenCalled();
    expect(tx.paymentEvent.update).toHaveBeenCalledWith({
      where: {
        id: "event_1",
      },
      data: {
        processedAt: new Date("2026-05-26T12:00:00.000Z"),
        processingStatus: "PROCESSED",
      },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        organizationId: "org_1",
        storeId: "store_1",
        actorMembershipId: null,
        action: "payment.success_ignored",
        entityType: "Order",
        entityId: "order_1",
        metadata: {
          paymentId: "payment_1",
          provider: "simulated_pos",
          providerEventId: "evt_1",
          reason: "Payment or order is not pending",
        },
      },
    });
    expect(result).toEqual({
      status: "ignored",
      providerEventId: "evt_1",
      paymentId: "payment_1",
      orderId: "order_1",
      reason: "Payment or order is not pending",
    });
  });
});
