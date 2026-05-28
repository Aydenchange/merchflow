# V1 Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining V1 product gaps by exposing unpaid-order cancellation in the Control Center and documenting the V1 completion boundary.

**Architecture:** Reuse the existing order lifecycle service and Prisma lifecycle repository. Add only demo boundary, Server Action, and Control Center UI plumbing so the already-tested backend capability becomes operable from the portfolio app. Keep catalog CRUD and purchase orders documented as intentional non-goals rather than adding shallow admin screens.

**Tech Stack:** Next.js Server Actions, React client components, TypeScript, Prisma, Vitest.

---

### Task 1: Demo Control Cancellation Boundary

**Files:**
- Modify: `src/server/demo/control-center.ts`
- Test: `src/server/demo/control-center.test.ts`

- [ ] **Step 1: Write failing test**

Add a test for `cancelDemoOrder` proving staff can cancel a `PENDING_PAYMENT` order in an assigned store, reason is passed through, and timestamps serialize.

- [ ] **Step 2: Run red test**

Run: `npm run test -- src/server/demo/control-center.test.ts`
Expected: fail because `cancelDemoOrder` does not exist.

- [ ] **Step 3: Implement minimal boundary**

Call existing `cancelPendingOrder`, serialize `cancelledAt`, and return UI-safe errors.

- [ ] **Step 4: Run green test**

Run: `npm run test -- src/server/demo/control-center.test.ts`
Expected: pass.

### Task 2: Server Action Wiring

**Files:**
- Modify: `src/app/control-action-handlers.ts`
- Modify: `src/app/actions.ts`
- Test: `src/app/control-action-handlers.test.ts`

- [ ] **Step 1: Write failing action test**

Assert `cancelOrderAction` calls workbench cancellation and revalidates `/` only on success.

- [ ] **Step 2: Run red test**

Run: `npm run test -- src/app/control-action-handlers.test.ts`
Expected: fail because cancellation action is missing.

- [ ] **Step 3: Implement action**

Export `CancelDemoOrderInput`, add workbench method, add handler, and expose `cancelOrderAction`.

- [ ] **Step 4: Run green test**

Run: `npm run test -- src/app/control-action-handlers.test.ts`
Expected: pass.

### Task 3: Control Center UI And V1 Docs

**Files:**
- Modify: `src/app/control-center.tsx`
- Create: `docs/21-v1-completion.md`

- [ ] **Step 1: Add UI**

Add a Cancel button for `PENDING_PAYMENT` orders and a small cancellation reason input. Show success/error in Control events.

- [ ] **Step 2: Document V1 completion**

Summarize completed V1 capabilities, production problems demonstrated, and intentional non-goals.

- [ ] **Step 3: Verify**

Run:
- `npm run test`
- `npm run prisma:validate`
- `npm run lint`
- `npm run build`

Expected: all pass.

### Task 4: Browser Verification And Push

**Files:**
- No code changes expected.

- [ ] **Step 1: Browser verify**

Open the local app, create a pending order, refresh Control Center, cancel it, and confirm the order becomes `CANCELLED` without console errors.

- [ ] **Step 2: Commit and push**

Commit as `feat: complete v1 control workflows`, fast-forward merge into `main`, and push `main` to GitHub.
