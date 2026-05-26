# MerchFlow Auth Context Loader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Load the tested `AuthContext` shape from database-style membership and store assignment data.

**Architecture:** Keep provider authentication out of this slice. Implement a repository interface that returns the user's active membership data, a pure loader that converts that data into `AuthContext`, and a Prisma-backed repository adapter for later Server Actions and Route Handlers. Add a seed script with a realistic merchant, owner, manager, staff, stores, products, SKUs, and inventory balances.

**Tech Stack:** TypeScript, Vitest, Prisma 7, PostgreSQL.

---

## Scope

Included:

- Auth context loading design note.
- `AuthContextNotFoundError`.
- Repository interface for user membership lookup.
- Pure `loadAuthContextForUser` function.
- Tests for manager/staff assignments, owner access, missing membership, disabled membership, and empty store assignments.
- Prisma-backed repository adapter.
- Prisma seed script and npm `db:seed` script.

Excluded:

- Login provider integration.
- Session cookies.
- Server Actions.
- Route protection.
- Running the seed against a real PostgreSQL database in CI.

## File Structure

- `docs/06-auth-context-loading.md`: Explains why auth context loading is separate from login provider choice.
- `src/server/authz/context-loader.ts`: Pure auth context loader and repository interface.
- `src/server/authz/context-loader.test.ts`: TDD coverage for context loading behavior.
- `src/server/authz/prisma-repository.ts`: Prisma query adapter for auth context loading.
- `prisma/seed.ts`: Local demo data.
- `package.json`: Adds `db:seed`.
- `docs/superpowers/plans/2026-05-26-auth-context-loader.md`: This implementation plan.

## Task 1: Document Auth Context Loading

**Files:**

- Create: `docs/06-auth-context-loading.md`

- [ ] **Step 1: Create design document**

Create `docs/06-auth-context-loading.md`:

```md
# Auth Context Loading Design

## Purpose

Authorization policy needs a stable `AuthContext`.

Authentication provider code identifies the user. Auth context loading converts that user id into the business authorization shape used by MerchFlow:

- organization id
- membership id
- role
- membership status
- assigned store ids

## Why This Layer Exists

The app should not scatter membership queries across pages, Server Actions, and Route Handlers.

Instead, request handlers should load one `AuthContext` and pass it into policy checks such as:

- `assertCanCreateSale`
- `assertCanAdjustStock`
- `assertCanManageCatalog`
- `getAccessibleStoreScope`

This keeps business authorization independent from the login provider.

## V1 Rules

- A user must have exactly one membership.
- `DISABLED` and `INVITED` memberships can be loaded but are denied by policy.
- Owner store access is implicit, so owner contexts use an empty `assignedStoreIds` array.
- Manager and staff store access comes from `StoreAssignment`.
- The loader throws `AuthContextNotFoundError` when no membership exists for the user.

## Interview Talking Points

- "I separated login identity from business authorization context."
- "I load authorization context once and pass it into policy functions instead of repeating role queries in every action."
- "I keep disabled membership loadable so policy can produce a consistent denial path."
- "Owner access is represented as role-based all-store access, not by inserting store assignment rows for every store."
```

- [ ] **Step 2: Commit design document**

Run:

```powershell
git add docs/06-auth-context-loading.md
git commit -m "docs: define auth context loading"
```

Expected:

- Commit records the design before implementation.

## Task 2: Add Auth Context Loader With TDD

**Files:**

- Create: `src/server/authz/context-loader.test.ts`
- Create: `src/server/authz/context-loader.ts`

- [ ] **Step 1: Write failing tests**

