# MerchFlow Project Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the Next.js foundation for MerchFlow, add Prisma/PostgreSQL schema support, and introduce the first testable domain utilities for money and order item snapshots.

**Architecture:** Start with a standard Next.js App Router application using `src/`. Keep domain logic outside React components under `src/server/` and `src/domain/`. Use Prisma for schema and migrations, but avoid module-scope database initialization so builds stay safe without runtime environment variables.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind, ESLint, Prisma, PostgreSQL, Vitest.

---

## Scope

This plan intentionally implements only the foundation slice.

Included:

- Next.js scaffold.
- Prisma schema initial version.
- Test runner setup.
- Money utility.
- Order item snapshot utility.
- Prisma validation.
- Build and test verification.

Excluded:

- Authentication.
- Full UI.
- Real payment provider.
- Webhook route.
- Inventory transaction services.
- Seed data.

Those belong in later plans after the schema exists and passes validation.

## File Structure

- `package.json`: npm scripts and dependencies.
- `src/app/**`: Next.js App Router shell.
- `src/lib/db.ts`: lazy Prisma client getter.
- `src/domain/money.ts`: integer minor-unit money helpers.
- `src/domain/order-pricing.ts`: order item snapshot and line total calculation.
- `src/domain/order-pricing.test.ts`: behavior tests for order item snapshots.
- `src/domain/money.test.ts`: behavior tests for money helpers.
- `src/test/setup.ts`: Vitest setup file.
- `vitest.config.ts`: Vitest configuration.
- `prisma/schema.prisma`: database models, enums, constraints, and indexes.
- `.env.example`: documented local environment variables.

## Task 1: Scaffold Next.js App

**Files:**

- Create: `package.json`
- Create: `src/app/page.tsx`
- Create: `src/app/layout.tsx`
- Create: `src/app/globals.css`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `eslint.config.mjs`

- [ ] **Step 1: Run create-next-app**

Run:

```powershell
npx create-next-app@latest . --yes --force --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --turbopack --use-npm
```

Expected:

- Next.js app files are created in the current directory.
- Existing `docs/` and `.git/` are preserved.

- [ ] **Step 2: Verify scaffold scripts**

Run:

```powershell
npm run lint
```

Expected:

- Lint completes without application errors.

- [ ] **Step 3: Commit scaffold**

Run:

```powershell
git add package.json package-lock.json next.config.ts tsconfig.json eslint.config.mjs src
git commit -m "chore: scaffold next app"
```

Expected:

- Commit records the generated app baseline.

## Task 2: Add Prisma And Test Tooling

**Files:**

- Modify: `package.json`
- Create: `.env.example`
- Create: `prisma.config.ts`
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`
- Create: `src/lib/db.ts`

- [ ] **Step 1: Install dependencies**

Run:

```powershell
npm install @prisma/client zod dotenv @prisma/adapter-pg pg
npm install -D prisma vitest @vitest/ui @types/pg
```

Expected:

- Prisma, Zod, and Vitest dependencies are added.
- Prisma's PostgreSQL driver adapter and dotenv config support are added for Prisma 7.

- [ ] **Step 2: Create environment example**

Create `.env.example`:

```dotenv
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/merchflow?schema=public"
```

- [ ] **Step 3: Create Prisma config**

Create `prisma.config.ts`:

```ts
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
```

- [ ] **Step 4: Create Vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
  },
});
```

- [ ] **Step 5: Create Vitest setup**

Create `src/test/setup.ts`:

```ts
import { beforeEach } from "vitest";

beforeEach(() => {
  // Reserved for shared test setup once database-backed tests are introduced.
});
```

- [ ] **Step 6: Add lazy Prisma client getter**

Create `src/lib/db.ts`:

```ts
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export function getDb() {
  if (!globalForPrisma.prisma) {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error("DATABASE_URL is required to initialize Prisma");
    }

    const adapter = new PrismaPg({ connectionString });
    globalForPrisma.prisma = new PrismaClient({ adapter });
  }

  return globalForPrisma.prisma;
}
```

- [ ] **Step 7: Add test scripts**

Modify `package.json` scripts to include:

