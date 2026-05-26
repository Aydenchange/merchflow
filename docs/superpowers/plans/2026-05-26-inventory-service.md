# MerchFlow Inventory Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a production-shaped inventory service for manual stock adjustments with authorization, audit-friendly input validation, atomic balance updates, and stock ledger creation.

**Architecture:** Keep UI and Server Actions out of this slice. Implement a pure service that depends on `AuthContext` and a repository interface, then add a Prisma repository adapter that owns the transaction boundary. The service derives ledger reason from quantity direction, while the repository prevents negative stock under concurrent writes.

**Tech Stack:** TypeScript, Vitest, Prisma 7, PostgreSQL.

---

## Scope

Included:

- Inventory service design note.
- Inventory domain errors.
- Repository contract for atomic stock adjustment.
- `adjustStock` service with permission checks, integer delta validation, and required adjustment note.
- Tests for positive adjustment, negative adjustment, zero/fractional quantity rejection, blank note rejection, unauthorized role, unauthorized store, and insufficient stock propagation.
- Prisma-backed inventory repository that updates balance and creates stock ledger in one transaction.

Excluded:

- Inventory UI.
- Server Actions.
- Sale payment confirmation stock deduction.
- Stock transfer between stores.
- Barcode scanning UI.
- Low-stock notifications.

## File Structure

- `docs/09-inventory-service.md`: Explains inventory service boundary and production concerns.
- `src/server/inventory/errors.ts`: Inventory-specific domain errors.
- `src/server/inventory/types.ts`: Service input, repository input, and result types.
- `src/server/inventory/service.ts`: Pure inventory service function.
- `src/server/inventory/service.test.ts`: TDD coverage for business behavior.
- `src/server/inventory/prisma-repository.ts`: Prisma transaction adapter.

## Task 1: Document Inventory Service Boundary

**Files:**

- Create: `docs/09-inventory-service.md`

- [ ] **Step 1: Create design document**

Create `docs/09-inventory-service.md`:

```md
# Inventory Service Design

## Purpose

This document defines the first inventory service boundary for MerchFlow.

Small retail stores usually discover inventory changes through receiving stock, cycle counts, damaged goods, shrinkage, and paid sales. This slice covers manual stock adjustments. Paid-sale stock deduction will be wired into the order/payment flow later.

## Why This Layer Exists

Inventory is a production risk area because a simple CRUD update can create incorrect stock.

The service must:

- enforce that only owner/manager users can adjust stock
- restrict managers to assigned stores
- reject ambiguous adjustments such as zero quantity or blank notes
- derive ledger reason from quantity direction instead of trusting the client
- require the repository to update balance and ledger in one transaction
- prevent negative stock at the database write boundary

## V1 Rules

- Staff cannot adjust stock.
- Owner can adjust stock in any store.
- Manager can adjust stock only in assigned stores.
- Manual stock adjustment quantity must be a non-zero integer.
- Manual stock adjustment requires a human-readable note.
- Positive adjustment creates `ADJUSTMENT_IN`.
- Negative adjustment creates `ADJUSTMENT_OUT`.
- Stock balance must never go below zero.
- Every successful adjustment creates a `StockLedger` row.

## Production Problems This Design Handles

- Concurrent adjustments must not let stock drop below zero.
- The UI must not decide ledger reason because client input can be inconsistent.
- Stock changes need an audit trail for store operations and dispute resolution.
- Service tests cover authorization and validation without depending on Prisma.
- Prisma repository owns the transaction because only the adapter can make balance and ledger writes atomic.

## Interview Talking Points

- "I separated business authorization from the Prisma adapter, but kept the concurrency guard inside the transaction because service-level checks alone are stale under concurrent requests."
- "I derived stock ledger reason from the signed quantity delta so the client cannot send a negative adjustment with an inbound reason."
- "I required notes for manual adjustments because inventory changes need operational accountability."
- "I treated stock ledger as an append-only audit trail and inventory balance as the current read model."
```

- [ ] **Step 2: Commit design document**

Run:

```powershell
git add docs/09-inventory-service.md
git commit -m "docs: define inventory service"
```

Expected:

- Commit records inventory service decisions before implementation.

## Task 2: Add Inventory Service With TDD

**Files:**

- Create: `src/server/inventory/service.test.ts`
- Create: `src/server/inventory/errors.ts`
- Create: `src/server/inventory/types.ts`
- Create: `src/server/inventory/service.ts`

- [ ] **Step 1: Write failing tests**

