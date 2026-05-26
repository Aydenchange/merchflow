# MerchFlow POS Order Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a POS order creation service that turns scanned cart items into a `PENDING_PAYMENT` order, order item snapshots, a `PENDING` payment, and an audit log without deducting inventory.

**Architecture:** Implement a pure order service that depends on `AuthContext` and an order repository interface. The service validates store access, aggregates repeated SKU scans, snapshots SKU display and price data, computes totals, and returns stock warnings without blocking the sale. A Prisma repository adapter owns the database transaction for order, items, payment, and audit log creation.

**Tech Stack:** TypeScript, Vitest, Prisma 7, PostgreSQL.

---

## Scope

Included:

- POS order service design note.
- Order-specific domain errors.
- Repository contract for order creation context and persistence.
- `createPendingPosOrder` service with authorization, item validation, duplicate SKU aggregation, price snapshotting, and stock warnings.
- Tests for successful order creation, duplicate scans, insufficient stock warning, unauthorized store access, empty cart, invalid quantity, missing store, missing SKU, and archived SKU.
- Prisma-backed order repository that creates order, order items, payment, and audit log in one transaction.

Excluded:

- POS UI.
- Server Actions.
- Payment webhook processing.
- Payment success stock deduction.
- Customer upsert or deduplication.
- Promotions, discounts, and non-zero tax calculation.

## File Structure

- `docs/10-pos-order-service.md`: Explains POS order creation boundary and production trade-offs.
- `src/server/orders/errors.ts`: Order-specific domain errors.
- `src/server/orders/types.ts`: Service input, repository input, and result types.
- `src/server/orders/service.ts`: Pure POS order creation service.
- `src/server/orders/service.test.ts`: TDD coverage for service behavior.
- `src/server/orders/prisma-repository.ts`: Prisma transaction adapter.
- `src/server/orders/prisma-repository.test.ts`: Unit tests for Prisma adapter call shape.

## Task 1: Document POS Order Service Boundary

**Files:**

- Create: `docs/10-pos-order-service.md`

- [ ] **Step 1: Create design document**

Create `docs/10-pos-order-service.md`:

```md
# POS Order Service Design

## Purpose

This document defines the first sales/order service boundary for MerchFlow.

The POS workflow starts with barcode-scanned SKUs in a cart. Submitting the cart creates an order in `PENDING_PAYMENT`, creates a payment in `PENDING`, snapshots order item data, and writes an audit log. It does not deduct inventory.

## Why This Layer Exists

Order creation is not a generic form save. It is the bridge between catalog, inventory, payment, and audit.

The service must:

- enforce store access on the server
- aggregate repeated scans of the same SKU into one order line
- reject empty carts and invalid quantities
- snapshot SKU name, barcode, and unit price at order creation time
- compute totals on the server
- warn when requested quantity exceeds current stock
- avoid stock mutation until payment succeeds

## V1 Rules

- Staff, manager, and owner can create sales in stores they can access.
- Order creation requires at least one item.
- Item quantity must be a positive integer.
- Duplicate SKU scans are aggregated before persistence.
- Archived SKUs cannot be added to new orders.
- Missing SKUs fail order creation.
- Creating an order creates a `PENDING_PAYMENT` order and a `PENDING` payment.
- Creating an order writes an audit log.
- Creating an order does not write stock ledger entries and does not update inventory balances.
- Tax is `0` in V1 until we add region-specific tax rules.

## Production Problems This Design Handles

- Historical orders stay stable when SKU names or prices change later.
- Staff cannot create an order for a store hidden by the UI but rejected by server policy.
- Repeated barcode scans behave like real counter workflows instead of creating duplicate lines.
- Current inventory can be stale, so insufficient stock at order creation is a warning, not the final enforcement point.
- Payment and audit rows are created in the same transaction as the order so partial order creation cannot leak.

## Interview Talking Points

- "I made order creation snapshot SKU fields because orders are financial records and cannot depend on mutable catalog data."
- "I aggregate duplicate scans server-side because barcode scanners often behave like keyboard input and repeated scans should increment quantity."
- "I return stock warnings but do not deduct or hard-block at order creation, because payment confirmation is the commitment point."
- "I create the payment and audit log in the same transaction as the order to avoid orphaned or unaudited sales."
```

- [ ] **Step 2: Commit design document**

Run:

```powershell
git add docs/10-pos-order-service.md
git commit -m "docs: define pos order service"
```

Expected:

- Commit records POS order service decisions before implementation.

## Task 2: Add POS Order Service With TDD

**Files:**

