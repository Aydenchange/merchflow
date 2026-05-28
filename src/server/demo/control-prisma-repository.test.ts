import { describe, expect, it, vi } from "vitest";
import { createPrismaControlCenterRepository } from "./control-prisma-repository";

function createDb(overrides: {
  orderFindMany?: ReturnType<typeof vi.fn>;
  inventoryBalanceFindMany?: ReturnType<typeof vi.fn>;
  stockLedgerGroupBy?: ReturnType<typeof vi.fn>;
} = {}) {
  return {
    order: {
      findMany: overrides.orderFindMany ?? vi.fn(),
    },
    inventoryBalance: {
      findMany: overrides.inventoryBalanceFindMany ?? vi.fn(),
    },
    stockLedger: {
      groupBy: overrides.stockLedgerGroupBy ?? vi.fn(),
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

  it("lists refunded return-restock candidates with remaining restockable quantity", async () => {
    const refundedAt = new Date("2026-05-28T10:00:00.000Z");
    const orderFindMany = vi.fn().mockResolvedValue([
      {
        id: "order_refunded",
        organizationId: "org_1",
        storeId: "store_1",
        refundedAt,
        store: {
          name: "Orchard Central",
          code: "ORCHARD",
        },
        items: [
          {
            id: "item_1",
            skuId: "sku_1",
            skuNameSnapshot: "Classic T-Shirt / Black / M",
            barcodeSnapshot: "9555000000012",
            quantity: 2,
          },
          {
            id: "item_2",
            skuId: "sku_2",
            skuNameSnapshot: "Canvas Tote Bag / Natural",
            barcodeSnapshot: "9555000000029",
            quantity: 1,
          },
        ],
      },
    ]);
    const stockLedgerGroupBy = vi.fn().mockResolvedValue([
      {
        relatedOrderId: "order_refunded",
        skuId: "sku_1",
        _sum: {
          quantityDelta: 1,
        },
      },
      {
        relatedOrderId: "order_refunded",
        skuId: "sku_2",
        _sum: {
          quantityDelta: 1,
        },
      },
    ]);

    const result = await createPrismaControlCenterRepository(
      createDb({ orderFindMany, stockLedgerGroupBy }),
    ).listReturnRestockCandidates({
      organizationId: "org_1",
      storeScope: {
        allStores: false,
        storeIds: ["store_1"],
      },
    });

    expect(orderFindMany).toHaveBeenCalledWith({
      where: {
        organizationId: "org_1",
        storeId: {
          in: ["store_1"],
        },
        status: "REFUNDED",
      },
      select: {
        id: true,
        organizationId: true,
        storeId: true,
        refundedAt: true,
        store: {
          select: {
            name: true,
            code: true,
          },
        },
        items: {
          select: {
            id: true,
            skuId: true,
            skuNameSnapshot: true,
            barcodeSnapshot: true,
            quantity: true,
          },
        },
      },
      orderBy: {
        refundedAt: "desc",
      },
      take: 8,
    });
    expect(stockLedgerGroupBy).toHaveBeenCalledWith({
      by: ["relatedOrderId", "skuId"],
      where: {
        organizationId: "org_1",
        relatedOrderId: {
          in: ["order_refunded"],
        },
        reason: "RETURN_RESTOCK",
      },
      _sum: {
        quantityDelta: true,
      },
    });
    expect(result).toEqual([
      {
        orderId: "order_refunded",
        organizationId: "org_1",
        storeId: "store_1",
        storeName: "Orchard Central",
        storeCode: "ORCHARD",
        refundedAt,
        items: [
          {
            orderItemId: "item_1",
            skuId: "sku_1",
            skuName: "Classic T-Shirt / Black / M",
            barcode: "9555000000012",
            orderedQuantity: 2,
            quantityRestocked: 1,
            restockableQuantity: 1,
          },
        ],
      },
    ]);
  });
});
