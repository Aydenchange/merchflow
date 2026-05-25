# Database Schema Design

## Purpose

This document converts the MerchFlow domain model into PostgreSQL and Prisma schema decisions.

It focuses on the parts that prevent production bugs:

- Tenant boundaries.
- Store-level access.
- SKU and barcode uniqueness.
- Inventory ledger and balance consistency.
- Payment webhook idempotency.
- Order and payment state separation.
- Historical price snapshots.
- Auditability.

## Technology Choice

V1 uses:

- PostgreSQL as the relational database.
- Prisma as the TypeScript ORM and migration tool.
- Integer minor units for money.
- Database transactions for order, payment, inventory, and audit consistency.

## Why PostgreSQL

PostgreSQL fits this project because the core data is relational and transactional:

- Orders contain order items.
- Stores own inventory balances.
- SKU barcodes require uniqueness.
- Payment events require idempotency constraints.
- Inventory deduction must be transactional.
- Reports need indexed filtering by store and date.

This is not a document-first workload. The important bugs happen around relationships and state transitions, so relational constraints are useful.

## Why Prisma

Prisma is a practical choice for a Next.js full-stack portfolio project because it gives:

- Type-safe model access from TypeScript.
- Clear migration history.
- Readable schema file.
- Good developer ergonomics for service-layer code.

Trade-off:

Prisma does not replace database thinking. We still need explicit unique constraints, indexes, transactions, and sometimes raw SQL migrations for stricter checks.

## Global Design Decisions

### IDs

Use UUID string IDs for all primary keys.

Recommended Prisma shape:

```prisma
id String @id @default(uuid())
```

Why:

- UUIDs are safe to generate without central coordination.
- They are suitable for SaaS resources exposed through URLs.
- They avoid leaking row counts like sequential IDs do.

### Timestamps

Most tables use:

```prisma
createdAt DateTime @default(now())
updatedAt DateTime @updatedAt
```

Append-only event tables such as `StockLedger`, `PaymentEvent`, and `AuditLog` may only need `createdAt` plus processing timestamps.

### Money

Store money as integer minor units.

Examples:

- SGD 12.50 is stored as `1250`.
- MYR 39.90 is stored as `3990`.

Recommended fields:

```prisma
totalAmount Int
currency String
```

Why:

Floating-point values can create rounding errors. Integer minor units are common for payments, invoices, and financial calculations.

V1 stores currency at organization and order/payment level. Multi-currency settlement is out of scope.

### Tenant Boundary

Every business table stores `organizationId`.

Why:

- Authorization checks can consistently scope queries.
- Reports can filter by tenant efficiently.
- Accidental cross-tenant joins become easier to catch.

Important:

The service layer must still validate access. Database structure helps, but it does not replace authorization logic.

### Composite Tenant Foreign Keys

Where practical, use composite foreign keys to ensure related rows belong to the same organization.

Example concept:

```prisma
@@unique([id, organizationId])
```

Then a child table can reference both `id` and `organizationId`.

Why:

If an order belongs to organization A, it should not reference a store from organization B. A normal `storeId` foreign key only proves the store exists, not that it belongs to the same tenant.

Practical note:

We will use composite tenant references for the highest-risk relationships, especially orders, stores, SKUs, inventory balances, and stock ledger. If Prisma syntax becomes too noisy, we will still keep application-level validation and add database tests for cross-tenant access.

## Core Enums

### OrganizationRole

- `OWNER`
- `MANAGER`
- `STAFF`

### MembershipStatus

- `ACTIVE`
- `INVITED`
- `DISABLED`

### StoreStatus

- `ACTIVE`
- `INACTIVE`

### CatalogStatus

- `ACTIVE`
- `ARCHIVED`

### OrderStatus

- `PENDING_PAYMENT`
- `PAID`
- `FULFILLED`
- `CANCELLED`
- `PAYMENT_FAILED`
- `REFUNDED`
- `PAYMENT_REQUIRES_REVIEW`

### PaymentStatus

- `PENDING`
- `SUCCEEDED`
- `FAILED`
- `REFUNDED`
- `PARTIALLY_REFUNDED`
- `REQUIRES_REVIEW`

### StockLedgerReason

- `SALE`
- `ADJUSTMENT_IN`
- `ADJUSTMENT_OUT`
- `RETURN_RESTOCK`

