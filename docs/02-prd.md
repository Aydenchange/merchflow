# MerchFlow PRD

## Purpose

This PRD defines the first buildable version of MerchFlow.

The goal is to ship a production-style SaaS workflow for small multi-store retailers:

Staff scan items at the counter, create a sale, receive payment confirmation, deduct store inventory, and keep all sensitive changes auditable.

This document is written for engineering use. Each requirement must help derive database tables, API boundaries, permissions, and tests.

## Product Principles

### Correctness Over Feature Count

Inventory and payment state must be correct before the product becomes broad.

The MVP avoids large secondary modules such as marketplace sync, purchase orders, loyalty programs, and full POS hardware support.

### Auditability Over Hidden Mutation

Inventory and payment-sensitive operations must leave a trace.

If stock changes, the system records who caused it, why it changed, which store and SKU were affected, and which order or adjustment caused the change.

### Explicit Recovery Over Silent Failure

When payment, order, and inventory state cannot be reconciled automatically, the system moves the order into a review state instead of pretending the operation succeeded.

## Personas

### Owner

Owns the merchant organization. Needs visibility into stores, staff, sales, inventory, and risk.

Primary goals:

- Set up stores and staff.
- Manage product catalog and SKUs.
- Monitor sales and low stock.
- Review sensitive inventory and payment events.

### Manager

Runs one or more stores.

Primary goals:

- Create sales.
- Adjust stock with a reason.
- Review store orders.
- Handle refunds and restocking decisions.
- Monitor low-stock SKUs for assigned stores.

### Staff

Works at a store counter.

Primary goals:

- Scan items quickly.
- Create a sale for the current store.
- Collect payment.
- Complete fulfillment.

## Functional Requirements

### FR1. Organization And Store Access

Users belong to an organization through membership.

Stores belong to one organization.

Managers and staff can only operate assigned stores. Owners can operate all stores in the organization.

Acceptance criteria:

- A user cannot access a store from another organization.
- A staff user cannot create a sale for an unassigned store.
- A manager can view orders and inventory only for assigned stores.
- An owner can manage all stores in the organization.

Why:

Multi-store SaaS bugs often come from weak tenant and store boundaries. The first version must make access control explicit instead of relying on UI filtering.

Interview angle:

"I modeled organization membership separately from store assignment so tenant-level role and store-level access could evolve independently."

### FR2. Product And SKU Catalog

Owners and managers can create products and SKUs.

Products represent catalog concepts. SKUs represent sellable and stockable variants.

Each SKU has:

- Name or variant label.
- Barcode.
- Price.
- Optional cost.
- Active or inactive status.

Acceptance criteria:

- A product can have multiple SKUs.
- Inventory is tracked per SKU, not per product.
- Barcode must be unique within an organization.
- Inactive SKUs cannot be added to new sales.
- A SKU cannot be deleted if it appears in orders or stock ledger entries; it can only be archived.

Why:

Real retail inventory moves at SKU level. Deleting historical SKUs would corrupt order and inventory history.

Interview angle:

"I separated product and SKU because stock movement happens at the variant level, while product is a catalog abstraction."

### FR3. Store-level Inventory

The system tracks inventory balance per store and SKU.

Inventory changes happen through stock ledger entries.

Supported ledger reasons in V1:

- `SALE`
- `ADJUSTMENT_IN`
- `ADJUSTMENT_OUT`
- `RETURN_RESTOCK`

Acceptance criteria:

- Each stock movement creates a ledger entry.
- Each ledger entry includes organization, store, SKU, quantity delta, reason, actor, and optional related order.
- Inventory balance is updated in the same transaction as the ledger entry.
- Balance cannot go below zero for sale deduction.
- Manual negative adjustment requires a manager or owner and a reason.

Why:

The ledger provides traceability. The balance table exists to make reads fast.

Interview angle:

"I treated inventory balance as a snapshot optimized for reads, while the stock ledger is the operational audit trail."

### FR4. POS-style New Sale

