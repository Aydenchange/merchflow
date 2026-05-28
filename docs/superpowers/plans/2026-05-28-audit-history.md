# Audit History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an audit history surface that explains high-risk order, refund, and inventory changes by actor, store, time, and metadata.

**Architecture:** Implement a read-only audit service that resolves role/store scope, then query `AuditLog` and `StockLedger` through a Prisma read repository. Expose the read model through a demo orchestration layer and Next.js Server Action, then render it as a top-level `Audit` tab.

**Tech Stack:** Next.js App Router, Server Actions, React client component, Prisma, PostgreSQL, Vitest, TypeScript.

---

## Task 1: Audit Service

- [ ] Write `src/server/audit/service.test.ts`.
- [ ] Verify it fails because `loadAuditTrail` does not exist.
- [ ] Implement `src/server/audit/types.ts`, `src/server/audit/errors.ts`, and `src/server/audit/service.ts`.
- [ ] Verify owner all-store, manager assigned-store, explicit store filter, staff denial, and invalid limit behavior.

## Task 2: Prisma Repository

- [ ] Write `src/server/audit/prisma-repository.test.ts`.
- [ ] Verify it fails because `createPrismaAuditRepository` does not exist.
- [ ] Implement `src/server/audit/prisma-repository.ts`.
- [ ] Ensure both audit and stock queries filter by tenant and store scope, include actor/store/SKU labels, and sort newest first.

## Task 3: Demo and Server Actions

- [ ] Write `src/server/demo/audit.test.ts` and `src/app/audit-action-handlers.test.ts`.
- [ ] Implement `src/server/demo/audit.ts` and `src/app/audit-action-handlers.ts`.
- [ ] Export `loadAuditTrailAction` from `src/app/actions.ts`.
- [ ] Verify read actions do not revalidate the app route.

## Task 4: UI

- [ ] Create `src/app/audit-trail.tsx`.
- [ ] Add an `Audit` tab to `src/app/pos-workbench.tsx`.
- [ ] Render audit events and stock movements as separate tables with empty/error states.
- [ ] Keep staff denial visible as a server-returned error.

## Task 5: Documentation and Verification

- [ ] Add `docs/18-audit-history.md`.
- [ ] Run `npm run test`.
- [ ] Run `npm run prisma:validate`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Browser verify owner/manager audit loads and staff denial.
- [ ] Merge to `main` and push.