```json
{
  "test": "vitest run --passWithNoTests",
  "test:watch": "vitest",
  "prisma:validate": "prisma validate"
}
```

- [ ] **Step 8: Verify tooling**

Run:

```powershell
npm run test
npm run prisma:validate
```

Expected:

- `npm run test` passes with no tests.
- `npm run prisma:validate` fails until `prisma/schema.prisma` exists. This expected failure proves the script is wired.

- [ ] **Step 9: Commit tooling**

Run:

```powershell
git add package.json package-lock.json .env.example prisma.config.ts vitest.config.ts src/test/setup.ts src/lib/db.ts
git commit -m "chore: add prisma and vitest tooling"
```

Expected:

- Commit records tooling setup.

## Task 3: Add Money Utility With TDD

**Files:**

- Create: `src/domain/money.test.ts`
- Create: `src/domain/money.ts`

- [ ] **Step 1: Write failing tests**

Create `src/domain/money.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { addMoney, multiplyMoney, toMinorUnits } from "./money";

describe("money helpers", () => {
  it("converts decimal string amounts to integer minor units", () => {
    expect(toMinorUnits("12.50")).toBe(1250);
    expect(toMinorUnits("0.99")).toBe(99);
  });

  it("rejects amounts with more than two decimal places", () => {
    expect(() => toMinorUnits("12.345")).toThrow("Money amount must have at most two decimal places");
  });

  it("adds money in integer minor units", () => {
    expect(addMoney(1250, 250)).toBe(1500);
  });

  it("multiplies money by positive integer quantity", () => {
    expect(multiplyMoney(1299, 3)).toBe(3897);
  });

  it("rejects non-positive quantity", () => {
    expect(() => multiplyMoney(1299, 0)).toThrow("Quantity must be positive");
  });
});
```

- [ ] **Step 2: Run test to verify RED**

Run:

```powershell
npm run test -- src/domain/money.test.ts
```

Expected:

- FAIL because `src/domain/money.ts` does not exist.

- [ ] **Step 3: Implement minimal money utility**

Create `src/domain/money.ts`:

```ts
export function toMinorUnits(amount: string) {
  if (!/^\d+(\.\d{1,2})?$/.test(amount)) {
    throw new Error("Money amount must have at most two decimal places");
  }

  const [whole, decimal = ""] = amount.split(".");
  return Number(`${whole}${decimal.padEnd(2, "0")}`);
}

export function addMoney(left: number, right: number) {
  return left + right;
}

export function multiplyMoney(unitAmount: number, quantity: number) {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error("Quantity must be positive");
  }

  return unitAmount * quantity;
}
```

- [ ] **Step 4: Run test to verify GREEN**

Run:

```powershell
npm run test -- src/domain/money.test.ts
```

Expected:

- PASS.

- [ ] **Step 5: Commit money utility**

Run:

```powershell
git add src/domain/money.ts src/domain/money.test.ts
git commit -m "feat: add money helpers"
```

Expected:

- Commit records tested money behavior.

## Task 4: Add Order Item Snapshot Utility With TDD

**Files:**

- Create: `src/domain/order-pricing.test.ts`
- Create: `src/domain/order-pricing.ts`

- [ ] **Step 1: Write failing tests**

Create `src/domain/order-pricing.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createOrderItemSnapshot } from "./order-pricing";

describe("createOrderItemSnapshot", () => {
  it("snapshots SKU display fields and calculates line total", () => {
    const item = createOrderItemSnapshot({
      skuId: "sku_1",
      skuName: "Classic T-Shirt / Black / M",
      barcode: "9555000000012",
      unitPriceAmount: 1299,
      quantity: 2,
    });

    expect(item).toEqual({
      skuId: "sku_1",
      skuNameSnapshot: "Classic T-Shirt / Black / M",
      barcodeSnapshot: "9555000000012",
      unitPriceAmount: 1299,
      quantity: 2,
      lineTotalAmount: 2598,
    });
  });

  it("rejects zero quantity", () => {
    expect(() =>
      createOrderItemSnapshot({
        skuId: "sku_1",
        skuName: "Classic T-Shirt / Black / M",
        barcode: "9555000000012",
        unitPriceAmount: 1299,
        quantity: 0,
      }),
    ).toThrow("Quantity must be positive");
  });
});
```

