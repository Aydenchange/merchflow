# MerchFlow Catalog Barcode Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first catalog service boundary for creating product/SKU records and looking up active SKUs by barcode for a POS-style sale.

**Architecture:** Keep UI and Server Actions out of this slice. Implement pure service functions that depend on repository interfaces and `AuthContext`, then add a Prisma repository adapter. The POS lookup service checks store access before returning SKU and store inventory data.

**Tech Stack:** TypeScript, Vitest, Prisma 7, PostgreSQL.

---

## Scope

Included:

- Catalog service design note.
- Catalog domain errors.
- Repository interface.
- `createProductWithSku` service with catalog permission check.
- `lookupSkuForSaleByBarcode` service with store access check.
- Tests for barcode lookup, inactive SKU, missing SKU, unauthorized store access, and catalog management permissions.
- Prisma-backed catalog repository.

Excluded:

- Product management UI.
- Server Actions.
- Bulk CSV import.
- Variant matrix UI.
- Barcode generation.
- Camera barcode scanning.

## File Structure

- `docs/08-catalog-barcode-service.md`: Explains the service boundary.
- `src/server/catalog/errors.ts`: Catalog-specific errors.
- `src/server/catalog/types.ts`: Repository records and service input/output types.
- `src/server/catalog/service.ts`: Pure catalog service functions.
- `src/server/catalog/service.test.ts`: TDD coverage.
- `src/server/catalog/prisma-repository.ts`: Prisma adapter.

## Task 1: Document Catalog Service Boundary

**Files:**

- Create: `docs/08-catalog-barcode-service.md`

- [ ] **Step 1: Create design document**

Create `docs/08-catalog-barcode-service.md`:

```md
# Catalog Barcode Service Design

## Purpose

This document defines the first catalog service boundary for MerchFlow.

The POS sale flow starts with a barcode. The system must resolve that barcode to an active SKU inside the current organization and selected store context.

## Why This Layer Exists

The UI should not directly query SKU tables.

Instead, the POS flow should call a service that:

- checks whether the actor can create a sale for the selected store
- looks up the SKU by organization and barcode
- rejects archived or missing SKUs
- returns current store inventory for the SKU

Catalog management also goes through a service so owner/manager permissions are enforced before product and SKU records are created.

## V1 Rules

- Barcode is unique within an organization.
- Active SKUs can be used in new sales.
- Archived SKUs remain available for historical records but cannot be scanned into new sales.
- Staff can scan SKUs for assigned stores.
- Staff cannot create or manage catalog records.
- Owner and Manager can create catalog records.

## Interview Talking Points

- "I scoped barcode lookup by organization because different merchants may use the same manufacturer barcode."
- "I made the POS barcode lookup enforce store access on the server, not only in the UI."
- "I kept archived SKUs queryable for history but blocked them from new sales."
- "I returned inventory balance with the barcode lookup because POS needs to warn about stock before payment."
```

- [ ] **Step 2: Commit design document**

Run:

```powershell
git add docs/08-catalog-barcode-service.md
git commit -m "docs: define catalog barcode service"
```

Expected:

- Commit records catalog service decisions before implementation.

## Task 2: Add Catalog Service With TDD

**Files:**

- Create: `src/server/catalog/service.test.ts`
- Create: `src/server/catalog/errors.ts`
- Create: `src/server/catalog/types.ts`
- Create: `src/server/catalog/service.ts`

- [ ] **Step 1: Write failing tests**

