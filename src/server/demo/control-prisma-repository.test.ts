import { describe, expect, it, vi } from "vitest";
import { createPrismaControlCenterRepository } from "./control-prisma-repository";

function createDb(overrides: {
  orderFindMany?: ReturnType<typeof vi.fn>;
  inventoryBalanceFindMany?: ReturnType<typeof vi.fn>;
} = {}) {
  return {
    order: {
      findMany: overrides.orderFindMany ?? vi.fn(),
    },
    inventoryBalance: {
      findMany: overrides.inventoryBalanceFindMany ?? vi.fn(),
    },
  } as unknown as Parameters<typeof createPrismaControlCenterRepository>[0];
}

describe("prisma control center repository", () => {
  it("queries recent orders with tenant scope, assigned-store scope, payment snapshot, and newest-first limit", async () => {
    const createdAt = new Date("2026-05-28T08:00:00.000Z");
    const paidAt = new Date("2026-05-28T08:01:00.000Z");
    const orderFindMany = vi.fn().mockResolvedValue([
      {
        id: "order_1",
        organizationId: "org_1",
        storeId: "store_1",
        status: "PAID",
        totalAmount: 1299,
        currency: "SGD",
        createdAt,
        paidAt,
        fulfilledAt: null,
        cancelledAt: null,
        refundedAt: null,
        store: {
          name: "Orchard Central",
          code: "ORCHARD",
        },
        payment: {
          id: "payment_1",
          status: "SUCCEEDED",
          amount: 1299,
          currency: "SGD",
        },
      },
    ]);

    const result = await createPrismaControlCenterRepository(
      createDb({ orderFindMany }),
    ).listRecentOrders({
      organizationId: "org_1",
      storeScope: {
        allStores: false,
        storeIds: ["store_1"],
      },
      limit: 5,
    });

    expect(orderFindMany).toHaveBeenCalledWith({
      where: {
        organizationId: "org_1",
        storeId: {
          in: ["store_1"],
        },
      },
      select: {
        id: true,
        organizationId: true,
        storeId: true,
        status: true,
        totalAmount: true,
        currency: true,
        createdAt: true,
        paidAt: true,
        fulfilledAt: true,
        cancelledAt: true,
        refundedAt: true,
        store: {
          select: {
            name: true,
            code: true,
          },
        },
        payment: {
          select: {
            id: true,
            status: true,
            amount: true,
            currency: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 5,
    });
    expect(result).toEqual([
      {
        id: "order_1",
        organizationId: "org_1",
        storeId: "store_1",
        storeName: "Orchard Central",
        storeCode: "ORCHARD",
        status: "PAID",
        totalAmount: 1299,
        currency: "SGD",
        createdAt,
        paidAt,
        fulfilledAt: null,
        cancelledAt: null,
        refundedAt: null,
        payment: {
          id: "payment_1",
          status: "SUCCEEDED",
          amount: 1299,
          currency: "SGD",
        },
      },
    ]);
  });

  it("omits store id filter for owner all-store recent orders", async () => {
    const orderFindMany = vi.fn().mockResolvedValue([]);

    await createPrismaControlCenterRepository(
      createDb({ orderFindMany }),
    ).listRecentOrders({
      organizationId: "org_1",
      storeScope: {
        allStores: true,
        storeIds: [],
      },
      limit: 8,
    });

    expect(orderFindMany.mock.calls[0][0].where).not.toHaveProperty("storeId");
  });

  it("does not query orders when a non-owner has no accessible stores", async () => {
    const orderFindMany = vi.fn();

    const result = await createPrismaControlCenterRepository(
      createDb({ orderFindMany }),
    ).listRecentOrders({
      organizationId: "org_1",
      storeScope: {
        allStores: false,
        storeIds: [],
      },
      limit: 8,
    });

    expect(result).toEqual([]);
    expect(orderFindMany).not.toHaveBeenCalled();
  });

  it("queries inventory adjustment options with tenant, active store, active sku, and store scope", async () => {
    const inventoryBalanceFindMany = vi.fn().mockResolvedValue([
      {
        organizationId: "org_1",
        storeId: "store_1",
        quantityOnHand: 24,
        lowStockThreshold: 5,
        store: {
          name: "Orchard Central",
          code: "ORCHARD",
        },
        sku: {
          id: "sku_1",
          name: "Classic T-Shirt / Black / M",
          barcode: "9555000000012",
        },
      },
    ]);

    const result = await createPrismaControlCenterRepository(
      createDb({ inventoryBalanceFindMany }),
    ).listInventoryOptions({
      organizationId: "org_1",
      storeScope: {
        allStores: false,
        storeIds: ["store_1"],
      },
    });

    expect(inventoryBalanceFindMany).toHaveBeenCalledWith({
      where: {
        organizationId: "org_1",
        storeId: {
          in: ["store_1"],
        },
        store: {
          status: "ACTIVE",
        },
        sku: {
          status: "ACTIVE",
        },
      },
      select: {
        organizationId: true,
        storeId: true,
        quantityOnHand: true,
        lowStockThreshold: true,
        store: {
          select: {
            name: true,
            code: true,
          },
        },
        sku: {
          select: {
            id: true,
            name: true,
            barcode: true,
          },
        },
      },
      orderBy: [
        {
          storeId: "asc",
        },
        {
          skuId: "asc",
        },
      ],
    });
    expect(result).toEqual([
      {
        organizationId: "org_1",
        storeId: "store_1",
        storeName: "Orchard Central",
        storeCode: "ORCHARD",
        skuId: "sku_1",
        skuName: "Classic T-Shirt / Black / M",
        barcode: "9555000000012",
        quantityOnHand: 24,
        lowStockThreshold: 5,
      },
    ]);
  });
});
