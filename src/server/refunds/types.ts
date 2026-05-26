export type RefundableOrderStatus =
  | "PENDING_PAYMENT"
  | "PAID"
  | "FULFILLED"
  | "CANCELLED"
  | "PAYMENT_FAILED"
  | "REFUNDED"
  | "PAYMENT_REQUIRES_REVIEW";

export type RefundablePaymentStatus =
  | "PENDING"
  | "SUCCEEDED"
  | "FAILED"
  | "REFUNDED"
  | "PARTIALLY_REFUNDED"
  | "REQUIRES_REVIEW";

export type RefundableOrderRecord = {
  id: string;
  organizationId: string;
  storeId: string;
  status: RefundableOrderStatus;
  payment: {
    id: string;
    status: RefundablePaymentStatus;
    amount: number;
    currency: string;
  } | null;
};

export type RecordFullRefundInput = {
  orderId: string;
  reason: string;
  refundedAt?: Date;
};

export type RecordRefundInput = {
  organizationId: string;
  orderId: string;
  storeId: string;
  paymentId: string;
  actorMembershipId: string;
  reason: string;
  refundAmount: number;
  currency: string;
  refundedAt: Date;
};

export type RecordedRefundResult = {
  orderId: string;
  paymentId: string;
  organizationId: string;
  storeId: string;
  orderStatus: "REFUNDED";
  paymentStatus: "REFUNDED";
  refundAmount: number;
  currency: string;
  refundedAt: Date;
};
