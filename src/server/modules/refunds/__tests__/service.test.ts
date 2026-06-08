import { describe, expect, it } from "vitest";
import type { AuthContext } from "@/server/modules/authz/types";
import {
  InvalidRefundError,
  RefundOrderNotFoundError,
  RefundPaymentNotFoundError,
} from "../errors";
import {
  recordFullRefund,
  type RecordRefundInput,
  type RecordedRefundResult,
  type RefundableOrderRecord,
  type RefundRepository,
} from "../service";

function authContext(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    userId: "user_1",
    membershipId: "membership_1",
    organizationId: "org_1",
    role: "MANAGER",
    status: "ACTIVE",
    assignedStoreIds: ["store_1"],
    ...overrides,
  };
}

function refundableOrder(
  overrides: Partial<RefundableOrderRecord> = {},
): RefundableOrderRecord {
  return {
    id: "order_1",
    organizationId: "org_1",
    storeId: "store_1",
    status: "PAID",
    payment: {
      id: "payment_1",
      status: "SUCCEEDED",
      amount: 6299,
      currency: "SGD",
    },
    ...overrides,
  };
}

function recordedRefundResult(
  overrides: Partial<RecordedRefundResult> = {},
): RecordedRefundResult {
  return {
    orderId: "order_1",
    paymentId: "payment_1",
    organizationId: "org_1",
    storeId: "store_1",
    orderStatus: "REFUNDED",
    paymentStatus: "REFUNDED",
    refundAmount: 6299,
    currency: "SGD",
    refundedAt: new Date("2026-05-27T04:00:00.000Z"),
    ...overrides,
  };
}

function repository(overrides: Partial<RefundRepository> = {}): RefundRepository {
  return {
    async findOrderForRefund() {
      return refundableOrder();
    },
    async recordFullRefund(input) {
      return recordedRefundResult({
        orderId: input.orderId,
        paymentId: input.paymentId,
        organizationId: input.organizationId,
        storeId: input.storeId,
        refundAmount: input.refundAmount,
        currency: input.currency,
        refundedAt: input.refundedAt,
      });
    },
    ...overrides,
  };
}

describe("recordFullRefund", () => {
  it("allows manager to record full refund for assigned paid order", async () => {
    const calls: RecordRefundInput[] = [];
    const refundedAt = new Date("2026-05-27T04:00:00.000Z");

    const result = await recordFullRefund(
      authContext({ role: "MANAGER", assignedStoreIds: ["store_1"] }),
      {
        orderId: "order_1",
        reason: " Customer returned unopened item ",
        refundedAt,
      },
      repository({
        async recordFullRefund(input) {
          calls.push(input);
          return recordedRefundResult({
            refundedAt: input.refundedAt,
          });
        },
      }),
    );

    expect(calls).toEqual([
      {
        organizationId: "org_1",
        orderId: "order_1",
        storeId: "store_1",
        paymentId: "payment_1",
        actorMembershipId: "membership_1",
        reason: "Customer returned unopened item",
        refundAmount: 6299,
        currency: "SGD",
        refundedAt,
      },
    ]);
    expect(result).toEqual(
      recordedRefundResult({
        refundedAt,
      }),
    );
  });

  it("allows owner to refund fulfilled order in any organization store", async () => {
    await expect(
      recordFullRefund(
        authContext({ role: "OWNER", assignedStoreIds: [] }),
        {
          orderId: "order_1",
          reason: "Goodwill refund",
          refundedAt: new Date("2026-05-27T04:00:00.000Z"),
        },
        repository({
          async findOrderForRefund() {
            return refundableOrder({
              storeId: "store_2",
              status: "FULFILLED",
            });
          },
        }),
      ),
    ).resolves.toMatchObject({
      orderStatus: "REFUNDED",
      paymentStatus: "REFUNDED",
      storeId: "store_2",
    });
  });

  it("denies staff refund recording", async () => {
    await expect(
      recordFullRefund(
        authContext({ role: "STAFF" }),
        {
          orderId: "order_1",
          reason: "Customer request",
        },
        repository(),
      ),
    ).rejects.toThrow("Role cannot record refund");
  });

  it("denies manager refund for unassigned store loaded from order", async () => {
    await expect(
      recordFullRefund(
        authContext({ role: "MANAGER", assignedStoreIds: ["store_1"] }),
        {
          orderId: "order_1",
          reason: "Customer request",
        },
        repository({
          async findOrderForRefund() {
            return refundableOrder({ storeId: "store_2" });
          },
        }),
      ),
    ).rejects.toThrow("Store access denied");
  });

  it("rejects missing order", async () => {
    await expect(
      recordFullRefund(
        authContext(),
        {
          orderId: "missing_order",
          reason: "Customer request",
        },
        repository({
          async findOrderForRefund() {
            return null;
          },
        }),
      ),
    ).rejects.toThrow(RefundOrderNotFoundError);
  });

  it("rejects order without payment", async () => {
    await expect(
      recordFullRefund(
        authContext(),
        {
          orderId: "order_1",
          reason: "Customer request",
        },
        repository({
          async findOrderForRefund() {
            return refundableOrder({ payment: null });
          },
        }),
      ),
    ).rejects.toThrow(RefundPaymentNotFoundError);
  });

  it("rejects pending order refund", async () => {
    await expect(
      recordFullRefund(
        authContext(),
        {
          orderId: "order_1",
          reason: "Customer request",
        },
        repository({
          async findOrderForRefund() {
            return refundableOrder({ status: "PENDING_PAYMENT" });
          },
        }),
      ),
    ).rejects.toThrow(InvalidRefundError);
  });

  it("rejects refund when payment is not succeeded", async () => {
    await expect(
      recordFullRefund(
        authContext(),
        {
          orderId: "order_1",
          reason: "Customer request",
        },
        repository({
          async findOrderForRefund() {
            return refundableOrder({
              payment: {
                id: "payment_1",
                status: "PENDING",
                amount: 6299,
                currency: "SGD",
              },
            });
          },
        }),
      ),
    ).rejects.toThrow(InvalidRefundError);
  });

  it("rejects blank refund reason", async () => {
    await expect(
      recordFullRefund(
        authContext(),
        {
          orderId: "order_1",
          reason: "   ",
        },
        repository(),
      ),
    ).rejects.toThrow(InvalidRefundError);
  });
});