### PaymentEventProcessingStatus

- `PROCESSED`
- `FAILED_REVIEW`

## Table Design

### users

Purpose:

Stores login identity.

Key columns:

- `id`
- `email`
- `name`
- `created_at`
- `updated_at`

Constraints:

- Unique `email`.

Why:

Email identifies the login user. Retail permissions are not stored here.

### organizations

Purpose:

Stores one merchant business.

Key columns:

- `id`
- `name`
- `country`
- `currency`
- `created_at`
- `updated_at`

Indexes:

- Optional index on `country` for later filtering or sample data.

Why:

Country and currency are organization-level defaults. V1 supports Singapore and Malaysia style retail operations but does not do multi-currency settlement.

### organization_memberships

Purpose:

Stores a user's role and status in their organization.

Key columns:

- `id`
- `organization_id`
- `user_id`
- `role`
- `status`
- `created_at`
- `updated_at`

Constraints:

- Unique `user_id`.
- Unique `(organization_id, user_id)`.

Indexes:

- Index `organization_id`.
- Index `(organization_id, role)`.

Why:

Unique `user_id` enforces the V1 rule that one user belongs to one organization. We keep membership as a separate table so role and invitation status remain relationship data.

### stores

Purpose:

Stores physical retail locations.

Key columns:

- `id`
- `organization_id`
- `name`
- `code`
- `address`
- `status`
- `created_at`
- `updated_at`

Constraints:

- Unique `(organization_id, code)`.
- Unique `(id, organization_id)` for composite tenant references.

Indexes:

- Index `(organization_id, status)`.

Why:

Store code is only unique inside a merchant organization. Different merchants may both have a store code like `MAIN`.

### store_assignments

Purpose:

Stores which managers and staff can operate which stores.

Key columns:

- `id`
- `organization_id`
- `membership_id`
- `store_id`
- `created_at`

Constraints:

- Unique `(membership_id, store_id)`.

Indexes:

- Index `(organization_id, membership_id)`.
- Index `(organization_id, store_id)`.

Why:

Store access is separate from organization role. An owner can access all stores, while a manager or staff user gets explicit assignments.

### products

Purpose:

Stores catalog-level product concepts.

Key columns:

- `id`
- `organization_id`
- `name`
- `description`
- `status`
- `created_at`
- `updated_at`

Constraints:

- Unique `(id, organization_id)` for composite tenant references.

Indexes:

- Index `(organization_id, status)`.

Why:

Product groups SKUs but is not itself stocked.

### skus

Purpose:

Stores sellable and stockable variants.

Key columns:

- `id`
- `organization_id`
- `product_id`
- `name`
- `barcode`
- `price_amount`
- `cost_amount`
- `status`
- `created_at`
- `updated_at`

Constraints:

- Unique `(organization_id, barcode)`.
- Unique `(id, organization_id)` for composite tenant references.

Indexes:

- Index `(organization_id, product_id)`.
- Index `(organization_id, status)`.
- Index `(organization_id, barcode)`.

Why:

Barcode lookup is on the hot path for the POS-style sale screen, so it needs a database index and an organization scope.

### inventory_balances

Purpose:

Stores current stock per store and SKU.

Key columns:

- `id`
- `organization_id`
- `store_id`
- `sku_id`
- `quantity_on_hand`
- `low_stock_threshold`
- `updated_at`

Constraints:

- Unique `(organization_id, store_id, sku_id)`.
- Quantity cannot be negative in V1.
- Low-stock threshold cannot be negative.

Indexes:

- Index `(organization_id, store_id)`.
- Index `(organization_id, sku_id)`.
- Index `(organization_id, store_id, quantity_on_hand)`.

Why:

The balance table makes reads fast. It must not be the only record of stock changes.

Prisma note:

If Prisma cannot express all check constraints directly, add raw SQL migration checks:

```sql
ALTER TABLE inventory_balances
ADD CONSTRAINT inventory_balances_quantity_non_negative
CHECK (quantity_on_hand >= 0);
```

### stock_ledgers

Purpose:

Stores append-only stock movements.

Key columns:

- `id`
- `organization_id`
- `store_id`
- `sku_id`
- `quantity_delta`
- `reason`
- `related_order_id`
- `actor_membership_id`
- `note`
- `created_at`

