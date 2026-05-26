export class InvalidPaymentEventError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidPaymentEventError";
  }
}

export class PaymentNotFoundError extends Error {
  constructor(input: { provider: string; paymentId: string }) {
    super(`Payment ${input.paymentId} was not found for provider ${input.provider}`);
    this.name = "PaymentNotFoundError";
  }
}
