# Reorder Planning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a production-shaped reorder planning slice to the operations dashboard so owners and managers can turn low-stock rows into actionable replenishment quantities.

**Architecture:** Keep this as a read-only reporting feature, not a purchase-order module. The reports service owns authorization and store scoping, the Prisma reports repository maps active inventory rows into reorder suggestions, and the Operations dashboard renders the result alongside low stock and sales. Suggested quantity is derived from `lowStockThreshold * 2 - quantityOnHand`, so the system shows a simple target stock policy without introducing supplier workflows.

**Tech Stack:** Next.js Server Actions, React client components, TypeScript, Prisma, Vitest.

---

### Task 1: Reports Service Types And TDD

**Files:**
- Modify: `src/server/reports/types.ts`
- Modify: `src/server/reports/service.ts`
- Test: `src/server/reports/service.test.ts`

- [ ] **Step 1: Write failing tests**

Add tests proving `listReorderSuggestions` uses the same authorization and store scoping as low-stock reports, denies staff, and rejects empty explicit store filters.

- [ ] **Step 2: Run red test**

Run: `npm run test -- src/server/reports/service.test.ts`
Expected: fail because `listReorderSuggestions` does not exist.

- [ ] **Step 3: Implement minimal service API**

Add `ReorderSuggestion`, `ReorderSuggestionInput`, `ReorderSuggestionQuery`, repository method `listReorderSuggestions`, and service function `listReorderSuggestions`.

- [ ] **Step 4: Run green test**

Run: `npm run test -- src/server/reports/service.test.ts`
Expected: pass.

### Task 2: Prisma Reports Repository

**Files:**
- Modify: `src/server/reports/prisma-repository.ts`
- Test: `src/server/reports/prisma-repository.test.ts`

- [ ] **Step 1: Write failing repository test**

Add a test that active inventory balances at or below threshold are returned as reorder suggestions with urgency and suggested reorder quantity.

- [ ] **Step 2: Run red test**

Run: `npm run test -- src/server/reports/prisma-repository.test.ts`
Expected: fail because the repository method is missing.

- [ ] **Step 3: Implement Prisma mapping**

Reuse inventory balance query shape, filter active stores/SKUs, calculate target quantity as `lowStockThreshold * 2`, suggested reorder quantity as `target - quantityOnHand`, and urgency as `OUT_OF_STOCK`, `CRITICAL`, or `LOW`.

- [ ] **Step 4: Run green test**

Run: `npm run test -- src/server/reports/prisma-repository.test.ts`
Expected: pass.

### Task 3: Demo Operations Dashboard Boundary

**Files:**
- Modify: `src/server/demo/operations.ts`
- Test: `src/server/demo/operations.test.ts`
- Modify: `src/app/operations-action-handlers.test.ts`

- [ ] **Step 1: Write failing tests**

Assert the dashboard loads reorder suggestions in parallel with low-stock and sales reports and serializes them in `DemoOperationsDashboard`.

- [ ] **Step 2: Run red tests**

Run: `npm run test -- src/server/demo/operations.test.ts src/app/operations-action-handlers.test.ts`
Expected: fail because dashboard data has no `reorderSuggestions`.

- [ ] **Step 3: Implement dashboard plumbing**

Call `listReorderSuggestions`, include it in the dashboard result, and update action-handler fixture types.

- [ ] **Step 4: Run green tests**

Run: `npm run test -- src/server/demo/operations.test.ts src/app/operations-action-handlers.test.ts`
Expected: pass.

### Task 4: Operations Dashboard UI And Docs

**Files:**
- Modify: `src/app/operations-dashboard.tsx`
- Create: `docs/20-reorder-planning.md`

- [ ] **Step 1: Add UI rendering**

Add a metric for reorder rows and a compact reorder suggestions table showing store, SKU, current stock, target stock, suggested quantity, and urgency.

- [ ] **Step 2: Add documentation**

Document why this remains a read-only planning workflow and how it differs from purchase orders.

- [ ] **Step 3: Verify**

Run:
- `npm run test`
- `npm run prisma:validate`
- `npm run lint`
- `npm run build`

Expected: all pass.

### Task 5: Browser Verification And Push

**Files:**
- No code changes expected.

- [ ] **Step 1: Browser verify**

Open the local app, load Operations, refresh the dashboard, and confirm reorder suggestions render without console errors.

- [ ] **Step 2: Commit and push**

Commit as `feat: add reorder planning` and fast-forward merge into `main`, then push `main` to GitHub.