Staff and managers can create sales from a POS-style screen.

The primary item entry method is barcode input. Search by SKU name is a fallback.

Acceptance criteria:

- Staff can scan or enter a barcode.
- The system resolves the barcode to an active SKU in the current organization.
- The SKU is added to the cart for the current store.
- Re-scanning the same SKU increments quantity.
- Staff can update quantity or remove an item before submitting.
- The UI warns if requested quantity exceeds current store stock, but final stock enforcement happens during payment processing.
- Staff can optionally enter customer name, phone, or email.

Why:

Most retail counter workflows use barcode scanners, and many scanners behave like keyboard input. A web-based input can support the first realistic workflow without hardware integration.

Interview angle:

"I adjusted the MVP from a generic admin order form to a barcode-driven POS-style flow after considering how retail staff actually create sales."

### FR5. Order Creation

Submitting the sale creates an order in `PENDING_PAYMENT`.

Order totals are calculated from SKU prices captured at order time.

Acceptance criteria:

- Order belongs to one organization and one store.
- Order items reference SKUs and snapshot SKU name, barcode, unit price, and quantity.
- Changing SKU price later does not change historical order totals.
- Creating an order does not deduct stock.
- Canceling a `PENDING_PAYMENT` order does not affect stock.

Why:

Order history must remain stable after catalog changes. Stock deduction is tied to payment confirmation, not order draft creation.

Interview angle:

"I snapshot order item details because historical orders should not change when product catalog data changes."

### FR6. Payment Intent And Webhook Simulation

The MVP supports payment records and a local provider-style webhook simulation.

The implementation must be shaped so Stripe, HitPay, or another provider can be integrated later.

Acceptance criteria:

- Creating an order creates a payment record in `PENDING`.
- Payment records store provider name, provider payment id, amount, currency, status, and metadata.
- The simulated webhook contains a stable provider event id.
- A provider event id is processed at most once.
- Duplicate payment success events do not double-deduct inventory.

Why:

Webhook idempotency is one of the most common production payment issues. Even a simulation must model repeated provider delivery.

Interview angle:

"I built the payment simulation around provider event ids so the code exercises the same idempotency problem as a real payment provider."

### FR7. Payment-confirmed Stock Deduction

When payment success is processed, the system deducts stock.

The payment success handler is the critical transaction boundary.

Acceptance criteria:

- Only `PENDING_PAYMENT` orders can transition to `PAID`.
- Only `PENDING` payments can transition to `SUCCEEDED`.
- The system checks available stock for each order item in the order store.
- For each item, the system writes a `SALE` stock ledger entry.
- Inventory balances update in the same transaction.
- The order becomes `PAID`.
- The payment becomes `SUCCEEDED`.
- Audit logs are written.

Why:

Payment confirmation is the point where financial and inventory state must become consistent.

Interview angle:

"I placed stock deduction inside payment success handling because payment is the commitment point for this counter-sale flow."

### FR8. Payment Success With Insufficient Stock

If payment succeeds but stock is insufficient, the system must not make stock negative.

Acceptance criteria:

- The payment event is recorded.
- No negative inventory balance is created.
- Order moves to `PAYMENT_REQUIRES_REVIEW`.
- Payment moves to `REQUIRES_REVIEW`.
- Audit log records the SKU and shortage quantity.
- Owner or manager can see the order in a review queue.

Why:

Money may have moved, but the system cannot fulfill the sale safely. This is a real production reconciliation case.

Interview angle:

"I did not hide inconsistent states. If payment succeeded but inventory could not be deducted, I moved the order into manual review."

### FR9. Fulfillment

Staff, manager, or owner can mark a paid order as fulfilled.

Acceptance criteria:

- Only `PAID` orders can become `FULFILLED`.
- Fulfillment records actor and timestamp.
- Fulfillment does not change stock because stock was already deducted at payment confirmation.

Why:

Payment and fulfillment are separate. A paid order may not be handed over immediately.

### FR10. Refund Recording

