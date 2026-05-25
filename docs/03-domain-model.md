# MerchFlow Domain Model

## Purpose

This document defines the core domain model for MerchFlow V1.

It is not yet the final database schema. It is the conceptual model that the schema, API routes, authorization checks, tests, and interview explanations will be derived from.

## V1 Domain Assumptions

- A user belongs to exactly one organization.
- A retailer organization can have multiple stores.
- Owners can operate all stores in the organization.
- Managers and staff operate only assigned stores.
- Products are catalog concepts.
- SKUs are sellable and stockable variants.
- Inventory is tracked by store and SKU.
- Orders are created from a POS-style barcode sale screen.
- Creating an order does not deduct stock.
- Payment confirmation deducts stock.
- Payment webhook processing must be idempotent.
- Refund does not automatically restock inventory.

## Entity Groups

### Identity And Tenant Boundary

These entities answer: "Who is acting, which merchant do they belong to, and which stores can they operate?"

#### User

Represents a login identity.

Key fields:

- `id`
- `email`
- `name`
- `createdAt`
- `updatedAt`

Important rule:

- User identity does not directly store retail permissions.
- Permissions come from membership and store assignments.

Why:

The user record should stay close to identity. Role, organization status, and store access are relationship data.

#### Organization

Represents one merchant business.

Key fields:

- `id`
- `name`
- `country`
- `currency`
- `createdAt`
- `updatedAt`

Important rule:

- Almost every business entity belongs to one organization.
- Organization boundary must be included in authorization checks.

#### OrganizationMembership

Represents a user's relationship to the organization.

Key fields:

- `id`
- `organizationId`
- `userId`
- `role`: `OWNER`, `MANAGER`, `STAFF`
- `status`: `ACTIVE`, `INVITED`, `DISABLED`
- `createdAt`
- `updatedAt`

Important rule:

- V1 enforces one membership per user with a unique `userId`.
- The membership still exists as a separate entity because role and status belong to the relationship, not to identity.

Why:

This matches the observed small-retail model where a staff member usually works for one merchant, while keeping a clean place for role and invitation metadata.

#### Store

Represents a physical retail location.

Key fields:

- `id`
- `organizationId`
- `name`
- `code`
- `address`
- `status`: `ACTIVE`, `INACTIVE`
- `createdAt`
- `updatedAt`

Important rule:

- Store belongs to exactly one organization.
- Store code is unique within an organization.

#### StoreAssignment

Represents which stores a manager or staff member can operate.

Key fields:

- `id`
- `organizationId`
- `membershipId`
- `storeId`
- `createdAt`

Important rule:

- Assignment organization must match both membership organization and store organization.
- Owners do not need explicit store assignments for V1 because they can access all stores in the organization.

Why:

Organization role and store access are related but different. A manager may manage two stores, while a staff member may only work in one.

### Catalog

These entities answer: "What can the retailer sell?"

#### Product

Represents a catalog-level product concept.

Example:

- `Classic T-Shirt`

Key fields:

- `id`
- `organizationId`
- `name`
- `description`
- `status`: `ACTIVE`, `ARCHIVED`
- `createdAt`
- `updatedAt`

Important rule:

- Product is not directly stocked or sold.
- Product groups one or more SKUs.

#### SKU

Represents a specific sellable and stockable variant.

Example:

- `Classic T-Shirt / Black / M`

Key fields:

- `id`
- `organizationId`
- `productId`
- `name`
- `barcode`
- `price`
- `cost`
- `status`: `ACTIVE`, `ARCHIVED`
- `createdAt`
- `updatedAt`

Important rules:

- Barcode is unique within an organization.
- Active SKU can be added to new sales.
- Archived SKU stays available for historical orders and stock ledger records.
- SKU price is copied into order items at sale creation time.

Why:

Retail inventory moves at SKU level, not product level. Orders must snapshot SKU details so historical data does not change when catalog data changes later.

### Inventory

These entities answer: "How much stock exists, where is it, and why did it change?"

#### InventoryBalance

Represents the current stock snapshot for a store and SKU.

Key fields:

- `id`
- `organizationId`
- `storeId`
- `skuId`
- `quantityOnHand`
- `lowStockThreshold`
- `updatedAt`

Important rules:

- One inventory balance exists per store and SKU.
- Quantity cannot become negative in V1.
- Balance is updated only through inventory domain operations.