- [ ] **Step 2: Run test to verify RED**

Run:

```powershell
npm run test -- src/domain/order-pricing.test.ts
```

Expected:

- FAIL because `src/domain/order-pricing.ts` does not exist.

- [ ] **Step 3: Implement minimal snapshot utility**

Create `src/domain/order-pricing.ts`:

```ts
import { multiplyMoney } from "./money";

type CreateOrderItemSnapshotInput = {
  skuId: string;
  skuName: string;
  barcode: string;
  unitPriceAmount: number;
  quantity: number;
};

export function createOrderItemSnapshot(input: CreateOrderItemSnapshotInput) {
  return {
    skuId: input.skuId,
    skuNameSnapshot: input.skuName,
    barcodeSnapshot: input.barcode,
    unitPriceAmount: input.unitPriceAmount,
    quantity: input.quantity,
    lineTotalAmount: multiplyMoney(input.unitPriceAmount, input.quantity),
  };
}
```

- [ ] **Step 4: Run test to verify GREEN**

Run:

```powershell
npm run test -- src/domain/order-pricing.test.ts
```

Expected:

- PASS.

- [ ] **Step 5: Commit order snapshot utility**

Run:

```powershell
git add src/domain/order-pricing.ts src/domain/order-pricing.test.ts
git commit -m "feat: add order item snapshot helper"
```

Expected:

- Commit records tested order pricing behavior.

## Task 5: Add Initial Prisma Schema

**Files:**

- Create: `prisma/schema.prisma`
- Modify: `prisma.config.ts`

- [ ] **Step 1: Create Prisma schema**

Create `prisma/schema.prisma` with:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
}

enum OrganizationRole {
  OWNER
  MANAGER
  STAFF
}

enum MembershipStatus {
  ACTIVE
  INVITED
  DISABLED
}

enum StoreStatus {
  ACTIVE
  INACTIVE
}

enum CatalogStatus {
  ACTIVE
  ARCHIVED
}

enum OrderStatus {
  PENDING_PAYMENT
  PAID
  FULFILLED
  CANCELLED
  PAYMENT_FAILED
  REFUNDED
  PAYMENT_REQUIRES_REVIEW
}

enum PaymentStatus {
  PENDING
  SUCCEEDED
  FAILED
  REFUNDED
  PARTIALLY_REFUNDED
  REQUIRES_REVIEW
}

enum StockLedgerReason {
  SALE
  ADJUSTMENT_IN
  ADJUSTMENT_OUT
  RETURN_RESTOCK
}

enum PaymentEventProcessingStatus {
  PROCESSED
  FAILED_REVIEW
}

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  membership OrganizationMembership?

  @@map("users")
}

model Organization {
  id        String   @id @default(uuid())
  name      String
  country   String
  currency  String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  memberships       OrganizationMembership[]
  stores            Store[]
  storeAssignments  StoreAssignment[]
  products          Product[]
  skus              Sku[]
  inventoryBalances InventoryBalance[]
  stockLedgers      StockLedger[]
  customers         Customer[]
  orders            Order[]
  orderItems        OrderItem[]
  payments          Payment[]
  paymentEvents     PaymentEvent[]
  auditLogs         AuditLog[]

  @@map("organizations")
}

model OrganizationMembership {
  id             String           @id @default(uuid())
  organizationId String
  userId         String           @unique
  role           OrganizationRole
  status         MembershipStatus @default(ACTIVE)
  createdAt      DateTime         @default(now())
  updatedAt      DateTime         @updatedAt

  organization     Organization      @relation(fields: [organizationId], references: [id])
  user             User              @relation(fields: [userId], references: [id])
  storeAssignments StoreAssignment[]
  createdOrders    Order[]           @relation("OrderCreator")
  stockLedgers     StockLedger[]     @relation("StockLedgerActor")
  auditLogs        AuditLog[]        @relation("AuditActor")

  @@unique([organizationId, userId])
  @@index([organizationId])
  @@index([organizationId, role])
  @@map("organization_memberships")
}

