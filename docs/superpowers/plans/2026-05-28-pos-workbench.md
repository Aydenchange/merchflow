# POS Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first usable MerchFlow app screen: a role-aware, store-aware POS workbench that scans barcodes, creates pending orders, and simulates payment success.

**Architecture:** Keep domain logic in server services, add a demo orchestration layer for app-facing DTOs, expose thin Next.js Server Actions, and render an interactive Client Component inside a Server Component page. The UI never imports Prisma and every mutation reuses existing authorization checks.

**Tech Stack:** Next.js 16 App Router, React 19.2, TypeScript, Tailwind CSS v4, Prisma 7, Vitest.

---

### Task 1: Demo Workbench Service

**Files:**
- Create: `src/server/demo/types.ts`
- Create: `src/server/demo/workbench.ts`
- Create: `src/server/demo/workbench.test.ts`

- [ ] **Step 1: Write failing tests**

Add tests for:

- `resolveDemoUserId` maps `owner`, `manager`, and `staff` to seed user IDs.
- `buildDemoContext` returns serializable user, organization, and visible store options.
- `lookupBarcodeForCart` trims barcode input and returns low-stock metadata.
- `createDemoPosOrder` forwards aggregated cart items to the POS order service.
- `simulateDemoPaymentSuccess` accepts a supplied provider event ID so duplicate replay can be demonstrated.
- service functions convert expected domain errors to `{ ok: false, message }`.

Run:

```bash
npm run test -- src/server/demo/workbench.test.ts
```

Expected: FAIL because `src/server/demo/workbench.ts` does not exist.

- [ ] **Step 2: Implement service**

Create a dependency-injected service so tests can use in-memory fakes while production uses Prisma repositories.

The service exports app-facing functions:

- `loadDemoContext`
- `lookupBarcodeForCart`
- `createDemoPosOrder`
- `simulateDemoPaymentSuccess`

- [ ] **Step 3: Verify service tests pass**

Run:

```bash
npm run test -- src/server/demo/workbench.test.ts
```

Expected: PASS.

### Task 2: Demo Prisma Repository

**Files:**
- Create: `src/server/demo/prisma-repository.ts`
- Create: `src/server/demo/prisma-repository.test.ts`

- [ ] **Step 1: Write failing repository tests**

Add integration tests against the test database shape for:

- owner sees all active demo stores;
- staff sees only assigned stores;
- payment status lookup returns order and payment status after order creation.

Run:

```bash
npm run test -- src/server/demo/prisma-repository.test.ts
```

Expected: FAIL because the Prisma demo repository does not exist.

- [ ] **Step 2: Implement repository**

Create `createPrismaDemoRepository(db)` with methods:

- `findUserProfileById(userId)`
- `findVisibleStores(context)`
- `findPaymentSnapshot(paymentId)`

- [ ] **Step 3: Verify repository tests pass**

Run:

```bash
npm run test -- src/server/demo/prisma-repository.test.ts
```

Expected: PASS.

### Task 3: Next.js Server Actions

**Files:**
- Create: `src/app/actions.ts`

- [ ] **Step 1: Write compile-facing implementation through tested service**

Server Actions will be thin wrappers around the tested demo workbench service:

- `loadDemoContextAction(role)`
- `lookupSkuAction(input)`
- `createPosOrderAction(input)`
- `simulatePaymentSuccessAction(input)`

Each action uses `getDb()`, creates Prisma repositories, calls the workbench function, and calls `revalidatePath("/")` after order or payment mutations.

- [ ] **Step 2: Verify TypeScript through build**

Run:

```bash
npm run build
```

Expected: PASS after UI is also implemented.

### Task 4: App Shell and POS UI

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`
- Create: `src/app/pos-workbench.tsx`

- [ ] **Step 1: Implement Server Component page**

Load the owner demo context on the server and pass it into the client workbench.

- [ ] **Step 2: Implement Client Component**

Render:

- top app shell with organization, role, and store context;
- barcode scanner form;
- cart table with quantity controls;
- order summary;
- payment simulation controls;
- operational event log.

- [ ] **Step 3: Apply React review checklist**

Check that hooks are unconditional, buttons have semantic labels, list keys use stable IDs, and client state is derived instead of mirrored where possible.

### Task 5: Full Verification and Publishing

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

- [ ] **Step 2: Run local browser verification**

Start the dev server and verify:

- the app loads at `http://localhost:3000`;
- role switching changes visible stores;
- scanning barcode `9555000000012` adds to cart;
- repeated scan increments quantity;
- creating an order displays `PENDING_PAYMENT`;
- simulated payment displays processed or review result.

- [ ] **Step 3: Commit, merge, push**

Run:

```bash
git add docs src
git commit -m "feat: add pos workbench"
git switch main
git merge --ff-only feat/pos-workbench
npm run test
npm run prisma:validate
npm run lint
npm run build
git push origin main
git branch -d feat/pos-workbench
```
