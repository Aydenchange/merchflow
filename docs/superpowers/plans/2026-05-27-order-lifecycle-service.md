# MerchFlow Order Lifecycle Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add order lifecycle operations for cancelling unpaid orders and fulfilling paid orders with authorization, state transition guards, and audit logging.

**Architecture:** Keep lifecycle transitions separate from POS order creation. Implement a pure lifecycle service that loads the order inside the organization boundary, checks store access, validates the current order state, and delegates the atomic status change to a repository. The Prisma adapter owns the transaction and repeats status guards at write time to protect against concurrent state changes.

**Tech Stack:** TypeScript, Vitest, Prisma 7, PostgreSQL.

---

## Scope

Included:

- Order lifecycle service design note.
- Lifecycle-specific order errors.
- Repository contract for loading and transitioning orders.
- `cancelPendingOrder` service for `PENDING_PAYMENT -> CANCELLED`.
- `fulfillPaidOrder` service for `PAID -> FULFILLED`.
- Tests for authorization, missing order, invalid transitions, reason trimming, and timestamp propagation.
- Prisma-backed lifecycle repository that updates order status and writes audit logs in one transaction.

Excluded:

- UI buttons.
- Server Actions.
- Refund handling.
- Payment failure handling.
- Shipment/tracking model.
- Receipt printing.

## File Structure

- `docs/12-order-lifecycle-service.md`: Explains cancellation and fulfillment boundaries.
- `src/server/orders/lifecycle-service.ts`: Pure lifecycle service functions and repository contract.
- `src/server/orders/lifecycle-service.test.ts`: TDD coverage for service behavior.
- `src/server/orders/lifecycle-prisma-repository.ts`: Prisma transaction adapter.
- `src/server/orders/lifecycle-prisma-repository.test.ts`: Unit tests for Prisma adapter call shape.
- Modify `src/server/orders/errors.ts`: Add lifecycle-specific errors.
- Modify `src/server/orders/types.ts`: Add lifecycle record/result/input types.

## Task 1: Document Order Lifecycle Boundary

**Files:**

- Create: `docs/12-order-lifecycle-service.md`

- [ ] **Step 1: Create design document**

Create `docs/12-order-lifecycle-service.md`:

```md
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
```

- [ ] **Step 2: Commit design document**

Run:

```powershell
git add docs/12-order-lifecycle-service.md
git commit -m "docs: define order lifecycle service"
```

Expected:

- Commit records lifecycle decisions before implementation.

## Task 2: Add Lifecycle Service With TDD

**Files:**

- Create: `src/server/orders/lifecycle-service.test.ts`
- Create: `src/server/orders/lifecycle-service.ts`
- Modify: `src/server/orders/errors.ts`
- Modify: `src/server/orders/types.ts`

- [ ] **Step 1: Write failing tests**

Create `src/server/orders/lifecycle-service.test.ts` with tests covering:

- staff cancels pending order in an assigned store
- cancel trims optional reason
- cancelling a paid order is rejected
- fulfilling a paid order in an assigned store succeeds
- fulfilling a pending order is rejected
- missing order is rejected
- unassigned store access is rejected
- disabled membership is rejected through existing authorization policy

- [ ] **Step 2: Run test to verify RED**

Run:

```powershell
npm run test -- src/server/orders/lifecycle-service.test.ts
```

Expected:

- FAIL because lifecycle service files/functions do not exist.

- [ ] **Step 3: Implement lifecycle service**

Create `src/server/orders/lifecycle-service.ts` and modify shared order error/type files.

The implementation must:

- expose `cancelPendingOrder`
- expose `fulfillPaidOrder`
- use `assertCanCreateSale` after loading the order record
- throw `OrderNotFoundError` when the repository returns null
- throw `InvalidOrderTransitionError` when current status does not allow the transition
- default timestamps to `new Date()` but accept explicit timestamps for tests
- trim optional cancellation reason and omit blank reason
- pass organization id, order id, store id, actor membership id, timestamp, and reason to the repository

- [ ] **Step 4: Run test to verify GREEN**

Run:

```powershell
npm run test -- src/server/orders/lifecycle-service.test.ts
```

Expected:

- PASS.

- [ ] **Step 5: Commit lifecycle service**

Run:

```powershell
git add src/server/orders/errors.ts src/server/orders/types.ts src/server/orders/lifecycle-service.ts src/server/orders/lifecycle-service.test.ts
git commit -m "feat: add order lifecycle service"
```

Expected:

- Commit records tested lifecycle service behavior.

## Task 3: Add Prisma Lifecycle Repository

**Files:**

- Create: `src/server/orders/lifecycle-prisma-repository.test.ts`
- Create: `src/server/orders/lifecycle-prisma-repository.ts`

- [ ] **Step 1: Write failing Prisma adapter tests**

Create `src/server/orders/lifecycle-prisma-repository.test.ts` with tests covering:

- order lookup is scoped by organization
- cancel transition uses guarded `updateMany`
- cancel writes audit log with optional reason
- fulfill transition uses guarded `updateMany`
- fulfill writes audit log
- guarded update failure throws `InvalidOrderTransitionError`

- [ ] **Step 2: Run test to verify RED**

Run:

```powershell
npm run test -- src/server/orders/lifecycle-prisma-repository.test.ts
```

Expected:

- FAIL because Prisma lifecycle repository does not exist.

- [ ] **Step 3: Implement Prisma lifecycle repository**

Create `src/server/orders/lifecycle-prisma-repository.ts`.

The implementation must:

- expose `createPrismaOrderLifecycleRepository`
- load order status and store id by organization and order id
- wrap cancel and fulfill in `$transaction`
- use `updateMany` with current status guard for transition writes
- write an audit log in the same transaction
- throw `InvalidOrderTransitionError` if guarded update count is not `1`
- return lifecycle result objects with order id, status, and timestamp

- [ ] **Step 4: Run tests and build**

Run:

```powershell
npm run test -- src/server/orders/lifecycle-prisma-repository.test.ts
npm run build
```

Expected:

- PASS.

- [ ] **Step 5: Commit Prisma repository**

Run:

```powershell
git add src/server/orders/lifecycle-prisma-repository.ts src/server/orders/lifecycle-prisma-repository.test.ts
git commit -m "feat: add prisma order lifecycle repository"
```

Expected:

- Commit records Prisma lifecycle adapter.

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

- Covers cancellation of pending unpaid orders.
- Covers fulfillment of paid orders.
- Covers authorization and tenant/store boundaries.
- Covers audit logging.
- Covers no inventory mutation during cancellation or fulfillment.
- Defers refunds and payment failure to later slices.

Placeholder scan:

- No placeholder markers are used.

Type consistency:

- Order status strings match Prisma `OrderStatus`.
- Repository inputs include the fields required to write audit logs.
- Lifecycle result timestamps map to `cancelledAt` and `fulfilledAt`.
