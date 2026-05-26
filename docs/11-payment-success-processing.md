# Payment Success Processing Design

## Purpose

This document defines the payment success processing boundary for MerchFlow.

Order creation only creates a pending order and pending payment. Payment success is the commitment point: the system records the provider event, deducts inventory, creates sale stock ledger rows, marks payment `SUCCEEDED`, and marks order `PAID`.

## Why This Layer Exists

Payment webhooks are production-risky because providers retry events and because money can move before internal inventory changes complete.

The processor must:

- use provider event id as an idempotency key
- reject malformed webhook simulation input
- process only pending payment/order pairs
- deduct inventory and write stock ledger rows in the same transaction
- prevent duplicate events from double-deducting stock
- move insufficient-stock cases into review without making inventory negative
- write audit logs for processed, ignored, and review outcomes

## V1 Rules

- Local webhook simulation identifies the payment by internal `paymentId`.
- Provider event id remains the idempotency key.
- Duplicate provider event id returns `duplicate` and performs no stock mutation.
- Only `PENDING` payment with `PENDING_PAYMENT` order can become succeeded/paid.
- Non-pending payment/order pairs are recorded and ignored.
- Successful processing writes one `SALE` stock ledger per aggregated SKU quantity.
- Insufficient stock writes no sale ledger and moves payment/order to review.
- Review state is explicit: payment `REQUIRES_REVIEW`, order `PAYMENT_REQUIRES_REVIEW`, payment event `FAILED_REVIEW`.

## Production Problems This Design Handles

- Provider retry does not double-deduct inventory.
- Stock deduction and sale ledger creation cannot split across partial writes.
- Money-success-but-no-stock becomes a visible review state instead of a hidden inconsistent state.
- The service boundary is provider-agnostic, so Stripe or HitPay can be added later behind the same processing contract.

## Interview Talking Points

- "I modeled webhook idempotency as a database uniqueness constraint on provider event id, not as an in-memory guard."
- "I made payment success the inventory commitment point because order creation alone does not mean money moved."
- "I moved insufficient-stock-after-payment into review instead of forcing negative stock or pretending the sale succeeded."
- "I kept provider input normalization outside the Prisma transaction, but kept event claim, stock deduction, state transitions, and audit inside the transaction."