Create `src/server/authz/context-loader.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  AuthContextNotFoundError,
  loadAuthContextForUser,
  type MembershipRecord,
} from "./context-loader";

function repository(record: MembershipRecord | null) {
  return {
    async findMembershipByUserId() {
      return record;
    },
  };
}

describe("loadAuthContextForUser", () => {
  it("loads manager context with assigned stores", async () => {
    await expect(
      loadAuthContextForUser("user_1", repository({
        userId: "user_1",
        membershipId: "membership_1",
        organizationId: "org_1",
        role: "MANAGER",
        status: "ACTIVE",
        storeAssignments: [{ storeId: "store_1" }, { storeId: "store_2" }],
      })),
    ).resolves.toEqual({
      userId: "user_1",
      membershipId: "membership_1",
      organizationId: "org_1",
      role: "MANAGER",
      status: "ACTIVE",
      assignedStoreIds: ["store_1", "store_2"],
    });
  });

  it("loads owner context without store assignments", async () => {
    await expect(
      loadAuthContextForUser("owner_1", repository({
        userId: "owner_1",
        membershipId: "membership_owner",
        organizationId: "org_1",
        role: "OWNER",
        status: "ACTIVE",
        storeAssignments: [{ storeId: "store_1" }],
      })),
    ).resolves.toEqual({
      userId: "owner_1",
      membershipId: "membership_owner",
      organizationId: "org_1",
      role: "OWNER",
      status: "ACTIVE",
      assignedStoreIds: [],
    });
  });

  it("keeps disabled membership loadable for policy denial", async () => {
    const context = await loadAuthContextForUser("staff_1", repository({
      userId: "staff_1",
      membershipId: "membership_staff",
      organizationId: "org_1",
      role: "STAFF",
      status: "DISABLED",
      storeAssignments: [{ storeId: "store_1" }],
    }));

    expect(context.status).toBe("DISABLED");
    expect(context.assignedStoreIds).toEqual(["store_1"]);
  });

  it("throws when user has no membership", async () => {
    await expect(loadAuthContextForUser("missing_user", repository(null))).rejects.toThrow(AuthContextNotFoundError);
  });
});
```

- [ ] **Step 2: Run test to verify RED**

Run:

```powershell
npm run test -- src/server/authz/context-loader.test.ts
```

Expected:

- FAIL because `context-loader.ts` does not exist.

- [ ] **Step 3: Implement loader**

Create `src/server/authz/context-loader.ts`:

```ts
import type { AuthContext, MembershipStatus, OrganizationRole } from "./types";

export class AuthContextNotFoundError extends Error {
  constructor(userId: string) {
    super(`Auth context not found for user ${userId}`);
    this.name = "AuthContextNotFoundError";
  }
}

export type MembershipRecord = {
  userId: string;
  membershipId: string;
  organizationId: string;
  role: OrganizationRole;
  status: MembershipStatus;
  storeAssignments: Array<{ storeId: string }>;
};

export type AuthContextRepository = {
  findMembershipByUserId(userId: string): Promise<MembershipRecord | null>;
};

export async function loadAuthContextForUser(
  userId: string,
  repository: AuthContextRepository,
): Promise<AuthContext> {
  const membership = await repository.findMembershipByUserId(userId);

  if (!membership) {
    throw new AuthContextNotFoundError(userId);
  }

  return {
    userId: membership.userId,
    membershipId: membership.membershipId,
    organizationId: membership.organizationId,
    role: membership.role,
    status: membership.status,
    assignedStoreIds:
      membership.role === "OWNER"
        ? []
        : membership.storeAssignments.map((assignment) => assignment.storeId),
  };
}
```

- [ ] **Step 4: Run test to verify GREEN**

Run:

```powershell
npm run test -- src/server/authz/context-loader.test.ts
```

Expected:

- PASS.

- [ ] **Step 5: Commit loader**

Run:

```powershell
git add src/server/authz/context-loader.ts src/server/authz/context-loader.test.ts
git commit -m "feat: add auth context loader"
```

Expected:

- Commit records tested context loading behavior.

## Task 3: Add Prisma Repository Adapter

**Files:**

- Create: `src/server/authz/prisma-repository.ts`

- [ ] **Step 1: Add Prisma repository**

