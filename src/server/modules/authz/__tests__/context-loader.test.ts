import { describe, expect, it } from "vitest";
import {
  AuthContextNotFoundError,
  loadAuthContextForUser,
  type MembershipRecord,
} from "../context-loader";

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
      loadAuthContextForUser(
        "user_1",
        repository({
          userId: "user_1",
          membershipId: "membership_1",
          organizationId: "org_1",
          role: "MANAGER",
          status: "ACTIVE",
          storeAssignments: [{ storeId: "store_1" }, { storeId: "store_2" }],
        }),
      ),
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
      loadAuthContextForUser(
        "owner_1",
        repository({
          userId: "owner_1",
          membershipId: "membership_owner",
          organizationId: "org_1",
          role: "OWNER",
          status: "ACTIVE",
          storeAssignments: [{ storeId: "store_1" }],
        }),
      ),
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
    const context = await loadAuthContextForUser(
      "staff_1",
      repository({
        userId: "staff_1",
        membershipId: "membership_staff",
        organizationId: "org_1",
        role: "STAFF",
        status: "DISABLED",
        storeAssignments: [{ storeId: "store_1" }],
      }),
    );

    expect(context.status).toBe("DISABLED");
    expect(context.assignedStoreIds).toEqual(["store_1"]);
  });

  it("throws when user has no membership", async () => {
    await expect(
      loadAuthContextForUser("missing_user", repository(null)),
    ).rejects.toThrow(AuthContextNotFoundError);
  });
});
