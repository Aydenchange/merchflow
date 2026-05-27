# MerchFlow Operations Reports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add low-stock and basic sales reporting services scoped by organization, role, store access, and date range.

**Architecture:** Implement a read-only reports service that resolves accessible store scope from `AuthContext`, denies staff report access, validates date ranges, and delegates query execution to a repository. The Prisma adapter performs scoped reads for low-stock balances, sales aggregates, refunded totals, and top SKU quantities without mutating inventory, orders, or payments.

**Tech Stack:** TypeScript, Vitest, Prisma 7, PostgreSQL.

---

## Scope

Included:

- Operations reports design note.
- Report-specific input validation error.
- Shared reports service with store-scope resolution.
- Low-stock list for owner and manager.
- Basic sales report with gross paid/fulfilled sales, refunded totals, and top SKUs.
- Service tests for role denial, store scope, date validation, and repository input.
- Prisma repository tests for low-stock query shape and sales aggregation query shape.

Excluded:

- Dashboard UI.
- CSV export.
- Charts.
- Real tax reporting.
- Refund-date based reconciliation reports.
- Large analytics warehouse design.

## File Structure

- `docs/14-operations-reports.md`: Explains reporting boundaries and trade-offs.
- `src/server/reports/errors.ts`: Report-specific validation error.
- `src/server/reports/types.ts`: Inputs, scope, low-stock rows, and sales report result types.
- `src/server/reports/service.ts`: Pure service functions for low-stock and sales reports.
- `src/server/reports/service.test.ts`: TDD coverage for service behavior.
- `src/server/reports/prisma-repository.ts`: Prisma adapter for report queries.
- `src/server/reports/prisma-repository.test.ts`: Unit tests for Prisma adapter query shape and mapping.

## Task 1: Document Operations Reports Boundary

**Files:**

- Create: `docs/14-operations-reports.md`

- [ ] **Step 1: Create design document**

Create `docs/14-operations-reports.md`:

```md
# Operations Reports Design

## Purpose

This document defines the first read-only operations reporting boundary for MerchFlow.

The transaction flows now create orders, payments, stock ledgers, refunds, and lifecycle events. This reporting slice helps owner and manager users answer two store operations questions:

- Which active SKUs are at or below their configured low-stock threshold?
- How much paid sales volume happened in a date range, and which SKUs sold most?

## Why This Layer Exists

Reports should not bypass authorization just because they are read-only.

The service must:

- deny inactive memberships
- deny staff access to reports
- scope managers to assigned stores
- allow owners to query all stores or selected stores
- validate sales report date ranges
- exclude archived SKUs from the low-stock list
- keep refunded orders visible separately from gross completed sales

## V1 Rules

- Owner can view all-store reports or selected-store reports.
- Manager can view only assigned-store reports.
- Staff cannot view reports in V1.
- Low-stock means `lowStockThreshold > 0` and `quantityOnHand <= lowStockThreshold`.
- Low-stock results exclude inactive stores and archived SKUs.
- Sales report date range filters by `paidAt`.
- Gross sales include `PAID` and `FULFILLED` orders.
- Refunded orders are reported separately and are not hidden inside gross sales.
- Top SKUs are calculated from non-refunded completed sales.

## Production Problems This Design Handles

- Prevents a manager from reporting on another branch.
- Avoids treating default threshold `0` as a configured low-stock alert.
- Keeps refunds visible rather than silently subtracting them from completed sales.
- Uses scoped query inputs so repository code cannot accidentally query outside the tenant.

## Interview Talking Points

- "I treated reports as authorization-sensitive even though they are read-only."
- "I separated refunded totals from gross completed sales because hiding reversals makes store performance hard to audit."
- "I used paidAt for sales report date ranges because payment success is the point where the sale is committed."
- "I made low-stock threshold zero mean no alert, which avoids noisy default data."
```

- [ ] **Step 2: Commit design document**

Run:

```powershell
git add docs/14-operations-reports.md docs/superpowers/plans/2026-05-27-operations-reports.md
git commit -m "docs: plan operations reports"
```

Expected:

- Commit records report decisions before implementation.