model Store {
  id             String      @id @default(uuid())
  organizationId String
  name           String
  code           String
  address        String?
  status         StoreStatus @default(ACTIVE)
  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt

  organization      Organization       @relation(fields: [organizationId], references: [id])
  assignments       StoreAssignment[]
  inventoryBalances InventoryBalance[]
  stockLedgers      StockLedger[]
  orders            Order[]
  auditLogs         AuditLog[]

  @@unique([organizationId, code])
  @@unique([id, organizationId])
  @@index([organizationId, status])
  @@map("stores")
}

model StoreAssignment {
  id             String   @id @default(uuid())
  organizationId String
  membershipId   String
  storeId        String
  createdAt      DateTime @default(now())

  organization Organization           @relation(fields: [organizationId], references: [id])
  membership   OrganizationMembership @relation(fields: [membershipId], references: [id])
  store        Store                  @relation(fields: [storeId], references: [id])

  @@unique([membershipId, storeId])
  @@index([organizationId, membershipId])
  @@index([organizationId, storeId])
  @@map("store_assignments")
}

model Product {
  id             String        @id @default(uuid())
  organizationId String
  name           String
  description    String?
  status         CatalogStatus @default(ACTIVE)
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id])
  skus         Sku[]

  @@unique([id, organizationId])
  @@index([organizationId, status])
  @@map("products")
}

model Sku {
  id             String        @id @default(uuid())
  organizationId String
  productId      String
  name           String
  barcode        String
  priceAmount    Int
  costAmount     Int?
  status         CatalogStatus @default(ACTIVE)
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt

  organization      Organization       @relation(fields: [organizationId], references: [id])
  product           Product            @relation(fields: [productId], references: [id])
  inventoryBalances InventoryBalance[]
  stockLedgers      StockLedger[]
  orderItems        OrderItem[]

  @@unique([organizationId, barcode])
  @@unique([id, organizationId])
  @@index([organizationId, productId])
  @@index([organizationId, status])
  @@map("skus")
}

model InventoryBalance {
  id                String   @id @default(uuid())
  organizationId    String
  storeId           String
  skuId             String
  quantityOnHand    Int      @default(0)
  lowStockThreshold Int      @default(0)
  updatedAt         DateTime @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id])
  store        Store        @relation(fields: [storeId], references: [id])
  sku          Sku          @relation(fields: [skuId], references: [id])

  @@unique([organizationId, storeId, skuId])
  @@index([organizationId, storeId])
  @@index([organizationId, skuId])
  @@index([organizationId, storeId, quantityOnHand])
  @@map("inventory_balances")
}

model StockLedger {
  id                String            @id @default(uuid())
  organizationId    String
  storeId           String
  skuId             String
  quantityDelta     Int
  reason            StockLedgerReason
  relatedOrderId    String?
  actorMembershipId String?
  note              String?
  createdAt         DateTime          @default(now())

  organization Organization            @relation(fields: [organizationId], references: [id])
  store        Store                   @relation(fields: [storeId], references: [id])
  sku          Sku                     @relation(fields: [skuId], references: [id])
  relatedOrder Order?                  @relation("StockLedgerOrder", fields: [relatedOrderId], references: [id])
  actor        OrganizationMembership? @relation("StockLedgerActor", fields: [actorMembershipId], references: [id])

  @@index([organizationId, storeId, skuId, createdAt])
  @@index([organizationId, relatedOrderId])
  @@index([organizationId, actorMembershipId])
  @@map("stock_ledgers")
}

model Customer {
  id             String   @id @default(uuid())
  organizationId String
  name           String?
  phone          String?
  email          String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id])
  orders       Order[]

  @@index([organizationId, phone])
  @@index([organizationId, email])
  @@map("customers")
}

