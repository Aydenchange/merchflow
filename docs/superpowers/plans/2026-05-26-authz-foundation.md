# MerchFlow Authorization Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first server-side authorization layer for organization and store-scoped actions.

**Architecture:** Keep authentication provider concerns out of this slice. Represent the current actor as an `AuthContext`, then implement pure authorization policy functions that can be tested without a database or UI. Later Server Actions, Route Handlers, and pages will call these policy functions before mutating orders, inventory, catalog, or payments.

**Tech Stack:** TypeScript, Vitest, Next.js App Router project structure.

---

## Scope

Included:

- Authorization design note.
- Role, membership status, and auth context types.
- Authorization error class.
- Store access and role policy helpers.
- Tests for owner, manager, staff, inactive membership, and store assignment behavior.

Excluded:

- Login UI.
- Auth.js, Clerk, Supabase Auth, or session cookies.
- Database-backed auth context loading.
- Middleware or proxy authorization.

Why excluded:

Authentication provider integration is a separate concern. This slice answers the production-critical question: once a user is known, what can they do?

## File Structure

- `docs/05-authorization-design.md`: Explains why server-side authorization is separate from login and UI hiding.
- `src/server/authz/types.ts`: Shared authorization types.
- `src/server/authz/errors.ts`: Authorization error used by policy functions.
- `src/server/authz/policy.ts`: Pure authorization checks.
- `src/server/authz/policy.test.ts`: TDD coverage for role and store access behavior.

## Task 1: Document Authorization Design

**Files:**

- Create: `docs/05-authorization-design.md`

- [ ] **Step 1: Create authorization design document**

Create `docs/05-authorization-design.md`:

```md
# Authorization Design

## Purpose

This document defines MerchFlow V1 authorization rules.

Authentication answers: "Who is this user?"

Authorization answers: "What is this user allowed to do?"

V1 implements authorization policy before integrating a specific auth provider so that business permissions are testable without UI, cookies, or external services.

## V1 Assumptions

- A user belongs to exactly one organization.
- A user has one organization membership.
- Membership has role and status.
- Owners can access all stores in their organization.
- Managers and staff can access only assigned stores.
- Server-side authorization is required even when the UI hides controls.

## Roles

### Owner

Can:

- Operate all stores.
- Manage catalog.
- Adjust stock in all stores.
- Create sales in all stores.
- View organization-level reports.
- Manage staff.

### Manager

Can:

- Operate assigned stores.
- Manage catalog in V1.
- Adjust stock in assigned stores.
- Create sales in assigned stores.
- View assigned-store reports.

### Staff

Can:

- Create sales in assigned stores.
- View assigned-store orders needed for counter work.
- Fulfill paid orders in assigned stores.

Cannot:

- Adjust stock manually.
- Manage catalog.
- View organization-wide reports.
- Manage staff.

## Membership Status

Only `ACTIVE` membership can perform actions.

`INVITED` and `DISABLED` memberships are denied by default.

## Store Access

Owner store access is implicit.

Manager and staff store access is explicit through assigned store ids.

This matches the retail model:

- A store manager may manage two branches.
- A counter staff member may work in one branch.
- The owner can see and operate the whole merchant organization.

## Why Not Middleware-only Authorization

Middleware or proxy checks can protect routes, but they must not be the only authorization layer.

Sensitive actions such as creating orders, adjusting stock, refunding payments, and updating catalog records must verify authorization in the server-side action or service that performs the mutation.

## Interview Talking Points

- "I separated authentication from authorization so provider choice does not leak into business policy."
- "I used explicit store assignments for managers and staff because role alone does not tell which branch they can operate."
- "I made inactive memberships deny by default."
- "I do not rely on hidden UI controls as an authorization boundary."
```

- [ ] **Step 2: Commit authorization design**

Run:

```powershell
git add docs/05-authorization-design.md
git commit -m "docs: define authorization policy"
```

Expected:

- Commit records authorization decisions before code.

## Task 2: Add Authorization Types And Error With TDD

**Files:**

- Create: `src/server/authz/policy.test.ts`
- Create: `src/server/authz/types.ts`
- Create: `src/server/authz/errors.ts`

- [ ] **Step 1: Write failing tests for inactive membership**

Create `src/server/authz/policy.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { AuthorizationError } from "./errors";
import { assertActiveMembership } from "./policy";
import type { AuthContext } from "./types";

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

describe("authorization policy", () => {
  it("allows active membership", () => {
    expect(() => assertActiveMembership(authContext())).not.toThrow();
  });

  it("denies invited membership", () => {
    expect(() =>
      assertActiveMembership(authContext({ status: "INVITED" })),
    ).toThrow(AuthorizationError);
  });

  it("denies disabled membership", () => {
    expect(() =>
      assertActiveMembership(authContext({ status: "DISABLED" })),
    ).toThrow("Membership is not active");
  });
});
```

- [ ] **Step 2: Run test to verify RED**

Run:

```powershell
npm run test -- src/server/authz/policy.test.ts
```

Expected:

- FAIL because `src/server/authz/policy.ts`, `types.ts`, and `errors.ts` do not exist.