Create `src/server/catalog/service.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { AuthContext } from "../authz/types";
import {
  ArchivedSkuError,
  SkuNotFoundError,
} from "./errors";
import {
  createProductWithSku,
  lookupSkuForSaleByBarcode,
  type CatalogRepository,
  type SkuLookupRecord,
} from "./service";

function authContext(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    userId: "user_1",
    membershipId: "membership_1",
    organizationId: "org_1",
    role: "STAFF",
    status: "ACTIVE",
    assignedStoreIds: ["store_1"],
    ...overrides,
  };
}

function skuRecord(overrides: Partial<SkuLookupRecord> = {}): SkuLookupRecord {
  return {
    id: "sku_1",
    organizationId: "org_1",
    productId: "product_1",
    name: "Classic T-Shirt / Black / M",
    barcode: "9555000000012",
    priceAmount: 1299,
    status: "ACTIVE",
    inventoryBalance: {
      storeId: "store_1",
      quantityOnHand: 24,
      lowStockThreshold: 5,
    },
    ...overrides,
  };
}

function repository(overrides: Partial<CatalogRepository> = {}): CatalogRepository {
  return {
    async createProductWithSku(input) {
      return {
        productId: "product_created",
        skuId: "sku_created",
        organizationId: input.organizationId,
        skuBarcode: input.barcode,
      };
    },
    async findSkuByBarcodeForStore() {
      return skuRecord();
    },
    ...overrides,
  };
}

describe("catalog service", () => {
  it("allows manager to create product with sku", async () => {
    await expect(
      createProductWithSku(
        authContext({ role: "MANAGER" }),
        {
          productName: "Classic T-Shirt",
          skuName: "Classic T-Shirt / Black / M",
          barcode: "9555000000012",
          priceAmount: 1299,
          costAmount: 600,
        },
        repository(),
      ),
    ).resolves.toEqual({
      productId: "product_created",
      skuId: "sku_created",
      organizationId: "org_1",
      skuBarcode: "9555000000012",
    });
  });

  it("denies staff catalog creation", async () => {
    await expect(
      createProductWithSku(
        authContext({ role: "STAFF" }),
        {
          productName: "Classic T-Shirt",
          skuName: "Classic T-Shirt / Black / M",
          barcode: "9555000000012",
          priceAmount: 1299,
        },
        repository(),
      ),
    ).rejects.toThrow("Role cannot manage catalog");
  });

  it("looks up active sku by barcode for assigned store", async () => {
    await expect(
      lookupSkuForSaleByBarcode(
        authContext({ role: "STAFF", assignedStoreIds: ["store_1"] }),
        { storeId: "store_1", barcode: "9555000000012" },
        repository(),
      ),
    ).resolves.toEqual({
      skuId: "sku_1",
      productId: "product_1",
      name: "Classic T-Shirt / Black / M",
      barcode: "9555000000012",
      priceAmount: 1299,
      quantityOnHand: 24,
      lowStockThreshold: 5,
    });
  });

  it("denies barcode lookup for unassigned store", async () => {
    await expect(
      lookupSkuForSaleByBarcode(
        authContext({ role: "STAFF", assignedStoreIds: ["store_1"] }),
        { storeId: "store_2", barcode: "9555000000012" },
        repository(),
      ),
    ).rejects.toThrow("Store access denied");
  });

  it("throws when sku barcode does not exist", async () => {
    await expect(
      lookupSkuForSaleByBarcode(
        authContext({ role: "STAFF", assignedStoreIds: ["store_1"] }),
        { storeId: "store_1", barcode: "missing" },
        repository({
          async findSkuByBarcodeForStore() {
            return null;
          },
        }),
      ),
    ).rejects.toThrow(SkuNotFoundError);
  });

  it("throws when sku is archived", async () => {
    await expect(
      lookupSkuForSaleByBarcode(
        authContext({ role: "STAFF", assignedStoreIds: ["store_1"] }),
        { storeId: "store_1", barcode: "9555000000012" },
        repository({
          async findSkuByBarcodeForStore() {
            return skuRecord({ status: "ARCHIVED" });
          },
        }),
      ),
    ).rejects.toThrow(ArchivedSkuError);
  });
});
```

- [ ] **Step 2: Run test to verify RED**

Run:

```powershell
npm run test -- src/server/catalog/service.test.ts
```

Expected:

- FAIL because catalog service files do not exist.

- [ ] **Step 3: Implement catalog service**

Create `src/server/catalog/errors.ts`:

```ts
export class SkuNotFoundError extends Error {
  constructor(barcode: string) {
    super(`SKU not found for barcode ${barcode}`);
    this.name = "SkuNotFoundError";
  }
}

export class ArchivedSkuError extends Error {
  constructor(barcode: string) {
    super(`SKU is archived for barcode ${barcode}`);
    this.name = "ArchivedSkuError";
  }
}
```

Create `src/server/catalog/types.ts`:

```ts
export type CatalogStatus = "ACTIVE" | "ARCHIVED";

export type CreateProductWithSkuInput = {
  productName: string;
  skuName: string;
  barcode: string;
  priceAmount: number;
  costAmount?: number;
};

export type CreatedProductWithSku = {
  productId: string;
  skuId: string;
  organizationId: string;
  skuBarcode: string;
};

export type SkuLookupRecord = {
  id: string;
  organizationId: string;
  productId: string;
  name: string;
  barcode: string;
  priceAmount: number;
  status: CatalogStatus;
  inventoryBalance: {
    storeId: string;
    quantityOnHand: number;
    lowStockThreshold: number;
  } | null;
};

export type PosSkuLookupResult = {
  skuId: string;
  productId: string;
  name: string;
  barcode: string;
  priceAmount: number;
  quantityOnHand: number;
  lowStockThreshold: number;
};
```

Create `src/server/catalog/service.ts`:

