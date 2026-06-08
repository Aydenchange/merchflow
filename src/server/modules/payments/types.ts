export type PaymentEventPayload = Record<string, unknown>;

export type PaymentSuccessInput = {
  provider: string;
  providerEventId: string;
  paymentId: string;
  providerPaymentId?: string;
  eventType?: string;
  payload?: PaymentEventPayload;
  processedAt?: Date;
};

export type NormalizedPaymentSuccessInput = {
  provider: string;
  providerEventId: string;
  paymentId: string;
  providerPaymentId?: string;
  eventType: string;
  payload: PaymentEventPayload;
  processedAt: Date;
};

export type PaymentStockShortage = {
  skuId: string;
  requestedQuantity: number;
  quantityOnHand: number;
};

export type ProcessedPaymentSuccessResult = {
  status: "processed";
  providerEventId: string;
  paymentId: string;
  orderId: string;
  stockLedgerIds: string[];
};

export type DuplicatePaymentEventResult = {
  status: "duplicate";
  providerEventId: string;
};

export type PaymentRequiresReviewResult = {
  status: "requires_review";
  providerEventId: string;
  paymentId: string;
  orderId: string;
  shortages: PaymentStockShortage[];
};

export type IgnoredPaymentSuccessResult = {
  status: "ignored";
  providerEventId: string;
  paymentId: string;
  orderId: string;
  reason: string;
};

export type PaymentSuccessResult =
  | ProcessedPaymentSuccessResult
  | DuplicatePaymentEventResult
  | PaymentRequiresReviewResult
  | IgnoredPaymentSuccessResult;