Constraints:

- `quantity_delta` cannot be zero.

Indexes:

- Index `(organization_id, store_id, sku_id, created_at)`.
- Index `(organization_id, related_order_id)`.
- Index `(organization_id, actor_membership_id)`.

Why:

This table is the inventory audit trail. It must be append-only at the application level.

Sign convention:

- Sale and outbound adjustments use negative quantities.
- Inbound adjustments and return restocks use positive quantities.

### customers

Purpose:

Stores optional lightweight customer information.

Key columns:

- `id`
- `organization_id`
- `name`
- `phone`
- `email`
- `created_at`
- `updated_at`

Indexes:

- Index `(organization_id, phone)`.
- Index `(organization_id, email)`.

Why:

V1 supports walk-in sales without requiring a customer profile.

### orders

Purpose:

Stores one sale.

Key columns:

- `id`
- `organization_id`
- `store_id`
- `customer_id`
- `created_by_membership_id`
- `status`
- `subtotal_amount`
- `tax_amount`
- `total_amount`
- `currency`
- `paid_at`
- `fulfilled_at`
- `cancelled_at`
- `refunded_at`
- `created_at`
- `updated_at`

Constraints:

- Unique `(id, organization_id)` for composite tenant references.
- Amounts cannot be negative.

Indexes:

- Index `(organization_id, store_id, created_at)`.
- Index `(organization_id, status, created_at)`.
- Index `(organization_id, created_by_membership_id, created_at)`.

Why:

Order lists usually filter by organization, store, status, and date. These indexes support operational screens and basic reports.

### order_items

Purpose:

Stores SKU lines inside an order.

Key columns:

- `id`
- `organization_id`
- `order_id`
- `sku_id`
- `sku_name_snapshot`
- `barcode_snapshot`
- `unit_price_amount`
- `quantity`
- `line_total_amount`

Constraints:

- Quantity must be positive.
- Amounts cannot be negative.

Indexes:

- Index `(organization_id, order_id)`.
- Index `(organization_id, sku_id)`.

Why:

Order items snapshot SKU data because financial history must not change when catalog data changes.

### payments

Purpose:

Stores payment state for an order.

Key columns:

- `id`
- `organization_id`
- `order_id`
- `provider`
- `provider_payment_id`
- `status`
- `amount`
- `currency`
- `metadata`
- `created_at`
- `updated_at`

Constraints:

- Unique `order_id` in V1 because V1 supports one payment per order.
- Unique `(provider, provider_payment_id)` where provider payment id is present.
- Amount cannot be negative.

Indexes:

- Index `(organization_id, status, created_at)`.
- Index `(organization_id, provider, provider_payment_id)`.

Why:

Payment state is separate from order state. A refunded payment does not prove inventory returned.

### payment_events

Purpose:

Stores provider webhook events for idempotency and debugging.

Key columns:

- `id`
- `organization_id`
- `payment_id`
- `provider`
- `provider_event_id`
- `event_type`
- `payload`
- `processed_at`
- `processing_status`
- `created_at`

Constraints:

- Unique `(provider, provider_event_id)`.

Indexes:

- Index `(organization_id, payment_id, created_at)`.
- Index `(organization_id, processing_status, created_at)`.

Why:

Payment providers can retry webhook delivery. The unique provider event id prevents duplicate stock deduction.

Duplicate handling:

- V1 stores one row per provider event id.
- A duplicate delivery does not create another `payment_events` row.
- The application detects the existing row and returns an ignored duplicate result.

### audit_logs

Purpose:

Stores append-only sensitive operation history.

Key columns:

- `id`
- `organization_id`
- `store_id`
- `actor_membership_id`
- `action`
- `entity_type`
- `entity_id`
- `metadata`
- `created_at`

Indexes:

- Index `(organization_id, created_at)`.
- Index `(organization_id, store_id, created_at)`.
- Index `(organization_id, actor_membership_id, created_at)`.
- Index `(organization_id, entity_type, entity_id)`.

Why:

Owners and managers need to trace who changed inventory, payments, orders, and catalog records.

## High-risk Constraints

These constraints matter most for production correctness.

### One User, One Organization

```text
organization_memberships.user_id UNIQUE
```