Why:

Balance makes operational reads fast. It is not the audit trail.

#### StockLedger

Represents one stock movement.

Key fields:

- `id`
- `organizationId`
- `storeId`
- `skuId`
- `quantityDelta`
- `reason`: `SALE`, `ADJUSTMENT_IN`, `ADJUSTMENT_OUT`, `RETURN_RESTOCK`
- `relatedOrderId`
- `actorMembershipId`
- `note`
- `createdAt`

Important rules:

- Every inventory mutation writes a ledger row.
- `SALE` quantity is negative.
- `ADJUSTMENT_IN` and `RETURN_RESTOCK` quantities are positive.
- `ADJUSTMENT_OUT` quantity is negative.
- Ledger rows are append-only.
- Balance update and ledger insert happen in the same transaction.

Why:

The ledger is how we explain inventory history. The current balance is only the latest state.

### Sales

These entities answer: "What did the store sell, to whom, and what state is the order in?"

#### Customer

Represents lightweight customer information captured during a sale.

Key fields:

- `id`
- `organizationId`
- `name`
- `phone`
- `email`
- `createdAt`
- `updatedAt`

Important rule:

- Customer is optional for V1 orders.
- A walk-in sale can be created without customer information.

Why:

Retail counter sales often do not need a full customer profile.

#### Order

Represents one sale.

Key fields:

- `id`
- `organizationId`
- `storeId`
- `customerId`
- `createdByMembershipId`
- `status`
- `subtotalAmount`
- `taxAmount`
- `totalAmount`
- `currency`
- `paidAt`
- `fulfilledAt`
- `cancelledAt`
- `refundedAt`
- `createdAt`
- `updatedAt`

Order statuses:

- `PENDING_PAYMENT`
- `PAID`
- `FULFILLED`
- `CANCELLED`
- `PAYMENT_FAILED`
- `REFUNDED`
- `PAYMENT_REQUIRES_REVIEW`

Important rules:

- Order belongs to exactly one store.
- Order starts in `PENDING_PAYMENT`.
- Creating an order does not change stock.
- Only `PENDING_PAYMENT` can become `PAID`.
- Only `PAID` can become `FULFILLED`.
- Only unpaid orders can be cancelled without stock effects.

#### OrderItem

Represents one SKU line inside an order.

Key fields:

- `id`
- `organizationId`
- `orderId`
- `skuId`
- `skuNameSnapshot`
- `barcodeSnapshot`
- `unitPriceSnapshot`
- `quantity`
- `lineTotalAmount`

Important rules:

- Order item snapshots display and price fields.
- Later SKU edits do not rewrite historical order items.
- Quantity must be positive.

Why:

Historical orders are financial records. They must remain stable after catalog changes.

### Payments

These entities answer: "What happened with money, and which provider events have been processed?"

#### Payment

Represents payment state for an order.

Key fields:

- `id`
- `organizationId`
- `orderId`
- `provider`
- `providerPaymentId`
- `status`
- `amount`
- `currency`
- `metadata`
- `createdAt`
- `updatedAt`

Payment statuses:

- `PENDING`
- `SUCCEEDED`
- `FAILED`
- `REFUNDED`
- `PARTIALLY_REFUNDED`
- `REQUIRES_REVIEW`

Important rules:

- V1 creates one payment per order.
- Payment state is separate from order state.
- Provider payment id is unique per provider when present.

Why:

Money movement and fulfillment state are related but not identical. Keeping them separate prevents incorrect assumptions, especially around refunds and review states.

#### PaymentEvent

Represents one provider webhook event.

Key fields:

- `id`
- `organizationId`
- `paymentId`
- `provider`
- `providerEventId`
- `eventType`
- `payload`
- `processedAt`
- `processingStatus`: `PROCESSED`, `IGNORED_DUPLICATE`, `FAILED_REVIEW`
- `createdAt`

Important rules:

- `(provider, providerEventId)` is unique.
- A duplicate event must not repeat stock deduction.
- Raw payload is stored for debugging and reconciliation.

Why:

Payment providers can retry webhooks. Idempotency has to be modeled as data, not only as code.

### Audit

These entities answer: "Who did what, when, and to which business object?"

#### AuditLog

Represents sensitive user or system actions.