model Order {
  id                    String      @id @default(uuid())
  organizationId        String
  storeId               String
  customerId            String?
  createdByMembershipId String
  status                OrderStatus @default(PENDING_PAYMENT)
  subtotalAmount        Int
  taxAmount             Int         @default(0)
  totalAmount           Int
  currency              String
  paidAt                DateTime?
  fulfilledAt           DateTime?
  cancelledAt           DateTime?
  refundedAt            DateTime?
  createdAt             DateTime    @default(now())
  updatedAt             DateTime    @updatedAt

  organization Organization           @relation(fields: [organizationId], references: [id])
  store        Store                  @relation(fields: [storeId], references: [id])
  customer     Customer?              @relation(fields: [customerId], references: [id])
  createdBy    OrganizationMembership @relation("OrderCreator", fields: [createdByMembershipId], references: [id])
  items        OrderItem[]
  payment      Payment?
  stockLedgers StockLedger[]          @relation("StockLedgerOrder")

  @@unique([id, organizationId])
  @@index([organizationId, storeId, createdAt])
  @@index([organizationId, status, createdAt])
  @@index([organizationId, createdByMembershipId, createdAt])
  @@map("orders")
}

model OrderItem {
  id                 String @id @default(uuid())
  organizationId     String
  orderId            String
  skuId              String
  skuNameSnapshot    String
  barcodeSnapshot    String
  unitPriceAmount    Int
  quantity           Int
  lineTotalAmount    Int

  organization Organization @relation(fields: [organizationId], references: [id])
  order        Order        @relation(fields: [orderId], references: [id])
  sku          Sku          @relation(fields: [skuId], references: [id])

  @@index([organizationId, orderId])
  @@index([organizationId, skuId])
  @@map("order_items")
}

model Payment {
  id                String        @id @default(uuid())
  organizationId    String
  orderId           String        @unique
  provider          String
  providerPaymentId String?
  status            PaymentStatus @default(PENDING)
  amount            Int
  currency          String
  metadata          Json?
  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt

  organization Organization   @relation(fields: [organizationId], references: [id])
  order        Order          @relation(fields: [orderId], references: [id])
  events       PaymentEvent[]

  @@unique([provider, providerPaymentId])
  @@index([organizationId, status, createdAt])
  @@index([organizationId, provider, providerPaymentId])
  @@map("payments")
}

model PaymentEvent {
  id               String                       @id @default(uuid())
  organizationId   String
  paymentId        String
  provider         String
  providerEventId  String
  eventType        String
  payload          Json
  processedAt      DateTime?
  processingStatus PaymentEventProcessingStatus
  createdAt        DateTime                     @default(now())

  organization Organization @relation(fields: [organizationId], references: [id])
  payment      Payment      @relation(fields: [paymentId], references: [id])

  @@unique([provider, providerEventId])
  @@index([organizationId, paymentId, createdAt])
  @@index([organizationId, processingStatus, createdAt])
  @@map("payment_events")
}

model AuditLog {
  id                String   @id @default(uuid())
  organizationId    String
  storeId           String?
  actorMembershipId String?
  action            String
  entityType        String
  entityId          String
  metadata          Json?
  createdAt         DateTime @default(now())

  organization Organization            @relation(fields: [organizationId], references: [id])
  store        Store?                  @relation(fields: [storeId], references: [id])
  actor        OrganizationMembership? @relation("AuditActor", fields: [actorMembershipId], references: [id])

  @@index([organizationId, createdAt])
  @@index([organizationId, storeId, createdAt])
  @@index([organizationId, actorMembershipId, createdAt])
  @@index([organizationId, entityType, entityId])
  @@map("audit_logs")
}
```

- [ ] **Step 2: Validate schema**

Run:

```powershell
npm run prisma:validate
```

Expected:

- PASS.

- [ ] **Step 3: Format schema**

Run:

```powershell
npx prisma format
```

Expected:

- Prisma schema is formatted.

- [ ] **Step 4: Commit schema**

Run:

```powershell
git add prisma/schema.prisma
git commit -m "feat: add initial prisma schema"
```

Expected:

- Commit records the initial database schema.

## Task 6: Final Foundation Verification

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

- The plan covers the foundation needed for the PRD: Next.js app, Prisma, money handling, order item price snapshotting, and initial schema design.
- Authentication, authorization services, inventory transactions, payment webhook handling, and UI workflows are deliberately excluded and will be implemented in later plans.

Placeholder scan:

- The plan contains no placeholder markers.

Type consistency:

- Domain helper names are consistent across tests and implementation steps.
- Prisma enum names match the domain model and database design documents.