Prevents a user from belonging to multiple merchants in V1.

### Barcode Unique Per Organization

```text
skus(organization_id, barcode) UNIQUE
```

Allows different merchants to use the same manufacturer barcode while preventing ambiguity inside one organization.

### One Inventory Balance Per Store SKU

```text
inventory_balances(organization_id, store_id, sku_id) UNIQUE
```

Prevents two current balances for the same store and SKU.

### Payment Event Idempotency

```text
payment_events(provider, provider_event_id) UNIQUE
```

Prevents duplicate webhook processing.

### One Payment Per Order In V1

```text
payments.order_id UNIQUE
```

Keeps V1 payment logic focused. Partial and split payments can be designed later.

## Transaction Design

### Create Order Transaction

Writes:

- `orders`
- `order_items`
- `payments`
- `audit_logs`

Does not write:

- `inventory_balances`
- `stock_ledgers`

Why:

Creating an order is not the sales commitment point. Payment confirmation is.

### Process Payment Success Transaction

Writes:

- `payment_events`
- `stock_ledgers`
- `inventory_balances`
- `payments`
- `orders`
- `audit_logs`

Checks:

- Event id was not already processed.
- Order is `PENDING_PAYMENT`.
- Payment is `PENDING`.
- Inventory balance is sufficient.

Why:

This is the most important consistency boundary in the project.

### Manual Stock Adjustment Transaction

Writes:

- `stock_ledgers`
- `inventory_balances`
- `audit_logs`

Checks:

- Actor is manager or owner.
- Store is accessible.
- New balance is not negative.

### Refund Transaction

Writes:

- `payments`
- `orders`
- `audit_logs`

Does not write:

- `inventory_balances`
- `stock_ledgers`

Why:

Refund and restock are separate operations.

## Query Patterns And Index Rationale

### Barcode Sale Lookup

Query:

```text
Find active SKU by organizationId and barcode.
```

Index:

```text
skus(organization_id, barcode)
```

### Order List

Query:

```text
Find orders by organization, store, status, date range, with pagination.
```

Indexes:

```text
orders(organization_id, store_id, created_at)
orders(organization_id, status, created_at)
```

### Low-stock List

Query:

```text
Find inventory balances where quantity_on_hand <= low_stock_threshold for accessible stores.
```

Index:

```text
inventory_balances(organization_id, store_id, quantity_on_hand)
```

Note:

This index helps scope by tenant and store. The threshold comparison is row-specific, so it may still need practical testing once data volume grows.

### Stock History

Query:

```text
Find stock ledger rows by store, SKU, and date.
```

Index:

```text
stock_ledgers(organization_id, store_id, sku_id, created_at)
```

### Payment Reconciliation

Query:

```text
Find payment events by status and creation date.
```

Index:

```text
payment_events(organization_id, processing_status, created_at)
```

## Implementation Notes For Prisma

### Use Prisma Transactions For Critical Flows

Use interactive transactions for:

- Payment success processing.
- Manual stock adjustment.
- Refund.

Reason:

The code needs multiple reads and writes with business checks in the middle.

### Keep Business Logic Out Of React Components

React components should not mutate order, payment, or inventory state directly.

Use service functions such as:

- `createOrderFromSale`
- `processPaymentSuccessEvent`
- `adjustStock`
- `recordRefund`

Reason:

These flows need authorization, transaction handling, audit logging, and tests. They should be callable outside UI code.

### Use Raw SQL For Check Constraints If Needed

If Prisma schema cannot express a check constraint cleanly, add it in the migration SQL.

Important examples:

- Non-negative inventory balance.
- Positive order item quantity.
- Non-zero stock ledger quantity delta.
- Non-negative money amounts.

## Interview Talking Points

- "I stored money as integer minor units to avoid floating-point rounding bugs."
- "I added organizationId to tenant-owned tables so every query can be scoped explicitly."
- "I used unique payment provider event ids to make webhook handling idempotent."
- "I made inventory balance unique per organization, store, and SKU because two balance rows for the same item would corrupt stock reads."
- "I kept stock ledger append-only and updated balance in the same transaction."
- "I designed indexes around actual screens: barcode lookup, order list, low-stock list, stock history, and payment reconciliation."
- "I kept payment and order state separate because money movement and fulfillment are different workflows."