Create `src/server/inventory/service.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { AuthContext } from "../authz/types";
import { InsufficientStockError, InvalidStockAdjustmentError } from "./errors";
import {
  adjustStock,
  type ApplyStockAdjustmentInput,
  type InventoryRepository,
  type StockAdjustmentResult,
} from "./service";

function authContext(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    userId: "user_1",
    membershipId: "membership_1",
    organizationId: "org_1",
    role: "MANAGER",
    status: "ACTIVE",
    assignedStoreIds: ["store_1"],
    ...overrides,
  };
}

function adjustmentResult(
  overrides: Partial<StockAdjustmentResult> = {},
): StockAdjustmentResult {
  return {
    organizationId: "org_1",
    storeId: "store_1",
    skuId: "sku_1",
    quantityDelta: 5,
    quantityOnHand: 17,
    lowStockThreshold: 3,
    reason: "ADJUSTMENT_IN",
    ledgerId: "ledger_1",
    ...overrides,
  };
}

function repository(
  overrides: Partial<InventoryRepository> = {},
): InventoryRepository {
  return {
    async applyStockAdjustment(input) {
      return adjustmentResult({
        organizationId: input.organizationId,
        storeId: input.storeId,
        skuId: input.skuId,
        quantityDelta: input.quantityDelta,
        reason: input.reason,
      });
    },
    ...overrides,
  };
}

describe("inventory service", () => {
  it("allows manager to increase stock in an assigned store", async () => {
    const calls: ApplyStockAdjustmentInput[] = [];

    const result = await adjustStock(
      authContext({ role: "MANAGER", assignedStoreIds: ["store_1"] }),
      {
        storeId: "store_1",
        skuId: "sku_1",
        quantityDelta: 5,
        note: " Received supplier delivery ",
      },
      repository({
        async applyStockAdjustment(input) {
          calls.push(input);
          return adjustmentResult({
            quantityDelta: input.quantityDelta,
            reason: input.reason,
          });
        },
      }),
    );

    expect(calls).toEqual([
      {
        organizationId: "org_1",
        storeId: "store_1",
        skuId: "sku_1",
        quantityDelta: 5,
        reason: "ADJUSTMENT_IN",
        actorMembershipId: "membership_1",
        note: "Received supplier delivery",
      },
    ]);
    expect(result).toEqual(
      adjustmentResult({
        quantityDelta: 5,
        reason: "ADJUSTMENT_IN",
      }),
    );
  });

  it("derives outbound reason for negative stock adjustment", async () => {
    const calls: ApplyStockAdjustmentInput[] = [];

    await adjustStock(
      authContext({ role: "OWNER", assignedStoreIds: [] }),
      {
        storeId: "store_2",
        skuId: "sku_1",
        quantityDelta: -2,
        note: "Damaged items removed",
      },
      repository({
        async applyStockAdjustment(input) {
          calls.push(input);
          return adjustmentResult({
            storeId: input.storeId,
            quantityDelta: input.quantityDelta,
            reason: input.reason,
          });
        },
      }),
    );

    expect(calls[0]).toMatchObject({
      organizationId: "org_1",
      storeId: "store_2",
      skuId: "sku_1",
      quantityDelta: -2,
      reason: "ADJUSTMENT_OUT",
      actorMembershipId: "membership_1",
      note: "Damaged items removed",
    });
  });

  it("rejects zero quantity adjustment", async () => {
    await expect(
      adjustStock(
        authContext(),
        {
          storeId: "store_1",
          skuId: "sku_1",
          quantityDelta: 0,
          note: "No movement",
        },
        repository(),
      ),
    ).rejects.toThrow(InvalidStockAdjustmentError);
  });

  it("rejects fractional quantity adjustment", async () => {
    await expect(
      adjustStock(
        authContext(),
        {
          storeId: "store_1",
          skuId: "sku_1",
          quantityDelta: 1.5,
          note: "Fractional stock",
        },
        repository(),
      ),
    ).rejects.toThrow(InvalidStockAdjustmentError);
  });

  it("rejects blank adjustment note", async () => {
    await expect(
      adjustStock(
        authContext(),
        {
          storeId: "store_1",
          skuId: "sku_1",
          quantityDelta: 1,
          note: "   ",
        },
        repository(),
      ),
    ).rejects.toThrow(InvalidStockAdjustmentError);
  });

  it("denies staff stock adjustment", async () => {
    await expect(
      adjustStock(
        authContext({ role: "STAFF" }),
        {
          storeId: "store_1",
          skuId: "sku_1",
          quantityDelta: 1,
          note: "Correction",
        },
        repository(),
      ),
    ).rejects.toThrow("Role cannot adjust stock");
  });

  it("denies manager stock adjustment outside assigned stores", async () => {
    await expect(
      adjustStock(
        authContext({ role: "MANAGER", assignedStoreIds: ["store_1"] }),
        {
          storeId: "store_2",
          skuId: "sku_1",
          quantityDelta: 1,
          note: "Correction",
        },
        repository(),
      ),
    ).rejects.toThrow("Store access denied");
  });

  it("propagates insufficient stock from repository", async () => {
    await expect(
      adjustStock(
        authContext({ role: "OWNER", assignedStoreIds: [] }),
        {
          storeId: "store_1",
          skuId: "sku_1",
          quantityDelta: -8,
          note: "Shrinkage correction",
        },
        repository({
          async applyStockAdjustment() {
            throw new InsufficientStockError({
              storeId: "store_1",
              skuId: "sku_1",
              quantityOnHand: 3,
              quantityRequested: 8,
            });
          },
        }),
      ),
    ).rejects.toThrow(InsufficientStockError);
  });
});
```

