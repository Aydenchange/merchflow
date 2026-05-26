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
