# Order Lifecycle Service Design

## Purpose

This document defines the first order lifecycle transitions after order creation and payment success.

MerchFlow V1 supports two human-triggered lifecycle actions:

- cancel a `PENDING_PAYMENT` order
- fulfill a `PAID` order

## Why This Layer Exists

Order status is a business state machine, not a free-form field.

The service must:

- load orders inside the current organization boundary
- enforce store access before changing state
- allow only valid state transitions
- record who performed the action
- write audit logs for sensitive lifecycle changes
- avoid inventory mutation in both cancellation and fulfillment

## V1 Rules

- A `PENDING_PAYMENT` order can become `CANCELLED`.
- Cancelling a pending order does not update inventory because no stock was deducted yet.
- Only a `PAID` order can become `FULFILLED`.
- Fulfilling an order records `fulfilledAt`.
- Fulfillment does not update inventory because payment success already deducted stock.
- Staff, managers, and owners can cancel or fulfill orders in stores they can access.
- Managers and staff cannot operate orders in unassigned stores.

## Production Problems This Design Handles

- Prevents double stock deduction during fulfillment.
- Prevents accidental cancellation of paid orders after money and stock have moved.
- Repeats status guards in the repository so concurrent state changes cannot pass based only on stale service reads.
- Keeps audit trail for who cancelled or fulfilled an order.

## Interview Talking Points

- "I modeled order status as explicit transitions instead of letting callers patch arbitrary statuses."
- "I kept fulfillment separate from payment because a paid order may not be handed over immediately."
- "I avoided stock mutation on fulfillment because stock was already deducted at payment confirmation."
- "I repeated transition guards in the Prisma adapter to handle races between staff actions and webhook processing."
