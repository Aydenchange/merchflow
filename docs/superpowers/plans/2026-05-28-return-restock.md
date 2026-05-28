# Return Restock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a return-restock workflow so refunded orders can be physically received back into inventory without confusing money movement with stock movement.

**Architecture:** Add a `returns` domain service that validates refunded order status, manager/owner stock permissions, positive restock quantities, and "do not restock more than sold quantity" rules. The Prisma repository updates inventory balances and creates `RETURN_RESTOCK` stock ledgers in one transaction, then the Control Center exposes restock candidates and a Server Action command.

**Tech Stack:** Next.js App Router, Server Actions, React client component, Prisma, PostgreSQL, Vitest, TypeScript.

---

## Task 1: Return Restock Service

- [ ] Write `src/server/returns/service.test.ts`.
- [ ] Verify it fails because `recordReturnRestock` does not exist.
- [ ] Implement `src/server/returns/types.ts`, `src/server/returns/errors.ts`, and `src/server/returns/service.ts`.
- [ ] Cover manager success, staff denial, non-refunded order rejection, blank note, invalid quantity, unknown SKU, and over-restock prevention.

## Task 2: Prisma Repository

- [ ] Write `src/server/returns/prisma-repository.test.ts`.
- [ ] Verify it fails because `createPrismaReturnRestockRepository` does not exist.
- [ ] Implement `src/server/returns/prisma-repository.ts`.
- [ ] Ensure inventory balance increments and stock ledgers are created inside one transaction with `RETURN_RESTOCK` and `relatedOrderId`.

## Task 3: Demo Control Integration

- [ ] Extend `src/server/demo/control-center.ts` with return-restock candidates and `restockDemoReturn`.
- [ ] Extend `src/server/demo/control-prisma-repository.ts` to list refunded orders and restockable quantities.
- [ ] Extend `src/app/control-action-handlers.ts` and `src/app/actions.ts`.
- [ ] Add tests for orchestration and action wiring.

## Task 4: UI

- [ ] Update `src/app/control-center.tsx` with a Return restock panel.
- [ ] Let managers/owners select a refunded order, SKU, quantity, and note.
- [ ] Show staff denial from the server if attempted.
- [ ] Refresh the control center after successful restock.

## Task 5: Documentation and Verification

- [ ] Add `docs/19-return-restock.md`.
- [ ] Run `npm run test`.
- [ ] Run `npm run prisma:validate`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Browser verify refund -> return restock -> audit stock movement.
- [ ] Merge to `main` and push.

