import { describe, expect, it } from "vitest";
import { AuthorizationError } from "./errors";
import { assertActiveMembership, canAccessStore } from "./policy";
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
});
