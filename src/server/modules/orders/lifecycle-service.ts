import { assertCanCreateSale } from "../authz/policy";
import type { AuthContext } from "../authz/types";
import {
  InvalidOrderTransitionError,
  OrderNotFoundError,
} from "./errors";
import type {
  OrderLifecycleActionInput,
  OrderLifecycleRecord,
  OrderLifecycleResult,
  OrderLifecycleTransitionInput,
} from "./lifecycle-types";

export type OrderLifecycleRepository = {
  findOrderForLifecycle(input: {
    organizationId: string;
    orderId: string;
  }): Promise<OrderLifecycleRecord | null>;
  cancelPendingOrder(
    input: OrderLifecycleTransitionInput,
  ): Promise<OrderLifecycleResult>;
  fulfillPaidOrder(
    input: OrderLifecycleTransitionInput,
  ): Promise<OrderLifecycleResult>;
};

export type {
  OrderLifecycleRecord,
  OrderLifecycleResult,
  OrderLifecycleTransitionInput,
} from "./lifecycle-types";

export async function cancelPendingOrder(
  context: AuthContext,
  input: Pick<OrderLifecycleActionInput, "orderId" | "cancelledAt" | "reason">,
  repository: OrderLifecycleRepository,
): Promise<OrderLifecycleResult> {
  const order = await loadAuthorizedOrder(context, input.orderId, repository);

  if (order.status !== "PENDING_PAYMENT") {
    throw new InvalidOrderTransitionError({
      orderId: order.id,
      currentStatus: order.status,
      expectedStatus: "PENDING_PAYMENT",
      targetStatus: "CANCELLED",
    });
  }

  const reason = input.reason?.trim();

  return repository.cancelPendingOrder({
    organizationId: context.organizationId,
    orderId: order.id,
    storeId: order.storeId,
    actorMembershipId: context.membershipId,
    transitionedAt: input.cancelledAt ?? new Date(),
    ...(reason ? { reason } : {}),
  });
}

export async function fulfillPaidOrder(
  context: AuthContext,
  input: Pick<OrderLifecycleActionInput, "orderId" | "fulfilledAt">,
  repository: OrderLifecycleRepository,
): Promise<OrderLifecycleResult> {
  const order = await loadAuthorizedOrder(context, input.orderId, repository);

  if (order.status !== "PAID") {
    throw new InvalidOrderTransitionError({
      orderId: order.id,
      currentStatus: order.status,
      expectedStatus: "PAID",
      targetStatus: "FULFILLED",
    });
  }

  return repository.fulfillPaidOrder({
    organizationId: context.organizationId,
    orderId: order.id,
    storeId: order.storeId,
    actorMembershipId: context.membershipId,
    transitionedAt: input.fulfilledAt ?? new Date(),
  });
}

async function loadAuthorizedOrder(
  context: AuthContext,
  orderId: string,
  repository: OrderLifecycleRepository,
) {
  const order = await repository.findOrderForLifecycle({
    organizationId: context.organizationId,
    orderId,
  });

  if (!order) {
    throw new OrderNotFoundError(orderId);
  }

  assertCanCreateSale(context, order.storeId);

  return order;
}
