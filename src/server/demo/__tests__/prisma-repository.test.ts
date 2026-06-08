import { describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/server/modules/authz/types";
import { createPrismaDemoRepository } from "../prisma-repository";

function ownerContext(): AuthContext {
  return {
    userId: "user_owner",
    membershipId: "membership_owner",
    organizationId: "org_merchflow_demo",
    role: "OWNER",
    status: "ACTIVE",
    assignedStoreIds: [],
  };
}

function staffContext(): AuthContext {
  return {
    userId: "user_staff",
    membershipId: "membership_staff",
    organizationId: "org_merchflow_demo",
    role: "STAFF",
    status: "ACTIVE",
    assignedStoreIds: ["store_orchard"],
  };
}

function createDb(overrides: {
  userFindUnique?: ReturnType<typeof vi.fn>;
  organizationFindUnique?: ReturnType<typeof vi.fn>;
  storeFindMany?: ReturnType<typeof vi.fn>;
  paymentFindUnique?: ReturnType<typeof vi.fn>;
} = {}) {
  return {
    user: {
      findUnique: overrides.userFindUnique ?? vi.fn(),
    },
    organization: {
      findUnique: overrides.organizationFindUnique ?? vi.fn(),
    },
    store: {
      findMany: overrides.storeFindMany ?? vi.fn(),
    },
    payment: {
      findUnique: overrides.paymentFindUnique ?? vi.fn(),
    },
  } as unknown as Parameters<typeof createPrismaDemoRepository>[0];
}

describe("prisma demo repository", () => {
  it("loads a serializable demo user profile", async () => {
    const userFindUnique = vi.fn().mockResolvedValue({
      id: "user_staff",
      email: "staff@merlion.example",
      name: "Siti Staff",
    });

    const result = await createPrismaDemoRepository(
      createDb({ userFindUnique }),
    ).findUserProfileById("user_staff");

    expect(userFindUnique).toHaveBeenCalledWith({
      where: {
        id: "user_staff",
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });
    expect(result).toEqual({
      id: "user_staff",
      email: "staff@merlion.example",
      name: "Siti Staff",
    });
  });

  it("loads a serializable demo organization", async () => {
    const organizationFindUnique = vi.fn().mockResolvedValue({
      id: "org_merchflow_demo",
      name: "Merlion Retail Group",
      country: "SG",
      currency: "SGD",
    });

    const result = await createPrismaDemoRepository(
      createDb({ organizationFindUnique }),
    ).findOrganizationById("org_merchflow_demo");

    expect(organizationFindUnique).toHaveBeenCalledWith({
      where: {
        id: "org_merchflow_demo",
      },
      select: {
        id: true,
        name: true,
        country: true,
        currency: true,
      },
    });
    expect(result).toEqual({
      id: "org_merchflow_demo",
      name: "Merlion Retail Group",
      country: "SG",
      currency: "SGD",
    });
  });

  it("lets owner see all active stores in the organization", async () => {
    const storeFindMany = vi.fn().mockResolvedValue([
      {
        id: "store_klcc",
        name: "KLCC Pop-up",
        code: "KLCC",
        address: "Kuala Lumpur City Centre, Malaysia",
      },
      {
        id: "store_orchard",
        name: "Orchard Central",
        code: "ORCHARD",
        address: "181 Orchard Road, Singapore",
      },
    ]);

    const result = await createPrismaDemoRepository(
      createDb({ storeFindMany }),
    ).findVisibleStores(ownerContext());

    expect(storeFindMany).toHaveBeenCalledWith({
      where: {
        organizationId: "org_merchflow_demo",
        status: "ACTIVE",
      },
      select: {
        id: true,
        name: true,
        code: true,
        address: true,
      },
      orderBy: {
        code: "asc",
      },
    });
    expect(result.map((store) => store.id)).toEqual([
      "store_klcc",
      "store_orchard",
    ]);
  });

  it("limits staff visible stores to assigned active stores", async () => {
    const storeFindMany = vi.fn().mockResolvedValue([
      {
        id: "store_orchard",
        name: "Orchard Central",
        code: "ORCHARD",
        address: "181 Orchard Road, Singapore",
      },
    ]);

    await createPrismaDemoRepository(createDb({ storeFindMany })).findVisibleStores(
      staffContext(),
    );

    expect(storeFindMany).toHaveBeenCalledWith({
      where: {
        organizationId: "org_merchflow_demo",
        status: "ACTIVE",
        id: {
          in: ["store_orchard"],
        },
      },
      select: {
        id: true,
        name: true,
        code: true,
        address: true,
      },
      orderBy: {
        code: "asc",
      },
    });
  });

  it("returns no stores for inactive memberships", async () => {
    const storeFindMany = vi.fn();

    const result = await createPrismaDemoRepository(
      createDb({ storeFindMany }),
    ).findVisibleStores({
      ...staffContext(),
      status: "DISABLED",
    });

    expect(result).toEqual([]);
    expect(storeFindMany).not.toHaveBeenCalled();
  });

  it("loads payment and order status snapshot after a simulated event", async () => {
    const paymentFindUnique = vi.fn().mockResolvedValue({
      id: "payment_1",
      status: "SUCCEEDED",
      amount: 1299,
      currency: "SGD",
      order: {
        id: "order_1",
        status: "PAID",
      },
    });

    const result = await createPrismaDemoRepository(
      createDb({ paymentFindUnique }),
    ).findPaymentSnapshot("payment_1");

    expect(paymentFindUnique).toHaveBeenCalledWith({
      where: {
        id: "payment_1",
      },
      select: {
        id: true,
        status: true,
        amount: true,
        currency: true,
        order: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });
    expect(result).toEqual({
      paymentId: "payment_1",
      paymentStatus: "SUCCEEDED",
      orderId: "order_1",
      orderStatus: "PAID",
      totalAmount: 1299,
      currency: "SGD",
    });
  });
});
