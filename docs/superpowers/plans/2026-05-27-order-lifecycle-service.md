# MerchFlow Order Lifecycle Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add order lifecycle actions for cancelling unpaid orders and fulfilling paid orders with authorization, explicit state transitions, and audit logs.

**Architecture:** Keep lifecycle transitions separate from POS order creation and payment processing. The service loads the persisted order first, authorizes against the real store on the order, validates the current order state, then delegates the database mutation and audit write to a Prisma repository transaction. Cancellation closes the local pending payment as `FAILED`; fulfillment only changes order state because inventory was already deducted at payment success.

**Tech Stack:** TypeScript, Vitest, Prisma 7, PostgreSQL.

---

## Scope

Included:

- Order lifecycle design note.
- Order lifecycle service types.
- `cancelPendingOrder` service.
- `fulfillPaidOrder` service.
- Tests for authorization, missing order, invalid transitions, cancelled timestamp, fulfilled timestamp, and repository input.
- Prisma repository for order lookup, cancellation transaction, fulfillment transaction, and audit logging.

Excluded:

- UI actions.
- Server Actions.
- Real provider payment-intent cancellation.
- Refund processing.
- Review queue resolution.

## File Structure

- `docs/12-order-lifecycle-service.md`: Explains lifecycle transition rules.
- `src/server/orders/errors.ts`: Add lifecycle-specific order errors.
- `src/server/orders/lifecycle-types.ts`: Lifecycle service input/output and repository types.
- `src/server/orders/lifecycle-service.ts`: Pure service functions.
- `src/server/orders/lifecycle-service.test.ts`: TDD coverage for service behavior.
- `src/server/orders/lifecycle-prisma-repository.ts`: Prisma transaction adapter.
- `src/server/orders/lifecycle-prisma-repository.test.ts`: Unit tests for Prisma adapter call shape.

## Task 1: Document Order Lifecycle Boundary

**Files:**

- Create: `docs/12-order-lifecycle-service.md`

- [ ] **Step 1: Create design document**

Create `docs/12-order-lifecycle-service.md`:

```md
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
```

- [ ] **Step 2: Commit design document**

Run:

```powershell
git add docs/12-order-lifecycle-service.md
git commit -m "docs: define order lifecycle service"
```

Expected:

- Commit records order lifecycle decisions before implementation.

## Task 2: Add Order Lifecycle Service With TDD

**Files:**

- Create: `src/server/orders/lifecycle-service.test.ts`
- Modify: `src/server/orders/errors.ts`
- Create: `src/server/orders/lifecycle-types.ts`
- Create: `src/server/orders/lifecycle-service.ts`

- [ ] **Step 1: Write failing tests**

Create `src/server/orders/lifecycle-service.test.ts` with tests covering:

- cancelling a pending order for an assigned store
- denying cancellation for an unassigned store
- rejecting cancellation when order is missing
- rejecting cancellation when order is already paid
- fulfilling a paid order for an assigned store
- rejecting fulfillment when order is pending payment
- owner can fulfill any organization order

- [ ] **Step 2: Run test to verify RED**

Run:

```powershell
npm run test -- src/server/orders/lifecycle-service.test.ts
```

Expected:

- FAIL because lifecycle service files do not exist or lifecycle errors are not exported.

- [ ] **Step 3: Implement lifecycle service**

Modify `src/server/orders/errors.ts`:

- Add `OrderNotFoundError`.
- Add `InvalidOrderTransitionError`.

Create `src/server/orders/lifecycle-types.ts` and `src/server/orders/lifecycle-service.ts`.

The implementation must:

- expose `cancelPendingOrder`
- expose `fulfillPaidOrder`
- load the order through `findOrderForLifecycle`
- throw `OrderNotFoundError` when missing
- call `assertCanCreateSale` with the loaded order's `storeId`
- reject invalid source statuses with `InvalidOrderTransitionError`
- default transition timestamps to `new Date()`
- pass `actorMembershipId` to the repository for audit logging

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
git add src/server/orders/errors.ts src/server/orders/lifecycle-types.ts src/server/orders/lifecycle-service.ts src/server/orders/lifecycle-service.test.ts
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

- order lookup scoped by organization and order id
- cancellation updates order, closes payment as failed, and writes audit log in one transaction
- fulfillment updates order and writes audit log without touching payment or inventory

- [ ] **Step 2: Run test to verify RED**

Run:

```powershell
npm run test -- src/server/orders/lifecycle-prisma-repository.test.ts
```

Expected:

- FAIL because lifecycle Prisma repository does not exist.

- [ ] **Step 3: Implement Prisma repository**

Create `src/server/orders/lifecycle-prisma-repository.ts`.

The implementation must:

- expose `createPrismaOrderLifecycleRepository`
- use `order.findFirst` scoped by `organizationId` and order id
- use transactions for cancellation and fulfillment
- use compound `id_organizationId` where available for order updates
- update order `status` and transition timestamp
- update payment status to `FAILED` when cancelling unpaid order
- write audit logs with actor, organization, store, action, entity type, entity id, and metadata
- not update payment or inventory during fulfillment

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

- Covers cancellation from pending payment without inventory mutation.
- Covers fulfillment from paid order without inventory mutation.
- Covers authorization against persisted order store.
- Covers audit logging for both lifecycle transitions.
- Defers refund and real provider cancellation to later slices.

Placeholder scan:

- No placeholder markers are used.

Type consistency:

- Order status strings match Prisma `OrderStatus`.
- Payment cancellation uses existing V1 `FAILED` payment status.
- Repository input and output fields match lifecycle service types.
