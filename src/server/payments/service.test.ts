import { describe, expect, it } from "vitest";
import { InvalidPaymentEventError } from "./errors";
import {
  processPaymentSuccess,
  type NormalizedPaymentSuccessInput,
  type PaymentRepository,
  type PaymentSuccessResult,
} from "./service";

function processedResult(
  overrides: Partial<Extract<PaymentSuccessResult, { status: "processed" }>> = {},
): PaymentSuccessResult {
  return {
    status: "processed",
    providerEventId: "evt_1",
    paymentId: "payment_1",
    orderId: "order_1",
    stockLedgerIds: ["ledger_1"],
    ...overrides,
  };
}

function repository(
  overrides: Partial<PaymentRepository> = {},
): PaymentRepository {
  return {
    async processPaymentSuccess() {
      return processedResult();
    },
    ...overrides,
  };
}

describe("processPaymentSuccess", () => {
  it("normalizes provider success event input before processing", async () => {
    const calls: NormalizedPaymentSuccessInput[] = [];
    const processedAt = new Date("2026-05-26T12:00:00.000Z");

    await processPaymentSuccess(
      {
        provider: " simulated_pos ",
        providerEventId: " evt_1 ",
        paymentId: " payment_1 ",
        providerPaymentId: " provider_payment_1 ",
        payload: { type: "payment.succeeded" },
        processedAt,
      },
      repository({
        async processPaymentSuccess(input) {
          calls.push(input);
          return processedResult();
        },
      }),
    );

    expect(calls).toEqual([
      {
        provider: "simulated_pos",
        providerEventId: "evt_1",
        paymentId: "payment_1",
        providerPaymentId: "provider_payment_1",
        eventType: "payment.succeeded",
        payload: { type: "payment.succeeded" },
        processedAt,
      },
    ]);
  });

  it("uses explicit event type when provided", async () => {
    const calls: NormalizedPaymentSuccessInput[] = [];
    const processedAt = new Date("2026-05-26T12:00:00.000Z");

    await processPaymentSuccess(
      {
        provider: "simulated_pos",
        providerEventId: "evt_1",
        paymentId: "payment_1",
        eventType: "checkout.session.completed",
        processedAt,
      },
      repository({
        async processPaymentSuccess(input) {
          calls.push(input);
          return processedResult();
        },
      }),
    );

    expect(calls[0]).toMatchObject({
      eventType: "checkout.session.completed",
      payload: {},
    });
  });

  it("rejects blank provider", async () => {
    await expect(
      processPaymentSuccess(
        {
          provider: " ",
          providerEventId: "evt_1",
          paymentId: "payment_1",
        },
        repository(),
      ),
    ).rejects.toThrow(InvalidPaymentEventError);
  });

  it("rejects blank provider event id", async () => {
    await expect(
      processPaymentSuccess(
        {
          provider: "simulated_pos",
          providerEventId: " ",
          paymentId: "payment_1",
        },
        repository(),
      ),
    ).rejects.toThrow(InvalidPaymentEventError);
  });

  it("rejects blank payment id", async () => {
    await expect(
      processPaymentSuccess(
        {
          provider: "simulated_pos",
          providerEventId: "evt_1",
          paymentId: " ",
        },
        repository(),
      ),
    ).rejects.toThrow(InvalidPaymentEventError);
  });

  it("propagates duplicate provider event result", async () => {
    await expect(
      processPaymentSuccess(
        {
          provider: "simulated_pos",
          providerEventId: "evt_1",
          paymentId: "payment_1",
        },
        repository({
          async processPaymentSuccess() {
            return {
              status: "duplicate",
              providerEventId: "evt_1",
            };
          },
        }),
      ),
    ).resolves.toEqual({
      status: "duplicate",
      providerEventId: "evt_1",
    });
  });

  it("propagates requires-review result", async () => {
    await expect(
      processPaymentSuccess(
        {
          provider: "simulated_pos",
          providerEventId: "evt_1",
          paymentId: "payment_1",
        },
        repository({
          async processPaymentSuccess() {
            return {
              status: "requires_review",
              providerEventId: "evt_1",
              paymentId: "payment_1",
              orderId: "order_1",
              shortages: [
                {
                  skuId: "sku_1",
                  requestedQuantity: 3,
                  quantityOnHand: 1,
                },
              ],
            };
          },
        }),
      ),
    ).resolves.toEqual({
      status: "requires_review",
      providerEventId: "evt_1",
      paymentId: "payment_1",
      orderId: "order_1",
      shortages: [
        {
          skuId: "sku_1",
          requestedQuantity: 3,
          quantityOnHand: 1,
        },
      ],
    });
  });
});