- [ ] **Step 3: Add types and error**

Create `src/server/authz/types.ts`:

```ts
export type OrganizationRole = "OWNER" | "MANAGER" | "STAFF";

export type MembershipStatus = "ACTIVE" | "INVITED" | "DISABLED";

export type AuthContext = {
  userId: string;
  membershipId: string;
  organizationId: string;
  role: OrganizationRole;
  status: MembershipStatus;
  assignedStoreIds: string[];
};
```

Create `src/server/authz/errors.ts`:

```ts
export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthorizationError";
  }
}
```

Create `src/server/authz/policy.ts`:

```ts
import { AuthorizationError } from "./errors";
import type { AuthContext } from "./types";

export function assertActiveMembership(context: AuthContext) {
  if (context.status !== "ACTIVE") {
    throw new AuthorizationError("Membership is not active");
  }
}
```

- [ ] **Step 4: Run test to verify GREEN**

Run:

```powershell
npm run test -- src/server/authz/policy.test.ts
```

Expected:

- PASS.

- [ ] **Step 5: Commit active membership policy**

Run:

```powershell
git add src/server/authz
git commit -m "feat: add active membership authorization check"
```

Expected:

- Commit records first tested authorization behavior.

## Task 3: Add Store Access Policy With TDD

**Files:**

- Modify: `src/server/authz/policy.test.ts`
- Modify: `src/server/authz/policy.ts`

- [ ] **Step 1: Add failing store access tests**

Append these tests inside the existing `describe` block in `src/server/authz/policy.test.ts`:

```ts
  it("allows owner to access any store in the organization", () => {
    expect(canAccessStore(authContext({ role: "OWNER", assignedStoreIds: [] }), "store_99")).toBe(true);
  });

  it("allows manager to access assigned store", () => {
    expect(canAccessStore(authContext({ role: "MANAGER", assignedStoreIds: ["store_2"] }), "store_2")).toBe(true);
  });

  it("denies manager access to unassigned store", () => {
    expect(canAccessStore(authContext({ role: "MANAGER", assignedStoreIds: ["store_2"] }), "store_3")).toBe(false);
  });

  it("denies inactive member store access", () => {
    expect(canAccessStore(authContext({ status: "DISABLED", assignedStoreIds: ["store_1"] }), "store_1")).toBe(false);
  });
```

Also update the import:

```ts
import { assertActiveMembership, canAccessStore } from "./policy";
```

- [ ] **Step 2: Run test to verify RED**

Run:

```powershell
npm run test -- src/server/authz/policy.test.ts
```

Expected:

- FAIL because `canAccessStore` is not exported.

- [ ] **Step 3: Implement store access**

Update `src/server/authz/policy.ts`:

```ts
import { AuthorizationError } from "./errors";
import type { AuthContext } from "./types";

export function assertActiveMembership(context: AuthContext) {
  if (context.status !== "ACTIVE") {
    throw new AuthorizationError("Membership is not active");
  }
}

export function canAccessStore(context: AuthContext, storeId: string) {
  if (context.status !== "ACTIVE") {
    return false;
  }

  if (context.role === "OWNER") {
    return true;
  }

  return context.assignedStoreIds.includes(storeId);
}
```

- [ ] **Step 4: Run test to verify GREEN**

Run:

```powershell
npm run test -- src/server/authz/policy.test.ts
```

Expected:

- PASS.

- [ ] **Step 5: Commit store access policy**

Run:

```powershell
git add src/server/authz/policy.ts src/server/authz/policy.test.ts
git commit -m "feat: add store access policy"
```

Expected:

- Commit records store assignment behavior.

## Task 4: Add Action Permission Policy With TDD

**Files:**

- Modify: `src/server/authz/policy.test.ts`
- Modify: `src/server/authz/policy.ts`

- [ ] **Step 1: Add failing action permission tests**

Append these tests inside the existing `describe` block:

```ts
  it("allows staff to create sale in assigned store", () => {
    expect(() => assertCanCreateSale(authContext({ role: "STAFF", assignedStoreIds: ["store_1"] }), "store_1")).not.toThrow();
  });

  it("denies staff creating sale in unassigned store", () => {
    expect(() => assertCanCreateSale(authContext({ role: "STAFF", assignedStoreIds: ["store_1"] }), "store_2")).toThrow("Store access denied");
  });

  it("allows manager to adjust stock in assigned store", () => {
    expect(() => assertCanAdjustStock(authContext({ role: "MANAGER", assignedStoreIds: ["store_1"] }), "store_1")).not.toThrow();
  });

  it("denies staff manual stock adjustment", () => {
    expect(() => assertCanAdjustStock(authContext({ role: "STAFF", assignedStoreIds: ["store_1"] }), "store_1")).toThrow("Role cannot adjust stock");
  });

  it("allows owner and manager to manage catalog", () => {
    expect(() => assertCanManageCatalog(authContext({ role: "OWNER" }))).not.toThrow();
    expect(() => assertCanManageCatalog(authContext({ role: "MANAGER" }))).not.toThrow();
  });

  it("denies staff catalog management", () => {
    expect(() => assertCanManageCatalog(authContext({ role: "STAFF" }))).toThrow("Role cannot manage catalog");
  });
```

