# MerchFlow Payment Success Processing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a payment success processor that records provider events idempotently, deducts inventory exactly once, moves paid orders to `PAID`, and moves insufficient-stock cases into review without negative inventory.

**Architecture:** Keep provider-specific HTTP routes out of this slice. Implement a small service that normalizes and validates webhook simulation input, then delegates the atomic state transition to a Prisma repository. The repository owns the transaction that claims the provider event, validates payment/order state, deducts inventory, writes sale ledgers, updates payment/order/event states, and writes audit logs.

**Tech Stack:** TypeScript, Vitest, Prisma 7, PostgreSQL.

---

## Scope

Included:

- Payment success design note.
- Payment-specific domain errors.
- Repository contract for processing a normalized payment success event.
- Service tests for input normalization, validation, processed, duplicate, and review results.
- Prisma repository tests for successful stock deduction, duplicate event handling, insufficient stock review, and non-pending state ignored behavior.
- Prisma repository implementation for event idempotency and stock deduction transaction.

Excluded:

- Public webhook route.
- Signature verification.
- Real Stripe or HitPay SDK integration.
- Payment failure webhook.
- Refund processing.
- UI review queue.

## File Structure

- `docs/11-payment-success-processing.md`: Explains payment success transaction and production risks.
- `src/server/payments/errors.ts`: Payment-specific domain errors.
- `src/server/payments/types.ts`: Service input, normalized input, result, and shortage types.
- `src/server/payments/service.ts`: Input validation and service boundary.
- `src/server/payments/service.test.ts`: TDD coverage for service behavior.
- `src/server/payments/prisma-repository.ts`: Prisma transaction adapter.
- `src/server/payments/prisma-repository.test.ts`: Unit tests for Prisma adapter call shape and outcomes.

## Task 1: Document Payment Success Boundary

**Files:**

- Create: `docs/11-payment-success-processing.md`

- [ ] **Step 1: Create design document**

Create `docs/11-payment-success-processing.md`:

```md
# Payment Success Processing Design

## Purpose

This document defines the payment success processing boundary for MerchFlow.

Order creation only creates a pending order and pending payment. Payment success is the commitment point: the system records the provider event, deducts inventory, creates sale stock ledger rows, marks payment `SUCCEEDED`, and marks order `PAID`.

## Why This Layer Exists

Payment webhooks are production-risky because providers retry events and because money can move before internal inventory changes complete.

The processor must:

- use provider event id as an idempotency key
- reject malformed webhook simulation input
- process only pending payment/order pairs
- deduct inventory and write stock ledger rows in the same transaction
- prevent duplicate events from double-deducting stock
- move insufficient-stock cases into review without making inventory negative
- write audit logs for processed, ignored, and review outcomes

## V1 Rules

- Local webhook simulation identifies the payment by internal `paymentId`.
- Provider event id remains the idempotency key.
- Duplicate provider event id returns `duplicate` and performs no stock mutation.
- Only `PENDING` payment with `PENDING_PAYMENT` order can become succeeded/paid.
- Non-pending payment/order pairs are recorded and ignored.
- Successful processing writes one `SALE` stock ledger per aggregated SKU quantity.
- Insufficient stock writes no sale ledger and moves payment/order to review.
- Review state is explicit: payment `REQUIRES_REVIEW`, order `PAYMENT_REQUIRES_REVIEW`, payment event `FAILED_REVIEW`.

## Production Problems This Design Handles

- Provider retry does not double-deduct inventory.
- Stock deduction and sale ledger creation cannot split across partial writes.
- Money-success-but-no-stock becomes a visible review state instead of a hidden inconsistent state.
- The service boundary is provider-agnostic, so Stripe or HitPay can be added later behind the same processing contract.

## Interview Talking Points

- "I modeled webhook idempotency as a database uniqueness constraint on provider event id, not as an in-memory guard."
- "I made payment success the inventory commitment point because order creation alone does not mean money moved."
- "I moved insufficient-stock-after-payment into review instead of forcing negative stock or pretending the sale succeeded."
- "I kept provider input normalization outside the Prisma transaction, but kept event claim, stock deduction, state transitions, and audit inside the transaction."
```

- [ ] **Step 2: Commit design document**

Run:

```powershell
git add docs/11-payment-success-processing.md
git commit -m "docs: define payment success processing"
```

Expected:

