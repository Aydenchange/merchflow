# Operations Control Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-style back-office control center for paid-order fulfillment, manager refund recording, and auditable stock adjustments.

**Architecture:** Keep business rules inside server services and expose them through demo orchestration functions plus Next.js Server Actions. The client component only renders available operations, submits commands, and reloads the read model; it never decides whether a role can mutate data.

**Tech Stack:** Next.js App Router, Server Actions, React client components, Prisma, PostgreSQL, Vitest, TypeScript.

---

## File Map

- Create `src/server/demo/control-center.ts`: orchestration layer for loading the control-center read model and invoking lifecycle/refund/inventory services.
- Create `src/server/demo/control-prisma-repository.ts`: Prisma read repository for recent orders and inventory adjustment options.
- Create `src/app/control-action-handlers.ts`: Server Action handler factory that wires Prisma repositories to the demo orchestration functions.
- Create `src/app/control-center.tsx`: interactive client UI for order actions and stock adjustments.
- Modify `src/app/actions.ts`: export control-center Server Actions.
- Modify `src/app/pos-workbench.tsx`: add the Control tab and pass current role/store context.
- Create focused tests for each server and action boundary before implementation.
- Create `docs/17-operations-control-center.md`: portfolio-facing explanation of the production problems solved.

## Task 1: Demo Control Service

- [ ] Write `src/server/demo/control-center.test.ts` first.
- [ ] Verify it fails because `loadDemoControlCenter`, `fulfillDemoOrder`, `refundDemoOrder`, and `adjustDemoStock` do not exist.
- [ ] Implement `src/server/demo/control-center.ts`.
- [ ] Verify `npm run test -- src/server/demo/control-center.test.ts` passes.

Required behavior:

- Owner sees all active stores in recent-order and inventory-option read models.
- Manager sees only assigned stores.
- Staff can load actionable orders for assigned stores and fulfill paid orders.
- Staff receives a UI-safe error when attempting refund or stock adjustment.
- Refund reason and stock adjustment note are validated by existing services.
- Dates returned to the UI are ISO strings.

## Task 2: Prisma Control Repository

- [ ] Write `src/server/demo/control-prisma-repository.test.ts` first.
- [ ] Verify it fails because `createPrismaControlCenterRepository` does not exist.
- [ ] Implement tenant-scoped, store-scoped Prisma reads.
- [ ] Verify `npm run test -- src/server/demo/control-prisma-repository.test.ts` passes.

Required query guarantees:

- `order.findMany` always filters by `organizationId`.
- Non-owner roles add `storeId in assignedStoreIds`.
- Recent orders include store, payment snapshot, created/paid/fulfilled/refunded/cancelled timestamps, and are sorted newest first.
- Inventory options include only active stores, active SKUs, balance quantity, and low-stock threshold.

## Task 3: Server Action Handlers

- [ ] Write `src/app/control-action-handlers.test.ts` first.
- [ ] Verify it fails because `createControlActionHandlers` does not exist.
- [ ] Implement action wiring and revalidation only after successful mutations.
- [ ] Export the actions from `src/app/actions.ts`.
- [ ] Verify `npm run test -- src/app/control-action-handlers.test.ts` passes.

Mutation actions:

- `fulfillOrderAction({ role, orderId })`
- `refundOrderAction({ role, orderId, reason })`
- `adjustStockAction({ role, storeId, skuId, quantityDelta, note })`

## Task 4: Control Center UI

- [ ] Create `src/app/control-center.tsx`.
- [ ] Add a `Control` tab in `src/app/pos-workbench.tsx`.
- [ ] Keep POS, reporting, and control workflows visually separate.
- [ ] Show disabled/empty/error states for no paid orders, denied refunds, and denied adjustments.
- [ ] Verify text fits at desktop and mobile widths.

UI rules:

- The table shows recent orders and only enables fulfillment when status is `PAID`.
- The refund form requires a selected paid or fulfilled order and a reason.
- The stock adjustment form requires store, SKU, non-zero integer delta, and note.
- Staff can use fulfillment but sees refund/adjustment denial from the server.

## Task 5: Documentation and Verification

- [ ] Add `docs/17-operations-control-center.md` explaining why this is a production problem.
- [ ] Run `npm run test`.
- [ ] Run `npm run prisma:validate`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Browser-verify POS sale -> payment -> Control fulfillment, plus manager stock adjustment and staff denial.
- [ ] Merge to `main` and push to GitHub.

