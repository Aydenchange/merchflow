import { InvalidPaymentEventError } from "./errors";
import type {
  NormalizedPaymentSuccessInput,
  PaymentSuccessInput,
  PaymentSuccessResult,
} from "./types";

const DEFAULT_PAYMENT_SUCCESS_EVENT_TYPE = "payment.succeeded";

export type PaymentRepository = {
  processPaymentSuccess(
    input: NormalizedPaymentSuccessInput,
  ): Promise<PaymentSuccessResult>;
};

export type {
  NormalizedPaymentSuccessInput,
  PaymentSuccessResult,
} from "./types";

export async function processPaymentSuccess(
  input: PaymentSuccessInput,
  repository: PaymentRepository,
): Promise<PaymentSuccessResult> {
  const provider = requiredTrimmed(input.provider, "provider");
  const providerEventId = requiredTrimmed(
    input.providerEventId,
    "provider event id",
  );
  const paymentId = requiredTrimmed(input.paymentId, "payment id");
  const eventType =
    input.eventType?.trim() || DEFAULT_PAYMENT_SUCCESS_EVENT_TYPE;
  const providerPaymentId = input.providerPaymentId?.trim() || undefined;

  return repository.processPaymentSuccess({
    provider,
    providerEventId,
    paymentId,
    providerPaymentId,
    eventType,
    payload: input.payload ?? {},
    processedAt: input.processedAt ?? new Date(),
  });
}

function requiredTrimmed(value: string, fieldName: string) {
  const trimmedValue = value.trim();

  if (trimmedValue.length === 0) {
    throw new InvalidPaymentEventError(
      `Payment success event ${fieldName} must not be blank`,
    );
  }

  return trimmedValue;
}
