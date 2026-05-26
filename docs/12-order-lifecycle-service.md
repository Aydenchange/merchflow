# Order Lifecycle Service Design

## Purpose

This document defines the order lifecycle service boundary for MerchFlow.

POS order creation creates a `PENDING_PAYMENT` order. Payment success moves the order to `PAID`. This service handles two user-driven lifecycle actions after that: cancelling unpaid orders and fulfilling paid orders.

## Why This Layer Exists

Order lifecycle transitions are state-machine operations, not generic updates.

The service must:

- load the persisted order before authorization
- authorize against the store recorded on the order
- allow only `PENDING_PAYMENT -> CANCELLED`
- allow only `PAID -> FULFILLED`
- write audit logs for both transitions
- avoid inventory mutation during cancellation and fulfillment

## V1 Rules

- Staff, manager, and owner can cancel or fulfill orders for stores they can access.
- Missing orders return a domain error.
- Cancelling is allowed only from `PENDING_PAYMENT`.
- Cancelling an unpaid order does not affect stock.
- Cancelling closes the local pending payment as `FAILED` in V1.
- Fulfillment is allowed only from `PAID`.
- Fulfillment records `fulfilledAt`.
- Fulfillment does not change stock because payment success already deducted stock.

## Production Problems This Design Handles

- The client cannot authorize against a forged store id because the service loads the order first.
- Invalid state transitions are rejected before persistence.
- Audit logs explain who cancelled or fulfilled the order.
- Payment and fulfillment remain separate concepts.

## Interview Talking Points

- "I treated cancel and fulfill as explicit state transitions instead of open-ended order updates."
- "I load the order before checking store access so authorization uses server-owned data, not client-submitted store ids."
- "I do not mutate stock on fulfillment because inventory was already committed at payment success."
- "For V1 local payment simulation, cancelling a pending order closes the pending payment as `FAILED`; a real provider integration would cancel the payment intent."