Create `src/server/authz/prisma-repository.ts`:

```ts
import type { PrismaClient } from "@prisma/client";
import type { AuthContextRepository, MembershipRecord } from "./context-loader";

type PrismaWithMembershipLookup = Pick<PrismaClient, "organizationMembership">;

export function createPrismaAuthContextRepository(
  db: PrismaWithMembershipLookup,
): AuthContextRepository {
  return {
    async findMembershipByUserId(userId: string): Promise<MembershipRecord | null> {
      const membership = await db.organizationMembership.findUnique({
        where: { userId },
        select: {
          id: true,
          organizationId: true,
          userId: true,
          role: true,
          status: true,
          storeAssignments: {
            select: {
              storeId: true,
            },
            orderBy: {
              storeId: "asc",
            },
          },
        },
      });

      if (!membership) {
        return null;
      }

      return {
        userId: membership.userId,
        membershipId: membership.id,
        organizationId: membership.organizationId,
        role: membership.role,
        status: membership.status,
        storeAssignments: membership.storeAssignments,
      };
    },
  };
}
```

- [ ] **Step 2: Run TypeScript build**

Run:

```powershell
npm run build
```

Expected:

- PASS.

- [ ] **Step 3: Commit Prisma repository**

Run:

```powershell
git add src/server/authz/prisma-repository.ts
git commit -m "feat: add prisma auth context repository"
```

Expected:

- Commit records the database adapter.

## Task 4: Add Seed Script

**Files:**

- Create: `prisma/seed.ts`
- Modify: `package.json`

- [ ] **Step 1: Add seed script**

Create `prisma/seed.ts`:

