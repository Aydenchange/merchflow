# Project Structure Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize the full MerchFlow codebase into clear frontend features and backend modules, then split the largest UI components without changing behavior.

**Architecture:** Keep `src/app` as a thin Next.js route/action shell. Move frontend feature code into `src/features`, backend domain modules into `src/server/modules`, and keep `src/server/demo` as application orchestration. Use path aliases to make cross-layer dependencies explicit and resilient to file movement.

**Tech Stack:** Next.js, React, TypeScript, Prisma, Vitest.

---

### Task 1: Establish Stable Imports And Characterization Baseline

- [ ] Run the complete test/build baseline.
- [ ] Add path aliases for features, server modules, demo, domain, and shared code.
- [ ] Preserve the existing user formatting change in `pos-workbench.tsx`.

### Task 2: Move Backend Business Modules

- [ ] Move backend modules into `src/server/modules`.
- [ ] Rewrite cross-module imports to aliases.
- [ ] Keep `src/server/demo` as the application orchestration layer.
- [ ] Run all backend tests.

### Task 3: Move Frontend Feature Code

- [ ] Move POS, Control Center, Operations, and Audit UI/action/model files into `src/features`.
- [ ] Keep `src/app/actions.ts` as the public Server Action facade.
- [ ] Update route and action imports.
- [ ] Run all frontend/action tests.

### Task 4: Split Large Components

- [ ] Extract shared UI primitives and formatters.
- [ ] Split `ControlCenter` into focused panels and tables.
- [ ] Split `PosWorkbench` into focused scanner/cart/order/payment/event components while preserving the existing formatting change.
- [ ] Split Operations and Audit tables/filters where useful.
- [ ] Keep state orchestration in feature containers/hooks.

### Task 5: Document And Verify

- [ ] Add ER and architecture documentation.
- [ ] Run `npm run test`.
- [ ] Run `npm run prisma:validate`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Browser smoke-test POS, Operations, Control, and Audit.
