export type OrderLifecycleStatus =
  | "PENDING_PAYMENT"
  | "PAID"
  | "FULFILLED"
  | "CANCELLED"
  | "PAYMENT_FAILED"
  | "REFUNDED"
  | "PAYMENT_REQUIRES_REVIEW";

export type OrderLifecycleRecord = {
  id: string;
  organizationId: string;
  storeId: string;
  status: OrderLifecycleStatus;
};

export type OrderLifecycleActionInput = {
  orderId: string;
  cancelledAt?: Date;
  fulfilledAt?: Date;
};

export type OrderLifecycleTransitionInput = {
  organizationId: string;
  orderId: string;
  storeId: string;
  actorMembershipId: string;
  transitionedAt: Date;
};

export type OrderLifecycleResult = {
  orderId: string;
  organizationId: string;
  storeId: string;
  status: "CANCELLED" | "FULFILLED";
  cancelledAt: Date | null;
  fulfilledAt: Date | null;
};