- Create: `src/server/orders/service.test.ts`
- Create: `src/server/orders/errors.ts`
- Create: `src/server/orders/types.ts`
- Create: `src/server/orders/service.ts`

- [ ] **Step 1: Write failing tests**

Create `src/server/orders/service.test.ts` with tests covering:

- successful pending order creation from scanned items
- duplicate SKU scan aggregation
- stock warning without blocking order creation
- unauthorized store access
- empty cart rejection
- zero and fractional quantity rejection
- missing store rejection
- missing SKU rejection
- archived SKU rejection

- [ ] **Step 2: Run test to verify RED**

Run:

```powershell
npm run test -- src/server/orders/service.test.ts
```

Expected:

- FAIL because order service files do not exist.

- [ ] **Step 3: Implement order service**

Create:

- `src/server/orders/errors.ts`
- `src/server/orders/types.ts`
- `src/server/orders/service.ts`

The implementation must:

- use `assertCanCreateSale`
- aggregate duplicate SKU IDs while preserving first-seen order
- call `getOrderCreationContext` after validation
- throw `StoreNotFoundForOrderError` when the store context is absent
- throw `OrderSkuNotFoundError` when a requested SKU is missing
- throw `ArchivedOrderSkuError` when a requested SKU is archived
- use `createOrderItemSnapshot`
- use `addMoney` for subtotal accumulation
- set `taxAmount` to `0`
- default `paymentProvider` to `simulated_pos`

- [ ] **Step 4: Run test to verify GREEN**

Run:

```powershell
npm run test -- src/server/orders/service.test.ts
```

Expected:

- PASS.

- [ ] **Step 5: Commit order service**

Run:

```powershell
git add src/server/orders/errors.ts src/server/orders/types.ts src/server/orders/service.ts src/server/orders/service.test.ts
git commit -m "feat: add pos order service"
```

Expected:

- Commit records tested POS order service behavior.

## Task 3: Add Prisma Order Repository

**Files:**

- Create: `src/server/orders/prisma-repository.test.ts`
- Create: `src/server/orders/prisma-repository.ts`

- [ ] **Step 1: Write failing Prisma adapter tests**

Create `src/server/orders/prisma-repository.test.ts` with tests covering:

- store lookup scoped by organization and active store status
- SKU lookup scoped by organization and store inventory balance
- order creation with nested order items and payment
- audit log creation after order persistence

- [ ] **Step 2: Run test to verify RED**

Run:

```powershell
npm run test -- src/server/orders/prisma-repository.test.ts
```

Expected:

- FAIL because Prisma order repository does not exist.

- [ ] **Step 3: Implement Prisma repository**

Create `src/server/orders/prisma-repository.ts`.

The implementation must:

- expose `createPrismaOrderRepository`
- verify the selected store belongs to the organization before returning order creation context
- return organization currency from the store's organization relation
- fetch requested SKUs by organization and SKU IDs
- include inventory balance for the selected store
- create order, nested order items, and nested payment in a transaction
- create an audit log in the same transaction after the order exists
- map Prisma records back into service result types

- [ ] **Step 4: Run tests and build**

Run:

```powershell
npm run test -- src/server/orders/prisma-repository.test.ts
npm run build
```

Expected:

- PASS.

- [ ] **Step 5: Commit Prisma repository**

Run:

```powershell
git add src/server/orders/prisma-repository.ts src/server/orders/prisma-repository.test.ts
git commit -m "feat: add prisma order repository"
```

Expected:

- Commit records Prisma adapter.

## Task 4: Final Verification

**Files:**

- No new files.

- [ ] **Step 1: Run tests**

Run:

```powershell
npm run test
```

Expected:

- PASS.

- [ ] **Step 2: Validate Prisma**

Run:

```powershell
npm run prisma:validate
```

Expected:

- PASS.

- [ ] **Step 3: Run lint**

Run:

```powershell
npm run lint
```

Expected:

- PASS.

- [ ] **Step 4: Run build**

Run:

```powershell
npm run build
```

Expected:

- PASS.

## Self-review

Spec coverage:

- Covers POS order creation from barcode-scanned cart items.
- Covers order item snapshots and server-side totals.
- Covers pending payment creation.
- Covers stock warning without stock mutation.
- Covers audit log creation in the Prisma adapter.
- Defers payment success stock deduction to the next slice.

Placeholder scan:

- No placeholder markers are used.

Type consistency:

- Order status strings match Prisma `OrderStatus`.
- Payment status strings match Prisma `PaymentStatus`.
- Repository input and output fields match the service types.
