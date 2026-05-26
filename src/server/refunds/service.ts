import { assertCanRecordRefund } from "../authz/policy";
import type { AuthContext } from "../authz/types";
import {
  InvalidRefundError,
  RefundOrderNotFoundError,
  RefundPaymentNotFoundError,
} from "./errors";
import type {
  RecordFullRefundInput,
  RecordedRefundResult,
  RecordRefundInput,
  RefundableOrderRecord,
} from "./types";

export type RefundRepository = {
  findOrderForRefund(input: {
    organizationId: string;
    orderId: string;
  }): Promise<RefundableOrderRecord | null>;
  recordFullRefund(input: RecordRefundInput): Promise<RecordedRefundResult>;
};

export type {
  RecordedRefundResult,
  RecordRefundInput,
  RefundableOrderRecord,
} from "./types";

export async function recordFullRefund(
  context: AuthContext,
  input: RecordFullRefundInput,
  repository: RefundRepository,
): Promise<RecordedRefundResult> {
  const reason = input.reason.trim();

  if (reason.length === 0) {
    throw new InvalidRefundError("Refund reason must not be blank");
  }

  const order = await repository.findOrderForRefund({
    organizationId: context.organizationId,
    orderId: input.orderId,
  });

  if (!order) {
    throw new RefundOrderNotFoundError(input.orderId);
  }

  assertCanRecordRefund(context, order.storeId);

  if (order.status !== "PAID" && order.status !== "FULFILLED") {
    throw new InvalidRefundError(
      `Order ${order.id} cannot be refunded from status ${order.status}`,
    );
  }

  if (!order.payment) {
    throw new RefundPaymentNotFoundError(order.id);
  }

  if (order.payment.status !== "SUCCEEDED") {
    throw new InvalidRefundError(
      `Payment ${order.payment.id} cannot be refunded from status ${order.payment.status}`,
    );
  }

  return repository.recordFullRefund({
    organizationId: context.organizationId,
    orderId: order.id,
    storeId: order.storeId,
    paymentId: order.payment.id,
    actorMembershipId: context.membershipId,
    reason,
    refundAmount: order.payment.amount,
    currency: order.payment.currency,
    refundedAt: input.refundedAt ?? new Date(),
  });
}