- Commit records payment success processing decisions before implementation.

## Task 2: Add Payment Success Service With TDD

**Files:**

- Create: `src/server/payments/service.test.ts`
- Create: `src/server/payments/errors.ts`
- Create: `src/server/payments/types.ts`
- Create: `src/server/payments/service.ts`

- [ ] **Step 1: Write failing tests**

Create `src/server/payments/service.test.ts` with tests covering:

- normalizes provider, provider event id, payment id, event type, payload, and processed timestamp
- rejects blank provider
- rejects blank provider event id
- rejects blank payment id
- propagates processed result
- propagates duplicate result
- propagates requires-review result

- [ ] **Step 2: Run test to verify RED**

Run:

```powershell
npm run test -- src/server/payments/service.test.ts
```

Expected:

- FAIL because payment service files do not exist.

- [ ] **Step 3: Implement payment service**

Create:

- `src/server/payments/errors.ts`
- `src/server/payments/types.ts`
- `src/server/payments/service.ts`

The implementation must:

- expose `processPaymentSuccess`
- trim required string fields
- default `eventType` to `payment.succeeded`
- default `payload` to an empty object
- default `processedAt` to `new Date()` when absent
- throw `InvalidPaymentEventError` for malformed input
- delegate normalized input to the repository

- [ ] **Step 4: Run test to verify GREEN**

Run:

```powershell
npm run test -- src/server/payments/service.test.ts
```

Expected:

- PASS.

- [ ] **Step 5: Commit payment service**

Run:

```powershell
git add src/server/payments/errors.ts src/server/payments/types.ts src/server/payments/service.ts src/server/payments/service.test.ts
git commit -m "feat: add payment success service"
```

Expected:

- Commit records tested payment service behavior.

## Task 3: Add Prisma Payment Repository

**Files:**

- Create: `src/server/payments/prisma-repository.test.ts`
- Create: `src/server/payments/prisma-repository.ts`

- [ ] **Step 1: Write failing Prisma adapter tests**

Create `src/server/payments/prisma-repository.test.ts` with tests covering:

- successful event claim, inventory deduction, sale ledger creation, payment/order updates, event processing, and audit log
- duplicate provider event id returns duplicate result and skips stock mutation
- insufficient stock moves payment/order/event into review and skips sale ledger creation
- already processed payment/order records event and returns ignored result

- [ ] **Step 2: Run test to verify RED**

Run:

```powershell
npm run test -- src/server/payments/prisma-repository.test.ts
```

Expected:

- FAIL because Prisma payment repository does not exist.

- [ ] **Step 3: Implement Prisma repository**

Create `src/server/payments/prisma-repository.ts`.

The implementation must:

- expose `createPrismaPaymentRepository`
- load payment by internal payment id and provider
- create `PaymentEvent` with `(provider, providerEventId)` uniqueness as the idempotency claim
- return duplicate result on Prisma unique constraint failure
- aggregate order item quantities by SKU before deduction
- check current inventory balances for shortages
- move shortages to review without stock ledger creation
- deduct stock through guarded `updateMany` calls
- compensate in-transaction if a guarded deduction fails after earlier deductions in the same transaction
- write `SALE` stock ledger rows only after all deductions succeed
- update payment to `SUCCEEDED` and order to `PAID`
- update event `processedAt` and `processingStatus`
- write audit logs for processed, review, and ignored outcomes

- [ ] **Step 4: Run tests and build**

Run:

```powershell
npm run test -- src/server/payments/prisma-repository.test.ts
npm run build
```

Expected:

- PASS.

- [ ] **Step 5: Commit Prisma repository**

Run:

```powershell
git add src/server/payments/prisma-repository.ts src/server/payments/prisma-repository.test.ts
git commit -m "feat: add prisma payment success repository"
```

Expected:

- Commit records Prisma payment transaction adapter.

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

- Covers provider event idempotency.
- Covers successful stock deduction and sale ledger creation.
- Covers insufficient-stock review path.
- Covers duplicate event safety.
- Covers non-pending state ignored behavior.
- Defers real provider routes and signature verification to a later slice.

Placeholder scan:

- No placeholder markers are used.

Type consistency:

- Result statuses are lowercase service statuses.
- Prisma status strings match `OrderStatus`, `PaymentStatus`, and `PaymentEventProcessingStatus`.
- Repository input and output fields match the service types.
