# Core Business Loop Design

## Purpose

This document defines the first production-critical workflow for MerchFlow:

Staff scans items at a store counter, creates a sale, payment is confirmed, store inventory is deducted, and the order is fulfilled.

The goal is not to maximize feature count. The goal is to make the order, payment, and inventory boundary correct enough to discuss like real SaaS production work.

## Primary Flow

1. Staff opens the POS-style `New Sale` screen for an assigned store.
2. Staff scans a barcode or searches a SKU.
3. The system resolves the barcode to a SKU within the organization.
4. The system adds the SKU to the sale cart.
5. Staff reviews quantities and customer information.
6. Staff submits the sale.
7. The system creates an order with status `PENDING_PAYMENT`.
8. The system creates a payment with status `PENDING`.
9. Payment provider sends a payment success event.
10. The system processes the event idempotently.
11. The system checks that the order can transition to `PAID`.
12. The system checks that each ordered SKU has enough stock at the selected store.
13. The system writes stock ledger entries for each sold SKU.
14. The system updates inventory balances.
15. The system marks payment as `SUCCEEDED`.
16. The system marks order as `PAID`.
17. The system writes audit log entries.
18. Staff marks the order as `FULFILLED` after handoff.

## Order States

| State | Meaning |
| --- | --- |
| `DRAFT` | Optional local/UI state before order submission. Not required as a persisted MVP state. |
| `PENDING_PAYMENT` | Order has been created and is waiting for payment confirmation. |
| `PAID` | Payment succeeded and stock was deducted. |
| `FULFILLED` | Items were handed to the customer. |
| `CANCELLED` | Unpaid order was cancelled. |
| `PAYMENT_FAILED` | Payment failed before stock was deducted. |
| `REFUNDED` | Payment was refunded. Stock is not automatically restored. |
| `PAYMENT_REQUIRES_REVIEW` | Payment succeeded, but internal processing could not complete safely. |

## Payment States

| State | Meaning |
| --- | --- |
| `PENDING` | Payment has been created but not confirmed. |
| `SUCCEEDED` | Provider confirmed successful payment. |
| `FAILED` | Provider reported failure. |
| `REFUNDED` | Payment was fully refunded. |
| `PARTIALLY_REFUNDED` | Payment was partially refunded. Kept for later support. |
| `REQUIRES_REVIEW` | Provider state and internal order/inventory state need manual review. |

## State Boundary

Order and payment state are intentionally separate.

Order state answers: "What is the business fulfillment status?"

Payment state answers: "What is the financial transaction status?"

They often move together, but they are not the same concept. Keeping them separate prevents common production bugs, such as treating a refunded payment as proof that inventory was returned.

## Inventory Strategy

MerchFlow V1 uses payment-confirmed stock deduction.

Creating an order does not deduct stock. Payment success triggers stock deduction.

Benefits:

- Avoids unpaid orders holding stock.
- Keeps V1 simpler than a reservation system.
- Matches a counter-sale flow where payment confirmation is the sales commitment.

Trade-off:

- A payment success event may arrive when stock is no longer available.

Mitigation:

- The payment webhook checks stock inside a transaction.
- If stock is insufficient, the system does not force stock negative.
- The order and payment move into a review state so staff can refund, substitute, or manually resolve.

## Stock Ledger

Every inventory change must be represented by a stock ledger entry.

Examples:

- `SALE`: stock deducted because a paid order was confirmed.
- `ADJUSTMENT_IN`: manager manually increased stock.
- `ADJUSTMENT_OUT`: manager manually decreased stock.
- `RETURN_RESTOCK`: returned item was inspected and explicitly put back into sellable stock.

The ledger is the audit trail. The inventory balance is a query optimization.

This means:

- Business logic writes ledger entries.
- Balance is updated in the same transaction.
- Sensitive stock changes include actor, reason, store, SKU, and related order when available.

## Payment Webhook Requirements

Payment success handling must be:

- Idempotent: the same provider event can be delivered multiple times.
- Transactional: order, payment, inventory, stock ledger, and audit log updates succeed or fail together.
- State-aware: only valid state transitions are allowed.
- Stock-safe: inventory balance cannot go below zero.
- Reviewable: ambiguous outcomes are preserved for manual resolution.

## Expected Failure Cases

### Duplicate Payment Event

The same payment success event arrives twice.

Expected behavior:

- The first event processes normally.
- The second event is recognized as already processed.
- Stock is not deducted twice.

### Payment Succeeds, Stock Is Insufficient

Another sale consumed the last units before this payment event was processed.

Expected behavior:

- Stock is not made negative.
- Payment is marked `REQUIRES_REVIEW` or related review state.
- Order is marked `PAYMENT_REQUIRES_REVIEW`.
- Audit log records the failure reason.

### Staff Cancels Unpaid Order

An order in `PENDING_PAYMENT` is cancelled before payment success.

Expected behavior:

- Order becomes `CANCELLED`.
- No stock movement occurs.

### Refund After Fulfillment

Customer receives a refund after items were handed over.

Expected behavior:

- Payment and order record refund state.
- Stock does not automatically increase.
- Manager may create a separate restock adjustment after physical inspection.

## Interview Talking Points

- "I treated inventory balance as a derived snapshot and stock ledger as the source of auditability."
- "I separated order state from payment state because fulfillment and money movement are related but distinct workflows."
- "I made payment webhook processing idempotent to handle repeated provider delivery."
- "I did not auto-restock refunds because financial reversal is not the same as physical inventory return."
- "I intentionally deferred stock reservation because the first version is a counter-sale workflow, not a high-traffic online checkout."

