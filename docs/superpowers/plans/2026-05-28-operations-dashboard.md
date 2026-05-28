# Operations Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only owner/manager operations dashboard that shows low-stock rows, sales totals, refunded totals, and top SKUs from existing report services.

**Architecture:** Keep report authorization in `src/server/reports/service.ts`. Add a demo operations orchestration layer that maps UI role/date/store inputs to existing report services and serializable DTOs. Expose one read-only Server Action and render an Operations tab next to the POS workbench.

**Tech Stack:** Next.js 16 App Router, React 19.2, TypeScript, Tailwind CSS v4, Prisma 7, Vitest.

---

### Task 1: Demo Operations Service

**Files:**
- Create: `src/server/demo/operations.ts`
- Create: `src/server/demo/operations.test.ts`

- [ ] **Step 1: Write failing tests**

Add tests covering:

- owner loads all-store low-stock and sales report with no store filter;
- manager loads assigned-store reports;
- staff receives a UI-safe access denied result;
- invalid date range returns a UI-safe error;
- report date fields are returned as ISO strings.

Run:

```bash
npm run test -- src/server/demo/operations.test.ts
```

Expected: FAIL because the service does not exist.

- [ ] **Step 2: Implement service**

Create `loadDemoOperationsDashboard(input, dependencies)`.

Input:

- `role`
- optional `storeIds`
- `dateFrom`
- `dateTo`
- optional `topSkuLimit`

Dependencies:

- `authRepository`
- `reportsRepository`

Output:

- `DemoActionResult<DemoOperationsDashboard>`

- [ ] **Step 3: Verify service tests pass**

Run:

```bash
npm run test -- src/server/demo/operations.test.ts
```

Expected: PASS.

### Task 2: Operations Server Action

**Files:**
- Create: `src/app/operations-action-handlers.ts`
- Create: `src/app/operations-action-handlers.test.ts`
- Modify: `src/app/actions.ts`

- [ ] **Step 1: Write failing handler tests**

Add tests verifying:

- handler creates Prisma auth and reports repositories lazily;
- handler forwards the input to `loadDemoOperationsDashboard`;
- handler does not call `revalidatePath` because report loading is read-only.

Run:

```bash
npm run test -- src/app/operations-action-handlers.test.ts
```

Expected: FAIL because action handlers do not exist.

- [ ] **Step 2: Implement handler and action export**

Create `createOperationsActionHandlers` and export `loadOperationsDashboardAction` from `src/app/actions.ts`.

- [ ] **Step 3: Verify handler tests pass**

Run:

```bash
npm run test -- src/app/operations-action-handlers.test.ts
```

Expected: PASS.

### Task 3: Operations UI

**Files:**
- Create: `src/app/operations-dashboard.tsx`
- Modify: `src/app/pos-workbench.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Add Operations tab to the app shell**

Add a segmented view control with `POS` and `Operations`.

- [ ] **Step 2: Render dashboard controls**

Dashboard controls:

- store scope: all stores for owner, assigned stores for manager/staff context options;
- period: last 7 days, last 30 days;
- refresh button.

- [ ] **Step 3: Render report surfaces**

Render:

- gross sales;
- completed order count;
- refunded sales and order count;
- top SKUs table;
- low-stock table;
- access-denied state for staff.

- [ ] **Step 4: Apply React checklist**

Check hook placement, stable list keys, semantic buttons/forms, accessible labels, and text overflow.

### Task 4: Seed Demonstration Data

**Files:**
- Modify: `prisma/seed.ts`

- [ ] **Step 1: Add a low-stock demo SKU**

Add a second active SKU with low stock in at least one store so Operations has meaningful data immediately after `npm run db:seed`.

- [ ] **Step 2: Verify seed**

Run:

```bash
npm run db:seed
```

Expected: seed completes and demo low-stock row is present in Operations.

### Task 5: Verification and Publishing

**Files:**
- Modify as needed based on verification failures.

- [ ] **Step 1: Run full automated verification**

Run:

```bash
npm run test
npm run prisma:validate
npm run lint
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 2: Browser verification**

Verify:

- app loads at `http://localhost:3000`;
- Operations tab loads for owner;
- owner sees low-stock data after seed;
- manager sees only assigned store options;
- staff sees reports access denied;
- no console errors.

- [ ] **Step 3: Commit, merge, push**

Run:

```bash
git add docs src prisma
git commit -m "feat: add operations dashboard"
git switch main
git merge --ff-only feat/operations-dashboard
npm run test
npm run prisma:validate
npm run lint
npm run build
git push origin main
git branch -d feat/operations-dashboard
```
