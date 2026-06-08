export class RefundOrderNotFoundError extends Error {
  constructor(orderId: string) {
    super(`Order ${orderId} was not found for refund`);
    this.name = "RefundOrderNotFoundError";
  }
}

export class RefundPaymentNotFoundError extends Error {
  constructor(orderId: string) {
    super(`Order ${orderId} does not have a payment to refund`);
    this.name = "RefundPaymentNotFoundError";
  }
}

export class InvalidRefundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidRefundError";
  }
}
