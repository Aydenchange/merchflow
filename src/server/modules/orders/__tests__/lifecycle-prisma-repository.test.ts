import { describe, expect, it, vi } from "vitest";
import { InvalidOrderTransitionError } from "../errors";
import { createPrismaOrderLifecycleRepository } from "../lifecycle-prisma-repository";

type TransactionClient = {
  order: {
    updateMany: ReturnType<typeof vi.fn>;
    findUniqueOrThrow: ReturnType<typeof vi.fn>;
  };
  payment: {
    update: ReturnType<typeof vi.fn>;
  };
  auditLog: {
    create: ReturnType<typeof vi.fn>;
  };
};

function createTransactionClient(): TransactionClient {
  return {
    order: {
      updateMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    payment: {
      update: vi.fn(),
    },
    auditLog: {
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
  } as unknown as Parameters<typeof createPrismaOrderLifecycleRepository>[0];
}

describe("prisma order lifecycle repository", () => {
  it("finds lifecycle order scoped by organization", async () => {
    const orderFindFirst = vi.fn().mockResolvedValue({
      id: "order_1",
      organizationId: "org_1",
      storeId: "store_1",
      status: "PENDING_PAYMENT",
    });

    const result = await createPrismaOrderLifecycleRepository(
      createDb({ orderFindFirst }),
    ).findOrderForLifecycle({
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
      },
    });
    expect(result).toEqual({
      id: "order_1",
      organizationId: "org_1",
      storeId: "store_1",
      status: "PENDING_PAYMENT",
    });
  });

  it("cancels pending order with guarded transition and writes audit log in one transaction", async () => {
    const tx = createTransactionClient();
    const cancelledAt = new Date("2026-05-27T01:00:00.000Z");
    tx.order.updateMany.mockResolvedValue({ count: 1 });
    tx.order.findUniqueOrThrow.mockResolvedValue({
      id: "order_1",
      organizationId: "org_1",
      storeId: "store_1",
      status: "CANCELLED",
      cancelledAt,
      fulfilledAt: null,
    });
    tx.payment.update.mockResolvedValue({ id: "payment_1" });
    tx.auditLog.create.mockResolvedValue({ id: "audit_1" });

    const result = await createPrismaOrderLifecycleRepository(
      createDb({ tx }),
    ).cancelPendingOrder({
      organizationId: "org_1",
      orderId: "order_1",
      storeId: "store_1",
      actorMembershipId: "membership_1",
      transitionedAt: cancelledAt,
      reason: "Customer changed mind",
    });

    expect(tx.order.updateMany).toHaveBeenCalledWith({
      where: {
        id: "order_1",
        organizationId: "org_1",
        status: "PENDING_PAYMENT",
      },
      data: {
        status: "CANCELLED",
        cancelledAt,
      },
    });
    expect(tx.order.findUniqueOrThrow).toHaveBeenCalledWith({
      where: {
        id_organizationId: {
          id: "order_1",
          organizationId: "org_1",
        },
      },
      select: {
        id: true,
        organizationId: true,
        storeId: true,
        status: true,
        cancelledAt: true,
        fulfilledAt: true,
      },
    });
    expect(tx.payment.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        organizationId: "org_1",
        storeId: "store_1",
        actorMembershipId: "membership_1",
        action: "order.cancelled",
        entityType: "Order",
        entityId: "order_1",
        metadata: {
          cancelledAt: cancelledAt.toISOString(),
          reason: "Customer changed mind",
        },
      },
    });
    expect(result).toEqual({
      orderId: "order_1",
      organizationId: "org_1",
      storeId: "store_1",
      status: "CANCELLED",
      cancelledAt,
      fulfilledAt: null,
    });
  });

  it("fulfills paid order and writes audit log without touching payment", async () => {
    const tx = createTransactionClient();
    const fulfilledAt = new Date("2026-05-27T02:00:00.000Z");
    tx.order.updateMany.mockResolvedValue({ count: 1 });
    tx.order.findUniqueOrThrow.mockResolvedValue({
      id: "order_1",
      organizationId: "org_1",
      storeId: "store_1",
      status: "FULFILLED",
      cancelledAt: null,
      fulfilledAt,
    });
    tx.auditLog.create.mockResolvedValue({ id: "audit_1" });

    const result = await createPrismaOrderLifecycleRepository(
      createDb({ tx }),
    ).fulfillPaidOrder({
      organizationId: "org_1",
      orderId: "order_1",
      storeId: "store_1",
      actorMembershipId: "membership_1",
      transitionedAt: fulfilledAt,
    });

    expect(tx.order.updateMany).toHaveBeenCalledWith({
      where: {
        id: "order_1",
        organizationId: "org_1",
        status: "PAID",
      },
      data: {
        status: "FULFILLED",
        fulfilledAt,
      },
    });
    expect(tx.order.findUniqueOrThrow).toHaveBeenCalledWith({
      where: {
        id_organizationId: {
          id: "order_1",
          organizationId: "org_1",
        },
      },
      select: {
        id: true,
        organizationId: true,
        storeId: true,
        status: true,
        cancelledAt: true,
        fulfilledAt: true,
      },
    });
    expect(tx.payment.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        organizationId: "org_1",
        storeId: "store_1",
        actorMembershipId: "membership_1",
        action: "order.fulfilled",
        entityType: "Order",
        entityId: "order_1",
        metadata: {
          fulfilledAt: fulfilledAt.toISOString(),
        },
      },
    });
    expect(result).toEqual({
      orderId: "order_1",
      organizationId: "org_1",
      storeId: "store_1",
      status: "FULFILLED",
      cancelledAt: null,
      fulfilledAt,
    });
  });

  it("throws when guarded cancel transition does not update one row", async () => {
    const tx = createTransactionClient();
    tx.order.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      createPrismaOrderLifecycleRepository(createDb({ tx })).cancelPendingOrder({
        organizationId: "org_1",
        orderId: "order_1",
        storeId: "store_1",
        actorMembershipId: "membership_1",
        transitionedAt: new Date("2026-05-27T01:00:00.000Z"),
      }),
    ).rejects.toThrow(InvalidOrderTransitionError);

    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });
});