- [ ] **Step 2: Run test to verify RED**

Run:

```powershell
npm run test -- src/server/inventory/service.test.ts
```

Expected:

- FAIL because inventory service files do not exist.

- [ ] **Step 3: Implement inventory service**

Create `src/server/inventory/errors.ts`:

```ts
export class InvalidStockAdjustmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidStockAdjustmentError";
  }
}

export class InsufficientStockError extends Error {
  constructor(input: {
    storeId: string;
    skuId: string;
    quantityOnHand: number;
    quantityRequested: number;
  }) {
    super(
      `Insufficient stock for SKU ${input.skuId} at store ${input.storeId}: requested ${input.quantityRequested}, available ${input.quantityOnHand}`,
    );
    this.name = "InsufficientStockError";
  }
}
```

Create `src/server/inventory/types.ts`:

```ts
export type StockAdjustmentReason = "ADJUSTMENT_IN" | "ADJUSTMENT_OUT";

export type StockAdjustmentInput = {
  storeId: string;
  skuId: string;
  quantityDelta: number;
  note: string;
};

export type ApplyStockAdjustmentInput = {
  organizationId: string;
  storeId: string;
  skuId: string;
  quantityDelta: number;
  reason: StockAdjustmentReason;
  actorMembershipId: string;
  note: string;
};

export type StockAdjustmentResult = {
  organizationId: string;
  storeId: string;
  skuId: string;
  quantityDelta: number;
  quantityOnHand: number;
  lowStockThreshold: number;
  reason: StockAdjustmentReason;
  ledgerId: string;
};
```

Create `src/server/inventory/service.ts`:

```ts
import { assertCanAdjustStock } from "../authz/policy";
import type { AuthContext } from "../authz/types";
import { InvalidStockAdjustmentError } from "./errors";
import type {
  ApplyStockAdjustmentInput,
  StockAdjustmentInput,
  StockAdjustmentReason,
  StockAdjustmentResult,
} from "./types";

export type InventoryRepository = {
  applyStockAdjustment(
    input: ApplyStockAdjustmentInput,
  ): Promise<StockAdjustmentResult>;
};

export type { ApplyStockAdjustmentInput, StockAdjustmentResult } from "./types";

function adjustmentReasonForDelta(
  quantityDelta: number,
): StockAdjustmentReason {
  return quantityDelta > 0 ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT";
}

export async function adjustStock(
  context: AuthContext,
  input: StockAdjustmentInput,
  repository: InventoryRepository,
): Promise<StockAdjustmentResult> {
  assertCanAdjustStock(context, input.storeId);

  if (!Number.isInteger(input.quantityDelta) || input.quantityDelta === 0) {
    throw new InvalidStockAdjustmentError(
      "Stock adjustment quantity must be a non-zero integer",
    );
  }

  const note = input.note.trim();

  if (note.length === 0) {
    throw new InvalidStockAdjustmentError(
      "Stock adjustment note must not be blank",
    );
  }

  return repository.applyStockAdjustment({
    organizationId: context.organizationId,
    storeId: input.storeId,
    skuId: input.skuId,
    quantityDelta: input.quantityDelta,
    reason: adjustmentReasonForDelta(input.quantityDelta),
    actorMembershipId: context.membershipId,
    note,
  });
}
```

- [ ] **Step 4: Run test to verify GREEN**

Run:

```powershell
npm run test -- src/server/inventory/service.test.ts
```

Expected:

- PASS.

- [ ] **Step 5: Commit inventory service**

Run:

```powershell
git add src/server/inventory
git commit -m "feat: add inventory adjustment service"
```

Expected:

- Commit records tested inventory service behavior.

## Task 3: Add Prisma Inventory Repository