Update import:

```ts
import {
  assertActiveMembership,
  assertCanAdjustStock,
  assertCanCreateSale,
  assertCanManageCatalog,
  canAccessStore,
} from "./policy";
```

- [ ] **Step 2: Run test to verify RED**

Run:

```powershell
npm run test -- src/server/authz/policy.test.ts
```

Expected:

- FAIL because action assertion functions are not exported.

- [ ] **Step 3: Implement action permissions**

Update `src/server/authz/policy.ts`:

```ts
import { AuthorizationError } from "./errors";
import type { AuthContext } from "./types";

export function assertActiveMembership(context: AuthContext) {
  if (context.status !== "ACTIVE") {
    throw new AuthorizationError("Membership is not active");
  }
}

export function canAccessStore(context: AuthContext, storeId: string) {
  if (context.status !== "ACTIVE") {
    return false;
  }

  if (context.role === "OWNER") {
    return true;
  }

  return context.assignedStoreIds.includes(storeId);
}

export function assertCanCreateSale(context: AuthContext, storeId: string) {
  assertActiveMembership(context);

  if (!canAccessStore(context, storeId)) {
    throw new AuthorizationError("Store access denied");
  }
}

export function assertCanAdjustStock(context: AuthContext, storeId: string) {
  assertActiveMembership(context);

  if (context.role === "STAFF") {
    throw new AuthorizationError("Role cannot adjust stock");
  }

  if (!canAccessStore(context, storeId)) {
    throw new AuthorizationError("Store access denied");
  }
}

export function assertCanManageCatalog(context: AuthContext) {
  assertActiveMembership(context);

  if (context.role === "STAFF") {
    throw new AuthorizationError("Role cannot manage catalog");
  }
}
```

- [ ] **Step 4: Run test to verify GREEN**

Run:

```powershell
npm run test -- src/server/authz/policy.test.ts
```

Expected:

- PASS.

- [ ] **Step 5: Commit action permissions**

Run:

```powershell
git add src/server/authz/policy.ts src/server/authz/policy.test.ts
git commit -m "feat: add action authorization policy"
```

Expected:

- Commit records first action-level permission rules.

## Task 5: Add Accessible Store Scope Helper With TDD

**Files:**

- Modify: `src/server/authz/policy.test.ts`
- Modify: `src/server/authz/policy.ts`

- [ ] **Step 1: Add failing accessible scope tests**

Append these tests inside the existing `describe` block:

```ts
  it("returns all-store scope for owner", () => {
    expect(getAccessibleStoreScope(authContext({ role: "OWNER", assignedStoreIds: [] }))).toEqual({
      allStores: true,
      storeIds: [],
    });
  });

  it("returns assigned store scope for manager", () => {
    expect(getAccessibleStoreScope(authContext({ role: "MANAGER", assignedStoreIds: ["store_1", "store_2"] }))).toEqual({
      allStores: false,
      storeIds: ["store_1", "store_2"],
    });
  });

  it("returns empty scope for inactive membership", () => {
    expect(getAccessibleStoreScope(authContext({ status: "DISABLED", assignedStoreIds: ["store_1"] }))).toEqual({
      allStores: false,
      storeIds: [],
    });
  });
```

Update import:

```ts
import {
  assertActiveMembership,
  assertCanAdjustStock,
  assertCanCreateSale,
  assertCanManageCatalog,
  canAccessStore,
  getAccessibleStoreScope,
} from "./policy";
```

- [ ] **Step 2: Run test to verify RED**

Run:

```powershell
npm run test -- src/server/authz/policy.test.ts
```

Expected:

- FAIL because `getAccessibleStoreScope` is not exported.

- [ ] **Step 3: Implement accessible store scope**

Append to `src/server/authz/policy.ts`:

```ts
export function getAccessibleStoreScope(context: AuthContext) {
  if (context.status !== "ACTIVE") {
    return { allStores: false, storeIds: [] };
  }

  if (context.role === "OWNER") {
    return { allStores: true, storeIds: [] };
  }

  return { allStores: false, storeIds: [...context.assignedStoreIds] };
}
```

- [ ] **Step 4: Run test to verify GREEN**

Run:

```powershell
npm run test -- src/server/authz/policy.test.ts
```

Expected:

- PASS.

- [ ] **Step 5: Commit accessible store scope**

Run:

```powershell
git add src/server/authz/policy.ts src/server/authz/policy.test.ts
git commit -m "feat: add accessible store scope helper"
```

Expected:

- Commit records helper used by future order lists, inventory pages, and reports.

## Task 6: Final Verification

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

- Covers FR1 organization and store access at the policy layer.
- Covers role separation for Owner, Manager, and Staff.
- Covers inactive membership denial.
- Deliberately does not cover real sessions or auth provider integration.

Placeholder scan:

- No placeholder markers are used.

Type consistency:

- `AuthContext`, role strings, and status strings are consistent across tests and implementation.

