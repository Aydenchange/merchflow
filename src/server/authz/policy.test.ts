import { describe, expect, it } from "vitest";
import { AuthorizationError } from "./errors";
import {
  assertActiveMembership,
  assertCanAdjustStock,
  assertCanCreateSale,
  assertCanManageCatalog,
  canAccessStore,
  getAccessibleStoreScope,
} from "./policy";
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

  it("allows owner to access any store in the organization", () => {
    expect(
      canAccessStore(
        authContext({ role: "OWNER", assignedStoreIds: [] }),
        "store_99",
      ),
    ).toBe(true);
  });

  it("allows manager to access assigned store", () => {
    expect(
      canAccessStore(
        authContext({ role: "MANAGER", assignedStoreIds: ["store_2"] }),
        "store_2",
      ),
    ).toBe(true);
  });

  it("denies manager access to unassigned store", () => {
    expect(
      canAccessStore(
        authContext({ role: "MANAGER", assignedStoreIds: ["store_2"] }),
        "store_3",
      ),
    ).toBe(false);
  });

  it("denies inactive member store access", () => {
    expect(
      canAccessStore(
        authContext({ status: "DISABLED", assignedStoreIds: ["store_1"] }),
        "store_1",
      ),
    ).toBe(false);
  });

  it("allows staff to create sale in assigned store", () => {
    expect(() =>
      assertCanCreateSale(
        authContext({ role: "STAFF", assignedStoreIds: ["store_1"] }),
        "store_1",
      ),
    ).not.toThrow();
  });

  it("denies staff creating sale in unassigned store", () => {
    expect(() =>
      assertCanCreateSale(
        authContext({ role: "STAFF", assignedStoreIds: ["store_1"] }),
        "store_2",
      ),
    ).toThrow("Store access denied");
  });

  it("allows manager to adjust stock in assigned store", () => {
    expect(() =>
      assertCanAdjustStock(
        authContext({ role: "MANAGER", assignedStoreIds: ["store_1"] }),
        "store_1",
      ),
    ).not.toThrow();
  });

  it("denies staff manual stock adjustment", () => {
    expect(() =>
      assertCanAdjustStock(
        authContext({ role: "STAFF", assignedStoreIds: ["store_1"] }),
        "store_1",
      ),
    ).toThrow("Role cannot adjust stock");
  });

  it("allows owner and manager to manage catalog", () => {
    expect(() =>
      assertCanManageCatalog(authContext({ role: "OWNER" })),
    ).not.toThrow();
    expect(() =>
      assertCanManageCatalog(authContext({ role: "MANAGER" })),
    ).not.toThrow();
  });

  it("denies staff catalog management", () => {
    expect(() =>
      assertCanManageCatalog(authContext({ role: "STAFF" })),
    ).toThrow("Role cannot manage catalog");
  });

  it("returns all-store scope for owner", () => {
    expect(
      getAccessibleStoreScope(
        authContext({ role: "OWNER", assignedStoreIds: [] }),
      ),
    ).toEqual({
      allStores: true,
      storeIds: [],
    });
  });

  it("returns assigned store scope for manager", () => {
    expect(
      getAccessibleStoreScope(
        authContext({
          role: "MANAGER",
          assignedStoreIds: ["store_1", "store_2"],
        }),
      ),
    ).toEqual({
      allStores: false,
      storeIds: ["store_1", "store_2"],
    });
  });

  it("returns empty scope for inactive membership", () => {
    expect(
      getAccessibleStoreScope(
        authContext({ status: "DISABLED", assignedStoreIds: ["store_1"] }),
      ),
    ).toEqual({
      allStores: false,
      storeIds: [],
    });
  });
});