## Task 2: Add Reports Service With TDD

**Files:**

- Create: `src/server/reports/service.test.ts`
- Create: `src/server/reports/errors.ts`
- Create: `src/server/reports/types.ts`
- Create: `src/server/reports/service.ts`

- [ ] **Step 1: Write failing tests**

Create service tests covering:

- owner low-stock query uses all stores when no store filter is provided
- owner selected-store low-stock query uses selected stores
- manager low-stock query defaults to assigned stores
- manager cannot request unassigned stores
- staff cannot view reports
- sales report validates `dateFrom <= dateTo`
- sales report passes date range, top SKU limit, and resolved store scope to repository

- [ ] **Step 2: Run test to verify RED**

Run:

```powershell
npm run test -- src/server/reports/service.test.ts
```

Expected:

- FAIL because reports service files do not exist.

- [ ] **Step 3: Implement reports service**

Create report errors, types, and service functions:

- `listLowStockItems`
- `getBasicSalesReport`

The implementation must:

- call `assertActiveMembership`
- reject `STAFF` with `AuthorizationError("Role cannot view reports")`
- dedupe requested store ids
- allow owners to use all stores when no store ids are provided
- scope managers to assigned stores when no store ids are provided
- reject manager access to unassigned store ids
- reject empty selected-store filters
- validate sales report date ranges
- default `topSkuLimit` to `5`

- [ ] **Step 4: Run test to verify GREEN**

Run:

```powershell
npm run test -- src/server/reports/service.test.ts
```

Expected:

- PASS.

- [ ] **Step 5: Commit reports service**

Run:

```powershell
git add src/server/reports/errors.ts src/server/reports/types.ts src/server/reports/service.ts src/server/reports/service.test.ts
git commit -m "feat: add operations reports service"
```

Expected:

- Commit records tested reports service behavior.

## Task 3: Add Prisma Reports Repository

**Files:**

- Create: `src/server/reports/prisma-repository.test.ts`
- Create: `src/server/reports/prisma-repository.ts`

- [ ] **Step 1: Write failing Prisma adapter tests**

Create Prisma repository tests covering:

- low-stock query scopes by organization, active store, active SKU, threshold greater than zero, and selected stores
- low-stock mapping filters rows where quantity exceeds threshold
- sales report aggregates paid/fulfilled orders separately from refunded orders
- top SKU mapping preserves grouped quantity order and attaches SKU snapshots

- [ ] **Step 2: Run test to verify RED**

Run:

```powershell
npm run test -- src/server/reports/prisma-repository.test.ts
```

Expected:

- FAIL because Prisma reports repository does not exist.

- [ ] **Step 3: Implement Prisma reports repository**

Create `src/server/reports/prisma-repository.ts`.

The implementation must:

- expose `createPrismaReportsRepository`
- use `inventoryBalance.findMany` for low-stock candidates and filter `quantityOnHand <= lowStockThreshold` in the adapter
- exclude archived SKUs and inactive stores
- use `order.aggregate` for gross completed sales
- use `order.aggregate` for refunded sales shown separately
- use `orderItem.groupBy` to calculate top SKU quantities from completed sales
- fetch SKU display fields for top SKU rows
- return zero totals when aggregate sums are null

- [ ] **Step 4: Run tests and build**

Run:

```powershell
npm run test -- src/server/reports/prisma-repository.test.ts
npm run build
```

Expected:

- PASS.

- [ ] **Step 5: Commit Prisma repository**

Run:

```powershell
git add src/server/reports/prisma-repository.ts src/server/reports/prisma-repository.test.ts
git commit -m "feat: add prisma operations reports repository"
```

Expected:

- Commit records Prisma reports adapter.

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

- Covers low-stock list.
- Covers basic sales report.
- Covers role and store-scope authorization.
- Covers refunded orders shown separately.
- Excludes dashboard UI and export features.

Placeholder scan:

- No placeholder markers are used.

Type consistency:

- Report store scope uses `allStores` plus `storeIds`.
- Sales report status groups match Prisma `OrderStatus`.
- Low-stock result fields map to inventory balance, store, and SKU records.