**Files:**

- Create: `src/server/inventory/prisma-repository.ts`

- [ ] **Step 1: Add Prisma repository**

Create `src/server/inventory/prisma-repository.ts`:

```ts
import type { PrismaClient } from "@prisma/client";
import { InsufficientStockError } from "./errors";
import type { InventoryRepository } from "./service";

type PrismaWithInventoryAccess = Pick<PrismaClient, "$transaction">;

export function createPrismaInventoryRepository(
  db: PrismaWithInventoryAccess,
): InventoryRepository {
  return {
    async applyStockAdjustment(input) {
      return db.$transaction(async (tx) => {
        const balanceKey = {
          organizationId: input.organizationId,
          storeId: input.storeId,
          skuId: input.skuId,
        };

        const balance =
          input.quantityDelta > 0
            ? await tx.inventoryBalance.upsert({
                where: {
                  organizationId_storeId_skuId: balanceKey,
                },
                create: {
                  ...balanceKey,
                  quantityOnHand: input.quantityDelta,
                  lowStockThreshold: 0,
                },
                update: {
                  quantityOnHand: {
                    increment: input.quantityDelta,
                  },
                },
                select: {
                  organizationId: true,
                  storeId: true,
                  skuId: true,
                  quantityOnHand: true,
                  lowStockThreshold: true,
                },
              })
            : await decrementStock(tx, {
                ...balanceKey,
                quantityDelta: input.quantityDelta,
              });

        const ledger = await tx.stockLedger.create({
          data: {
            organizationId: input.organizationId,
            storeId: input.storeId,
            skuId: input.skuId,
            quantityDelta: input.quantityDelta,
            reason: input.reason,
            actorMembershipId: input.actorMembershipId,
            note: input.note,
          },
          select: {
            id: true,
          },
        });

        return {
          organizationId: balance.organizationId,
          storeId: balance.storeId,
          skuId: balance.skuId,
          quantityDelta: input.quantityDelta,
          quantityOnHand: balance.quantityOnHand,
          lowStockThreshold: balance.lowStockThreshold,
          reason: input.reason,
          ledgerId: ledger.id,
        };
      });
    },
  };
}

async function decrementStock(
  tx: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0],
  input: {
    organizationId: string;
    storeId: string;
    skuId: string;
    quantityDelta: number;
  },
) {
  const decrementBy = Math.abs(input.quantityDelta);

  const updateResult = await tx.inventoryBalance.updateMany({
    where: {
      organizationId: input.organizationId,
      storeId: input.storeId,
      skuId: input.skuId,
      quantityOnHand: {
        gte: decrementBy,
      },
    },
    data: {
      quantityOnHand: {
        decrement: decrementBy,
      },
    },
  });

  if (updateResult.count !== 1) {
    const latestBalance = await tx.inventoryBalance.findUnique({
      where: {
        organizationId_storeId_skuId: {
          organizationId: input.organizationId,
          storeId: input.storeId,
          skuId: input.skuId,
        },
      },
      select: {
        quantityOnHand: true,
      },
    });

    throw new InsufficientStockError({
      storeId: input.storeId,
      skuId: input.skuId,
      quantityOnHand: latestBalance?.quantityOnHand ?? 0,
      quantityRequested: decrementBy,
    });
  }

  return tx.inventoryBalance.findUniqueOrThrow({
    where: {
      organizationId_storeId_skuId: {
        organizationId: input.organizationId,
        storeId: input.storeId,
        skuId: input.skuId,
      },
    },
    select: {
      organizationId: true,
      storeId: true,
      skuId: true,
      quantityOnHand: true,
      lowStockThreshold: true,
    },
  });
}
```

- [ ] **Step 2: Run build to verify Prisma types**

Run:

```powershell
npm run build
```

Expected:

- PASS.

- [ ] **Step 3: Commit Prisma repository**

Run:

```powershell
git add src/server/inventory/prisma-repository.ts
git commit -m "feat: add prisma inventory repository"
```

Expected:

- Commit records Prisma adapter.

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

- Covers manual inventory adjustments with role and store authorization.
- Covers the audit reason and required note for operational accountability.
- Covers invalid quantity input.
- Covers insufficient stock as a domain error.
- Covers Prisma transaction boundary for balance and ledger writes.
- Defers paid-sale stock deduction to the order/payment flow.

Placeholder scan:

- No placeholder markers are used.

Type consistency:

- Service input, repository input, and result types use the same field names.
- Stock adjustment reason strings match Prisma `StockLedgerReason` enum values.
- Repository output maps Prisma records into service result types without leaking Prisma model shape into callers.
