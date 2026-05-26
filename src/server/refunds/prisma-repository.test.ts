import { describe, expect, it, vi } from "vitest";
import { createPrismaRefundRepository } from "./prisma-repository";

type TransactionClient = {
  order: {
    update: ReturnType<typeof vi.fn>;
  };
  payment: {
    update: ReturnType<typeof vi.fn>;
  };
  auditLog: {
    create: ReturnType<typeof vi.fn>;
  };
  inventoryBalance: {
    updateMany: ReturnType<typeof vi.fn>;
  };
  stockLedger: {
    create: ReturnType<typeof vi.fn>;
  };
};

function createTransactionClient(): TransactionClient {
  return {
    order: {
      update: vi.fn(),
    },
    payment: {
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    inventoryBalance: {
      updateMany: vi.fn(),
    },
    stockLedger: {
      create: vi.fn(),
    },
  };
}

function createDb(input: {
  tx?: TransactionClient;
  orderFindFirst?: ReturnType<typeof vi.fn>;
}) {
  const tx = input.tx ?? createTransactionClient();

  return {
    order: {
      findFirst: input.orderFindFirst ?? vi.fn(),
    },
    async $transaction<T>(callback: (client: TransactionClient) => Promise<T>) {
      return callback(tx);
    },
  } as unknown as Parameters<typeof createPrismaRefundRepository>[0];
}

describe("prisma refund repository", () => {
  it("finds refundable order scoped by organization", async () => {
    const orderFindFirst = vi.fn().mockResolvedValue({
      id: "order_1",
      organizationId: "org_1",
      storeId: "store_1",
      status: "FULFILLED",
      payment: {
        id: "payment_1",
        status: "SUCCEEDED",
        amount: 6299,
        currency: "SGD",
      },
    });

    const result = await createPrismaRefundRepository(
      createDb({ orderFindFirst }),
    ).findOrderForRefund({
      organizationId: "org_1",
      orderId: "order_1",
    });

    expect(orderFindFirst).toHaveBeenCalledWith({
      where: {
        id: "order_1",
        organizationId: "org_1",
      },
      select: {
        id: true,
        organizationId: true,
        storeId: true,
        status: true,
        payment: {
          select: {
            id: true,
            status: true,
            amount: true,
            currency: true,
          },
        },
      },
    });
    expect(result).toEqual({
      id: "order_1",
      organizationId: "org_1",
      storeId: "store_1",
      status: "FULFILLED",
      payment: {
        id: "payment_1",
        status: "SUCCEEDED",
        amount: 6299,
        currency: "SGD",
      },
    });
  });

  it("records full refund and audit log in one transaction without restocking", async () => {
    const tx = createTransactionClient();
    const refundedAt = new Date("2026-05-27T04:00:00.000Z");
    tx.order.update.mockResolvedValue({
      id: "order_1",
      organizationId: "org_1",
      storeId: "store_1",
      status: "REFUNDED",
      refundedAt,
    });
    tx.payment.update.mockResolvedValue({
      id: "payment_1",
      status: "REFUNDED",
    });
    tx.auditLog.create.mockResolvedValue({ id: "audit_1" });

    const result = await createPrismaRefundRepository(
      createDb({ tx }),
    ).recordFullRefund({
      organizationId: "org_1",
      orderId: "order_1",
      storeId: "store_1",
      paymentId: "payment_1",
      actorMembershipId: "membership_1",
      reason: "Customer returned unopened item",
      refundAmount: 6299,
      currency: "SGD",
      refundedAt,
    });

    expect(tx.order.update).toHaveBeenCalledWith({
      where: {
        id_organizationId: {
          id: "order_1",
          organizationId: "org_1",
        },
      },
      data: {
        status: "REFUNDED",
        refundedAt,
      },
      select: {
        id: true,
        organizationId: true,
        storeId: true,
        status: true,
        refundedAt: true,
      },
    });
    expect(tx.payment.update).toHaveBeenCalledWith({
      where: {
        id: "payment_1",
      },
      data: {
        status: "REFUNDED",
      },
      select: {
        id: true,
        status: true,
      },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        organizationId: "org_1",
        storeId: "store_1",
        actorMembershipId: "membership_1",
        action: "refund.recorded",
        entityType: "Order",
        entityId: "order_1",
        metadata: {
          paymentId: "payment_1",
          refundAmount: 6299,
          currency: "SGD",
          reason: "Customer returned unopened item",
          refundedAt: refundedAt.toISOString(),
          restocked: false,
        },
      },
    });
    expect(tx.inventoryBalance.updateMany).not.toHaveBeenCalled();
    expect(tx.stockLedger.create).not.toHaveBeenCalled();
    expect(result).toEqual({
      orderId: "order_1",
      paymentId: "payment_1",
      organizationId: "org_1",
      storeId: "store_1",
      orderStatus: "REFUNDED",
      paymentStatus: "REFUNDED",
      refundAmount: 6299,
      currency: "SGD",
      refundedAt,
    });
  });
});