Key fields:

- `id`
- `organizationId`
- `storeId`
- `actorMembershipId`
- `action`
- `entityType`
- `entityId`
- `metadata`
- `createdAt`

Important rules:

- Audit logs are append-only.
- Payment webhook system actions may have no human actor.
- Store-level audit logs are visible only to authorized users.

Why:

Stock, payment, refund, and permission-related actions need traceability in a real retail system.

## Core Relationships

```text
User 1 -- 1 OrganizationMembership
Organization 1 -- many OrganizationMembership
Organization 1 -- many Store
OrganizationMembership many -- many Store through StoreAssignment

Organization 1 -- many Product
Product 1 -- many SKU
Organization 1 -- many SKU

Store 1 -- many InventoryBalance
SKU 1 -- many InventoryBalance
Store 1 -- many StockLedger
SKU 1 -- many StockLedger

Store 1 -- many Order
Order 1 -- many OrderItem
Order 1 -- 1 Payment
Payment 1 -- many PaymentEvent

Organization 1 -- many AuditLog
Store 1 -- many AuditLog
```

## Domain Invariants

These rules must remain true regardless of UI flow.

### Tenant Boundary

Every store, SKU, order, payment, inventory balance, stock ledger, and audit log belongs to exactly one organization.

Server code must not rely on client-provided organization access.

### Single Organization Per User

V1 allows exactly one membership per user.

This is enforced with a unique `userId` on membership.

### Store Assignment

Managers and staff can only operate assigned stores.

Owners can operate all stores in their organization.

### SKU Barcode Scope

Barcode is unique inside an organization.

Two different organizations may use the same barcode.

### Inventory Mutation

Inventory balance cannot be mutated without a stock ledger row in the same transaction.

### Payment Idempotency

The same provider event id can be processed only once.

### Historical Snapshot

Order items must store SKU name, barcode, and unit price snapshots.

### Refund And Restock Separation

Refunding payment does not restock inventory.

Restock requires an explicit inventory operation.

## Transaction Boundaries

### Create Order

Must create:

- Order
- Order items
- Payment
- Audit log

Must not create:

- Stock ledger entries
- Inventory balance changes

### Process Payment Success

Must happen in one transaction:

- Insert or claim payment event idempotency record.
- Validate order state.
- Validate payment state.
- Validate inventory balance.
- Insert stock ledger entries.
- Update inventory balances.
- Update payment to `SUCCEEDED`.
- Update order to `PAID`.
- Insert audit logs.

If stock is insufficient:

- Do not make inventory negative.
- Mark payment `REQUIRES_REVIEW`.
- Mark order `PAYMENT_REQUIRES_REVIEW`.
- Insert audit log.

### Manual Stock Adjustment

Must happen in one transaction:

- Validate actor permission.
- Validate balance will not become negative.
- Insert stock ledger entry.
- Update inventory balance.
- Insert audit log.

### Refund

Must happen in one transaction:

- Validate actor permission.
- Update payment refund state.
- Update order refund state.
- Insert audit log.

Must not:

- Automatically increase inventory balance.
- Automatically insert `RETURN_RESTOCK`.

## Service Boundaries

These are not final file names yet, but they describe the responsibilities we want in code.

### Authorization

Builds an auth context from the current user.

Answers:

- Which organization does this user belong to?
- What is the user's role?
- Which stores can the user operate?
- Is this action allowed?

### Catalog

Owns product and SKU creation, update, archive, and barcode lookup.

### Inventory

Owns inventory balance, stock ledger, manual adjustment, and stock validation.

### Sales

Owns order creation, order state transitions, fulfillment, and refund coordination.

### Payments

Owns payment record creation, webhook event idempotency, provider event handling, and payment state transitions.

### Audit

Owns append-only audit log creation.

## Interview Talking Points

- "I intentionally limited users to one organization in V1 because the target user is a small retailer, not an agency managing many tenants."
- "I still modeled membership separately from user because role and invitation status belong to the relationship between user and organization."
- "Store assignment is separate from organization role because a manager may operate two stores while another manager operates only one."
- "Inventory balance is a read model, while stock ledger is the traceable source of inventory changes."
- "Payment event idempotency is represented as data through PaymentEvent, not only through an in-memory guard."
- "Order item snapshots preserve financial history after SKU names or prices change."

