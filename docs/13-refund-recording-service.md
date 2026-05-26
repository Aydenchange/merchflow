# Refund Recording Service Design

## Purpose

This document defines the refund recording boundary for MerchFlow.

Refunding an order is a financial state change. It records that money was returned or that the local system accepted a full refund outcome. It does not prove the physical items returned to sellable inventory.

## Why This Layer Exists

Refunds are production-sensitive because money, fulfillment, and inventory are related but not identical.

The service must:

- authorize only owner or manager users
- authorize against the store recorded on the order
- allow refunds only for `PAID` or `FULFILLED` orders
- require a human-readable refund reason
- move order to `REFUNDED`
- move payment to `REFUNDED`
- write an audit log
- avoid stock ledger or inventory balance writes

## V1 Rules

- Staff cannot record refunds.
- Manager can refund only assigned-store orders.
- Owner can refund any order in the organization.
- Full refund is allowed only for `PAID` or `FULFILLED` orders.
- Payment must be `SUCCEEDED`.
- Refund records a timestamp and reason.
- Refund does not automatically restock inventory.
- Restock requires a separate `RETURN_RESTOCK` inventory operation after physical inspection.

## Production Problems This Design Handles

- Financial reversal does not silently create sellable stock.
- Store-scoped authorization uses server-loaded order data, not client-submitted store ids.
- A refund reason is captured for audit and dispute handling.
- Refunded orders remain visible in sales reporting rather than disappearing from history.

## Interview Talking Points

- "I separated refund from restock because returning money does not prove that sellable inventory returned."
- "I only allow owner/manager refund recording because it changes financial state."
- "The service loads the order first and authorizes against the persisted store id, which prevents client-side store spoofing."
- "The Prisma adapter intentionally has no inventory or stock ledger calls; restocking is a separate inventory workflow."
