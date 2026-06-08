import { describe, expect, it } from "vitest";
import type { AuthContext } from "@/server/modules/authz/types";
import {
  InvalidOrderTransitionError,
  OrderNotFoundError,
} from "../errors";
import {
  cancelPendingOrder,
  fulfillPaidOrder,
  type OrderLifecycleRepository,
  type OrderLifecycleTransitionInput,
  type OrderLifecycleRecord,
  type OrderLifecycleResult,
} from "../lifecycle-service";

function authContext(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    userId: "user_1",
    membershipId: "membership_1",
    organizationId: "org_1",
    role: "STAFF",
    status: "ACTIVE",
    assignedStoreIds: ["store_1"],
    ...overrides,
  };
}

function orderRecord(
  overrides: Partial<OrderLifecycleRecord> = {},
): OrderLifecycleRecord {
  return {
    id: "order_1",
    organizationId: "org_1",
    storeId: "store_1",
    status: "PENDING_PAYMENT",
    ...overrides,
  };
}

function lifecycleResult(
  overrides: Partial<OrderLifecycleResult> = {},
): OrderLifecycleResult {
  return {
    orderId: "order_1",
    organizationId: "org_1",
    storeId: "store_1",
    status: "CANCELLED",
    cancelledAt: new Date("2026-05-27T01:00:00.000Z"),
    fulfilledAt: null,
    ...overrides,
  };
}

function repository(
  overrides: Partial<OrderLifecycleRepository> = {},
): OrderLifecycleRepository {
  return {
    async findOrderForLifecycle() {
      return orderRecord();
    },
    async cancelPendingOrder(input) {
      return lifecycleResult({
        orderId: input.orderId,
        organizationId: input.organizationId,
        storeId: input.storeId,
        status: "CANCELLED",
        cancelledAt: input.transitionedAt,
        fulfilledAt: null,
      });
    },
    async fulfillPaidOrder(input) {
      return lifecycleResult({
        orderId: input.orderId,
        organizationId: input.organizationId,
        storeId: input.storeId,
        status: "FULFILLED",
        cancelledAt: null,
        fulfilledAt: input.transitionedAt,
      });
    },
    ...overrides,
  };
}

describe("order lifecycle service", () => {
  it("cancels pending order for an assigned store", async () => {
    const calls: OrderLifecycleTransitionInput[] = [];
    const cancelledAt = new Date("2026-05-27T01:00:00.000Z");

    const result = await cancelPendingOrder(
      authContext({ role: "STAFF", assignedStoreIds: ["store_1"] }),
      {
        orderId: "order_1",
        cancelledAt,
      },
      repository({
        async cancelPendingOrder(input) {
          calls.push(input);
          return lifecycleResult({
            cancelledAt: input.transitionedAt,
          });
        },
      }),
    );

    expect(calls).toEqual([
      {
        organizationId: "org_1",
        orderId: "order_1",
        storeId: "store_1",
        actorMembershipId: "membership_1",
        transitionedAt: cancelledAt,
      },
    ]);
    expect(result).toEqual(
      lifecycleResult({
        cancelledAt,
      }),
    );
  });

  it("trims cancellation reason before passing it to repository", async () => {
    const calls: OrderLifecycleTransitionInput[] = [];

    await cancelPendingOrder(
      authContext(),
      {
        orderId: "order_1",
        reason: " Customer changed mind ",
      },
      repository({
        async cancelPendingOrder(input) {
          calls.push(input);
          return lifecycleResult({
            cancelledAt: input.transitionedAt,
          });
        },
      }),
    );

    expect(calls[0]).toMatchObject({
      reason: "Customer changed mind",
    });
  });

  it("omits blank cancellation reason", async () => {
    const calls: OrderLifecycleTransitionInput[] = [];

    await cancelPendingOrder(
      authContext(),
      {
        orderId: "order_1",
        reason: "   ",
      },
      repository({
        async cancelPendingOrder(input) {
          calls.push(input);
          return lifecycleResult({
            cancelledAt: input.transitionedAt,
          });
        },
      }),
    );

    expect(calls[0]).not.toHaveProperty("reason");
  });

  it("denies cancellation for unassigned store loaded from order", async () => {
    await expect(
      cancelPendingOrder(
        authContext({ role: "STAFF", assignedStoreIds: ["store_1"] }),
        {
          orderId: "order_1",
        },
        repository({
          async findOrderForLifecycle() {
            return orderRecord({ storeId: "store_2" });
          },
        }),
      ),
    ).rejects.toThrow("Store access denied");
  });

  it("rejects cancellation when order is missing", async () => {
    await expect(
      cancelPendingOrder(
        authContext(),
        {
          orderId: "missing_order",
        },
        repository({
          async findOrderForLifecycle() {
            return null;
          },
        }),
      ),
    ).rejects.toThrow(OrderNotFoundError);
  });

  it("rejects cancellation when order is already paid", async () => {
    await expect(
      cancelPendingOrder(
        authContext(),
        {
          orderId: "order_1",
        },
        repository({
          async findOrderForLifecycle() {
            return orderRecord({ status: "PAID" });
          },
        }),
      ),
    ).rejects.toThrow(InvalidOrderTransitionError);
  });

  it("fulfills paid order for an assigned store", async () => {
    const calls: OrderLifecycleTransitionInput[] = [];
    const fulfilledAt = new Date("2026-05-27T02:00:00.000Z");

    const result = await fulfillPaidOrder(
      authContext({ role: "STAFF", assignedStoreIds: ["store_1"] }),
      {
        orderId: "order_1",
        fulfilledAt,
      },
      repository({
        async findOrderForLifecycle() {
          return orderRecord({ status: "PAID" });
        },
        async fulfillPaidOrder(input) {
          calls.push(input);
          return lifecycleResult({
            status: "FULFILLED",
            cancelledAt: null,
            fulfilledAt: input.transitionedAt,
          });
        },
      }),
    );

    expect(calls).toEqual([
      {
        organizationId: "org_1",
        orderId: "order_1",
        storeId: "store_1",
        actorMembershipId: "membership_1",
        transitionedAt: fulfilledAt,
      },
    ]);
    expect(result).toEqual(
      lifecycleResult({
        status: "FULFILLED",
        cancelledAt: null,
        fulfilledAt,
      }),
    );
  });

  it("rejects fulfillment when order is still pending payment", async () => {
    await expect(
      fulfillPaidOrder(
        authContext(),
        {
          orderId: "order_1",
        },
        repository(),
      ),
    ).rejects.toThrow(InvalidOrderTransitionError);
  });

  it("allows owner to fulfill any organization order", async () => {
    await expect(
      fulfillPaidOrder(
        authContext({ role: "OWNER", assignedStoreIds: [] }),
        {
          orderId: "order_1",
          fulfilledAt: new Date("2026-05-27T02:00:00.000Z"),
        },
        repository({
          async findOrderForLifecycle() {
            return orderRecord({ storeId: "store_2", status: "PAID" });
          },
        }),
      ),
    ).resolves.toMatchObject({
      status: "FULFILLED",
      storeId: "store_2",
    });
  });

  it("rejects disabled membership before lifecycle transition", async () => {
    await expect(
      fulfillPaidOrder(
        authContext({ status: "DISABLED" }),
        {
          orderId: "order_1",
        },
        repository({
          async findOrderForLifecycle() {
            return orderRecord({ status: "PAID" });
          },
        }),
      ),
    ).rejects.toThrow("Membership is not active");
  });
});