```ts
import {
  assertCanCreateSale,
  assertCanManageCatalog,
} from "../authz/policy";
import type { AuthContext } from "../authz/types";
import { ArchivedSkuError, SkuNotFoundError } from "./errors";
import type {
  CreatedProductWithSku,
  CreateProductWithSkuInput,
  PosSkuLookupResult,
  SkuLookupRecord,
} from "./types";

export type CatalogRepository = {
  createProductWithSku(
    input: CreateProductWithSkuInput & { organizationId: string },
  ): Promise<CreatedProductWithSku>;
  findSkuByBarcodeForStore(input: {
    organizationId: string;
    storeId: string;
    barcode: string;
  }): Promise<SkuLookupRecord | null>;
};

export type { SkuLookupRecord } from "./types";

export async function createProductWithSku(
  context: AuthContext,
  input: CreateProductWithSkuInput,
  repository: CatalogRepository,
) {
  assertCanManageCatalog(context);

  return repository.createProductWithSku({
    ...input,
    organizationId: context.organizationId,
  });
}

export async function lookupSkuForSaleByBarcode(
  context: AuthContext,
  input: { storeId: string; barcode: string },
  repository: CatalogRepository,
): Promise<PosSkuLookupResult> {
  assertCanCreateSale(context, input.storeId);

  const sku = await repository.findSkuByBarcodeForStore({
    organizationId: context.organizationId,
    storeId: input.storeId,
    barcode: input.barcode,
  });

  if (!sku) {
    throw new SkuNotFoundError(input.barcode);
  }

  if (sku.status !== "ACTIVE") {
    throw new ArchivedSkuError(input.barcode);
  }

  return {
    skuId: sku.id,
    productId: sku.productId,
    name: sku.name,
    barcode: sku.barcode,
    priceAmount: sku.priceAmount,
    quantityOnHand: sku.inventoryBalance?.quantityOnHand ?? 0,
    lowStockThreshold: sku.inventoryBalance?.lowStockThreshold ?? 0,
  };
}
```

- [ ] **Step 4: Run test to verify GREEN**

Run:

```powershell
npm run test -- src/server/catalog/service.test.ts
```

Expected:

- PASS.

- [ ] **Step 5: Commit catalog service**

Run:

```powershell
git add src/server/catalog
git commit -m "feat: add catalog barcode service"
```

Expected:

- Commit records tested catalog service behavior.

## Task 3: Add Prisma Catalog Repository

**Files:**

- Create: `src/server/catalog/prisma-repository.ts`

- [ ] **Step 1: Add Prisma repository**

Create `src/server/catalog/prisma-repository.ts`:

```ts
import type { PrismaClient } from "@prisma/client";
import type { CatalogRepository } from "./service";

type PrismaWithCatalogAccess = Pick<PrismaClient, "product" | "sku">;

export function createPrismaCatalogRepository(
  db: PrismaWithCatalogAccess,
): CatalogRepository {
  return {
    async createProductWithSku(input) {
      const product = await db.product.create({
        data: {
          organizationId: input.organizationId,
          name: input.productName,
          skus: {
            create: {
              organizationId: input.organizationId,
              name: input.skuName,
              barcode: input.barcode,
              priceAmount: input.priceAmount,
              costAmount: input.costAmount,
            },
          },
        },
        include: {
          skus: {
            where: {
              barcode: input.barcode,
            },
            take: 1,
          },
        },
      });

      const sku = product.skus[0];

      if (!sku) {
        throw new Error("SKU creation failed");
      }

      return {
        productId: product.id,
        skuId: sku.id,
        organizationId: product.organizationId,
        skuBarcode: sku.barcode,
      };
    },

    async findSkuByBarcodeForStore(input) {
      const sku = await db.sku.findUnique({
        where: {
          organizationId_barcode: {
            organizationId: input.organizationId,
            barcode: input.barcode,
          },
        },
        select: {
          id: true,
          organizationId: true,
          productId: true,
          name: true,
          barcode: true,
          priceAmount: true,
          status: true,
          inventoryBalances: {
            where: {
              organizationId: input.organizationId,
              storeId: input.storeId,
            },
            select: {
              storeId: true,
              quantityOnHand: true,
              lowStockThreshold: true,
            },
            take: 1,
          },
        },
      });

      if (!sku) {
        return null;
      }

      return {
        id: sku.id,
        organizationId: sku.organizationId,
        productId: sku.productId,
        name: sku.name,
        barcode: sku.barcode,
        priceAmount: sku.priceAmount,
        status: sku.status,
        inventoryBalance: sku.inventoryBalances[0] ?? null,
      };
    },
  };
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
git add src/server/catalog/prisma-repository.ts
git commit -m "feat: add prisma catalog repository"
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

- Covers catalog management permission checks.
- Covers POS barcode lookup by organization and store.
- Covers archived SKU rejection for new sales.
- Covers missing SKU behavior.
- Defers UI and Server Actions to a later slice.

Placeholder scan:

- No placeholder markers are used.

Type consistency:

- Catalog status strings match Prisma enum values.
- Repository output maps into POS lookup result without leaking Prisma model shape into callers.

