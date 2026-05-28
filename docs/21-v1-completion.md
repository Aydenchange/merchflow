# V1 Completion

MerchFlow V1 is now scoped as a complete production-style portfolio build for small multi-store retail operations.

It is intentionally not a generic e-commerce demo. The implemented surface focuses on the operational problems that usually create real engineering complexity: tenant boundaries, store-level authorization, barcode sales, payment event idempotency, inventory correctness, refunds, return restocking, reporting, and audit history.

## Completed Capabilities

- One-user-one-organization membership model with role and store assignment checks.
- Product/SKU catalog boundary with barcode lookup and archived SKU rejection.
- POS-style barcode sale flow with cart quantity editing.
- Pending order creation with historical SKU price snapshots.
- Simulated provider payment success handling.
- Idempotent payment event processing using provider event ids.
- Atomic payment-confirmed stock deduction.
- Insufficient-stock payment review state without negative inventory.
- Paid order fulfillment.
- Pending payment order cancellation.
- Full refund recording without automatic restock.
- Explicit return restock after physical item inspection.
- Manual stock adjustment with required audit note.
- Low-stock reporting, sales reporting, and reorder suggestions.
- Operations Control Center for fulfillment, cancellation, refunds, stock adjustment, and return restock.
- Audit History screen for tracing sensitive order, payment, stock, and refund events.

## Production Problems Demonstrated

- Duplicate payment webhook delivery does not double-deduct inventory.
- Payment success with insufficient stock moves into manual review instead of hiding inconsistency.
- Refund and inventory restock are separate because money movement does not prove sellable stock returned.
- Inventory balance is optimized for reads, while stock ledger remains the append-only source of stock movement history.
- Managers can operate only assigned stores, even for read-only reporting.
- Sensitive mutations write audit logs that can be filtered later by store, actor, entity, or action.

## Intentional V1 Non-goals

- Public storefront.
- Marketplace import.
- Offline POS mode.
- Receipt printing.
- POS hardware driver integration.
- Purchase orders and supplier receiving.
- Complex promotions and loyalty.
- Catalog CRUD UI.

Catalog CRUD is intentionally left as a backend boundary in V1 rather than a shallow admin screen. The project demonstrates the harder retail workflows first: money, stock, authorization, and auditability.

## Interview Positioning

"I treated V1 as an operations-first retail SaaS rather than a storefront. The main engineering value is in the transaction boundaries: payment confirmation deducts stock exactly once, refund does not imply restock, manual adjustments require authorization and audit notes, and every query is scoped by organization and store access."