```ts
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to seed the database");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const organization = await prisma.organization.upsert({
    where: { id: "org_merchflow_demo" },
    update: {},
    create: {
      id: "org_merchflow_demo",
      name: "Merlion Retail Group",
      country: "SG",
      currency: "SGD",
    },
  });

  const orchard = await prisma.store.upsert({
    where: {
      organizationId_code: {
        organizationId: organization.id,
        code: "ORCHARD",
      },
    },
    update: {},
    create: {
      id: "store_orchard",
      organizationId: organization.id,
      name: "Orchard Central",
      code: "ORCHARD",
      address: "181 Orchard Road, Singapore",
    },
  });

  const klcc = await prisma.store.upsert({
    where: {
      organizationId_code: {
        organizationId: organization.id,
        code: "KLCC",
      },
    },
    update: {},
    create: {
      id: "store_klcc",
      organizationId: organization.id,
      name: "KLCC Pop-up",
      code: "KLCC",
      address: "Kuala Lumpur City Centre, Malaysia",
    },
  });

  const ownerUser = await prisma.user.upsert({
    where: { email: "owner@merlion.example" },
    update: {},
    create: {
      id: "user_owner",
      email: "owner@merlion.example",
      name: "Alicia Owner",
    },
  });

  const managerUser = await prisma.user.upsert({
    where: { email: "manager@merlion.example" },
    update: {},
    create: {
      id: "user_manager",
      email: "manager@merlion.example",
      name: "Marcus Manager",
    },
  });

  const staffUser = await prisma.user.upsert({
    where: { email: "staff@merlion.example" },
    update: {},
    create: {
      id: "user_staff",
      email: "staff@merlion.example",
      name: "Siti Staff",
    },
  });

  const ownerMembership = await prisma.organizationMembership.upsert({
    where: { userId: ownerUser.id },
    update: {},
    create: {
      id: "membership_owner",
      organizationId: organization.id,
      userId: ownerUser.id,
      role: "OWNER",
      status: "ACTIVE",
    },
  });

  const managerMembership = await prisma.organizationMembership.upsert({
    where: { userId: managerUser.id },
    update: {},
    create: {
      id: "membership_manager",
      organizationId: organization.id,
      userId: managerUser.id,
      role: "MANAGER",
      status: "ACTIVE",
    },
  });

  const staffMembership = await prisma.organizationMembership.upsert({
    where: { userId: staffUser.id },
    update: {},
    create: {
      id: "membership_staff",
      organizationId: organization.id,
      userId: staffUser.id,
      role: "STAFF",
      status: "ACTIVE",
    },
  });

  await prisma.storeAssignment.upsert({
    where: {
      membershipId_storeId: {
        membershipId: managerMembership.id,
        storeId: orchard.id,
      },
    },
    update: {},
    create: {
      organizationId: organization.id,
      membershipId: managerMembership.id,
      storeId: orchard.id,
    },
  });

  await prisma.storeAssignment.upsert({
    where: {
      membershipId_storeId: {
        membershipId: staffMembership.id,
        storeId: orchard.id,
      },
    },
    update: {},
    create: {
      organizationId: organization.id,
      membershipId: staffMembership.id,
      storeId: orchard.id,
    },
  });

  const product = await prisma.product.upsert({
    where: { id: "product_tshirt" },
    update: {},
    create: {
      id: "product_tshirt",
      organizationId: organization.id,
      name: "Classic T-Shirt",
      description: "Core cotton tee for demo sales",
    },
  });

  const blackMedium = await prisma.sku.upsert({
    where: {
      organizationId_barcode: {
        organizationId: organization.id,
        barcode: "9555000000012",
      },
    },
    update: {},
    create: {
      id: "sku_tshirt_black_m",
      organizationId: organization.id,
      productId: product.id,
      name: "Classic T-Shirt / Black / M",
      barcode: "9555000000012",
      priceAmount: 1299,
      costAmount: 600,
    },
  });

  await prisma.inventoryBalance.upsert({
    where: {
      organizationId_storeId_skuId: {
        organizationId: organization.id,
        storeId: orchard.id,
        skuId: blackMedium.id,
      },
    },
    update: {
      quantityOnHand: 24,
      lowStockThreshold: 5,
    },
    create: {
      organizationId: organization.id,
      storeId: orchard.id,
      skuId: blackMedium.id,
      quantityOnHand: 24,
      lowStockThreshold: 5,
    },
  });

  await prisma.inventoryBalance.upsert({
    where: {
      organizationId_storeId_skuId: {
        organizationId: organization.id,
        storeId: klcc.id,
        skuId: blackMedium.id,
      },
    },
    update: {
      quantityOnHand: 8,
      lowStockThreshold: 5,
    },
    create: {
      organizationId: organization.id,
      storeId: klcc.id,
      skuId: blackMedium.id,
      quantityOnHand: 8,
      lowStockThreshold: 5,
    },
  });

  // Keep ownerMembership referenced so the seed documents owner role creation.
  console.log(`Seeded ${organization.name} with owner membership ${ownerMembership.id}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

- [ ] **Step 2: Add db:seed script**

Modify `package.json` scripts:

```json
{
  "db:seed": "tsx prisma/seed.ts"
}
```

Install `tsx`:

```powershell
npm install -D tsx
```

- [ ] **Step 3: Run static checks**

Run:

```powershell
npm run lint
npm run build
```

Expected:

- PASS.

- [ ] **Step 4: Commit seed script**

Run:

```powershell
git add package.json package-lock.json prisma/seed.ts
git commit -m "chore: add demo seed data"
```

Expected:

- Commit records local demo data setup.

## Task 5: Final Verification

**Files:**

- No new files.

- [ ] **Step 1: Run tests**

Run:

```powershell
npm run test
```

Expected:

- PASS.

- [ ] **Step 2: Validate Prisma schema**

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

- Covers auth context loading from user membership and store assignments.
- Keeps login provider out of scope.
- Adds seed data for the target retail domain.
- Does not implement Server Actions or UI yet.

Placeholder scan:

- No placeholder markers are used.

Type consistency:

- `AuthContext`, `OrganizationRole`, and `MembershipStatus` match existing authorization policy types.

