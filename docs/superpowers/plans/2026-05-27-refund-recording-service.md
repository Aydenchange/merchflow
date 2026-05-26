# MerchFlow Refund Recording Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full-refund recording service that moves eligible orders and payments to `REFUNDED`, writes an audit log, and explicitly avoids inventory restock.

**Architecture:** Keep refund recording separate from payment webhook processing and inventory restock. The service loads the persisted order/payment first, authorizes against the order store, validates refund state, requires a human-readable reason, and delegates one transaction to the Prisma adapter. The adapter updates order and payment state and writes audit metadata, but never writes inventory balances or stock ledgers.

**Tech Stack:** TypeScript, Vitest, Prisma 7, PostgreSQL.

---

## Scope

Included:

- Refund recording design note.
- Refund-specific errors and types.
- `recordFullRefund` service.
- Refund authorization rule for owner/manager only.
- Tests for paid order refund, fulfilled order refund, staff denial, unassigned manager denial, missing order, missing payment, invalid order state, invalid payment state, and blank reason.
- Prisma repository for refund lookup and transaction.

Excluded:

- External provider refund API call.
- Partial refunds.
- Refund webhook reconciliation.
- Automatic restock.
- Return inspection workflow.
- UI review queue.

## File Structure

- `docs/13-refund-recording-service.md`: Explains refund boundaries and why restock is separate.
- `src/server/authz/policy.ts`: Add `assertCanRecordRefund`.
- `src/server/refunds/errors.ts`: Refund-specific domain errors.
- `src/server/refunds/types.ts`: Refund service input/output and repository types.
- `src/server/refunds/service.ts`: Pure refund service.
- `src/server/refunds/service.test.ts`: TDD coverage for service behavior.
- `src/server/refunds/prisma-repository.ts`: Prisma transaction adapter.
- `src/server/refunds/prisma-repository.test.ts`: Unit tests for Prisma adapter call shape.

## Task 1: Document Refund Boundary

**Files:**

- Create: `docs/13-refund-recording-service.md`

- [ ] **Step 1: Create design document**

Create `docs/13-refund-recording-service.md`:

```md
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
```

- [ ] **Step 2: Commit design document**

Run:

```powershell
git add docs/13-refund-recording-service.md
git commit -m "docs: define refund recording service"
```

Expected:

- Commit records refund design decisions before implementation.

## Task 2: Add Refund Service With TDD

**Files:**

- Create: `src/server/refunds/service.test.ts`
- Modify: `src/server/authz/policy.ts`
- Create: `src/server/refunds/errors.ts`
- Create: `src/server/refunds/types.ts`
- Create: `src/server/refunds/service.ts`

- [ ] **Step 1: Write failing tests**

Create `src/server/refunds/service.test.ts` with tests covering:

- manager records full refund for assigned paid order
- owner records full refund for fulfilled order in any store
- staff cannot record refund
- manager cannot refund unassigned store order
- missing order throws domain error
- order without payment throws domain error
- pending order cannot be refunded
- non-succeeded payment cannot be refunded
- blank refund reason is rejected

- [ ] **Step 2: Run test to verify RED**

Run:

```powershell
npm run test -- src/server/refunds/service.test.ts
```

Expected:

- FAIL because refund service files and refund policy do not exist.

- [ ] **Step 3: Implement refund service**

Modify `src/server/authz/policy.ts`:

- Add `assertCanRecordRefund`.

Create:

- `src/server/refunds/errors.ts`
- `src/server/refunds/types.ts`
- `src/server/refunds/service.ts`

The implementation must:

- expose `recordFullRefund`
- load refundable order by organization and order id
- throw `RefundOrderNotFoundError` when missing
- call `assertCanRecordRefund` with the loaded order store id
- allow only order statuses `PAID` and `FULFILLED`
- allow only payment status `SUCCEEDED`
- require non-blank reason
- default `refundedAt` to `new Date()`
- pass actor membership id, reason, amount, and currency to repository

- [ ] **Step 4: Run test to verify GREEN**

Run:

```powershell
npm run test -- src/server/refunds/service.test.ts
```

Expected:

- PASS.

- [ ] **Step 5: Commit refund service**

Run:

```powershell
git add src/server/authz/policy.ts src/server/refunds/errors.ts src/server/refunds/types.ts src/server/refunds/service.ts src/server/refunds/service.test.ts
git commit -m "feat: add refund recording service"
```

Expected:

- Commit records tested refund service behavior.

## Task 3: Add Prisma Refund Repository

**Files:**

- Create: `src/server/refunds/prisma-repository.test.ts`
- Create: `src/server/refunds/prisma-repository.ts`

- [ ] **Step 1: Write failing Prisma adapter tests**

Create `src/server/refunds/prisma-repository.test.ts` with tests covering:

- refund lookup scoped by organization and order id with payment selected
- refund transaction updates order, updates payment, and writes audit log
- refund transaction does not call stock ledger or inventory balance APIs

- [ ] **Step 2: Run test to verify RED**

Run:

```powershell
npm run test -- src/server/refunds/prisma-repository.test.ts
```

Expected:

- FAIL because refund Prisma repository does not exist.

- [ ] **Step 3: Implement Prisma repository**

Create `src/server/refunds/prisma-repository.ts`.

The implementation must:

- expose `createPrismaRefundRepository`
- find order by `id` and `organizationId`
- select payment id, status, amount, and currency
- update order with `REFUNDED` and `refundedAt`
- update payment with `REFUNDED`
- write `refund.recorded` audit log
- return refund amount and currency
- not mutate inventory or stock ledger

- [ ] **Step 4: Run tests and build**

Run:

```powershell
npm run test -- src/server/refunds/prisma-repository.test.ts
npm run build
```

Expected:

- PASS.

- [ ] **Step 5: Commit Prisma repository**

Run:

```powershell
git add src/server/refunds/prisma-repository.ts src/server/refunds/prisma-repository.test.ts
git commit -m "feat: add prisma refund repository"
```

Expected:

- Commit records Prisma refund adapter.

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

- Covers full refund for paid and fulfilled orders.
- Covers owner/manager-only authorization.
- Covers payment state transition to refunded.
- Covers order state transition to refunded.
- Covers audit log creation.
- Explicitly excludes automatic restock and stock ledger writes.

Placeholder scan:

- No placeholder markers are used.

Type consistency:

- Order status strings match Prisma `OrderStatus`.
- Payment status strings match Prisma `PaymentStatus`.
- Repository input and output fields match refund service types.