Managers and owners can record a full refund for a paid or fulfilled order.

Acceptance criteria:

- A refunded order becomes `REFUNDED`.
- Payment becomes `REFUNDED`.
- Refund action writes an audit log.
- Refund does not automatically restock items.
- Manager can separately create a `RETURN_RESTOCK` stock adjustment if items are physically received and sellable.

Why:

Refund is a financial action. Restock is a physical inventory action.

Interview angle:

"I kept refund and restock separate because returning money does not prove that sellable inventory returned to the store."

### FR11. Manual Stock Adjustment

Managers and owners can adjust stock with a required reason.

Acceptance criteria:

- Staff cannot manually adjust stock.
- Adjustment requires store, SKU, quantity delta, and reason.
- Adjustment creates a stock ledger entry.
- Adjustment updates inventory balance in the same transaction.
- Adjustment cannot create a negative balance unless explicitly allowed by a future admin-only policy. V1 does not allow negative balance.

Why:

Manual adjustments are high-risk and must be permissioned and auditable.

### FR12. Low-stock List

Managers and owners can view SKUs below a configured low-stock threshold.

Acceptance criteria:

- Low-stock list is scoped to accessible stores.
- The list shows store, SKU, current balance, and threshold.
- Inactive SKUs are excluded by default.

Why:

This gives the inventory module an operational reporting surface without building a large analytics system.

### FR13. Basic Sales Report

Owners and managers can view basic sales totals.

Acceptance criteria:

- Report can filter by date range and store.
- Staff cannot access organization-wide sales reports.
- Report includes gross sales, order count, and top SKUs by quantity sold.
- Refunded orders are shown separately from completed sales totals to avoid hiding reversals.

Why:

The report validates that order and payment data can support business questions.

### FR14. Audit Log

Sensitive operations write audit logs.

Audited actions:

- Staff or manager creates an order.
- Payment success processing changes order, payment, or stock.
- Payment processing enters review state.
- User cancels an unpaid order.
- User fulfills an order.
- User refunds an order.
- User adjusts stock.
- User creates, updates, archives SKU.

Acceptance criteria:

- Audit log includes actor, organization, optional store, action, entity type, entity id, and metadata.
- Audit logs are visible to owner.
- Managers can view audit logs scoped to assigned stores.

Why:

Audit logs are often skipped in demos but matter in production systems where staff can alter money and inventory.

## Non-functional Requirements

### Security

- All organization-scoped queries must include organization boundary checks.
- Store-scoped actions must check store assignment.
- Server-side authorization is required even if UI hides controls.

### Reliability

- Payment event processing must be idempotent.
- Stock deduction must use database transactions.
- Duplicate provider events must not repeat stock movements.

### Performance

- Order list must support pagination.
- SKU barcode lookup must be indexed.
- Inventory balance lookup must be indexed by store and SKU.
- Sales reports must avoid loading unnecessary full entity graphs.

### Testability

The MVP must include tests for:

- Unauthorized store access.
- Barcode-to-SKU resolution.
- Order item price snapshot.
- Duplicate payment event idempotency.
- Payment success stock deduction.
- Insufficient stock review path.
- Refund without automatic restock.
- Manual stock adjustment audit logging.

## Out of Scope

- Public storefront.
- Shopping cart for customers.
- Marketplace order import.
- POS hardware drivers.
- Offline mode.
- Receipt printing.
- Barcode generation.
- Camera scanning.
- Stock reservation.
- Purchase orders.
- Supplier management.
- Loyalty program.
- Complex promotion engine.

## Success Criteria

The MVP is successful when:

- A staff user can complete a barcode-driven sale for an assigned store.
- Payment success deducts the correct store-level SKU inventory exactly once.
- Duplicate payment success events do not double-deduct stock.
- Insufficient stock after payment moves the order into review without negative inventory.
- Managers can trace why stock changed through stock ledger and audit logs.
- The project documentation explains the design trade-offs well enough to support a technical interview.
