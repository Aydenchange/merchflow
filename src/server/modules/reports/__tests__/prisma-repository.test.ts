import { describe, expect, it, vi } from "vitest";
import { createPrismaReportsRepository } from "../prisma-repository";

function createDb(overrides: {
  inventoryBalanceFindMany?: ReturnType<typeof vi.fn>;
  organizationFindUnique?: ReturnType<typeof vi.fn>;
  orderAggregate?: ReturnType<typeof vi.fn>;
  orderItemGroupBy?: ReturnType<typeof vi.fn>;
  orderItemFindMany?: ReturnType<typeof vi.fn>;
} = {}) {
  return {
    inventoryBalance: {
      findMany: overrides.inventoryBalanceFindMany ?? vi.fn(),
    },
    organization: {
      findUnique: overrides.organizationFindUnique ?? vi.fn(),
    },
    order: {
      aggregate: overrides.orderAggregate ?? vi.fn(),
    },
    orderItem: {
      groupBy: overrides.orderItemGroupBy ?? vi.fn(),
      findMany: overrides.orderItemFindMany ?? vi.fn(),
    },
  } as unknown as Parameters<typeof createPrismaReportsRepository>[0];
}

describe("prisma reports repository", () => {
  it("queries and maps low-stock rows with tenant, store, sku, and threshold scope", async () => {
    const inventoryBalanceFindMany = vi.fn().mockResolvedValue([
      {
        organizationId: "org_1",
        storeId: "store_1",
        quantityOnHand: 2,
        lowStockThreshold: 5,
        store: {
          name: "Orchard Central",
          code: "SG-ORC",
        },
        sku: {
          id: "sku_1",
          name: "Classic T-Shirt / Black / M",
          barcode: "9555000000012",
        },
      },
      {
        organizationId: "org_1",
        storeId: "store_2",
        quantityOnHand: 8,
        lowStockThreshold: 5,
        store: {
          name: "KLCC Pop-up",
          code: "MY-KLC",
        },
        sku: {
          id: "sku_2",
          name: "Canvas Tote Bag",
          barcode: "9555000000029",
        },
      },
    ]);

    const result = await createPrismaReportsRepository(
      createDb({ inventoryBalanceFindMany }),
    ).listLowStockItems({
      organizationId: "org_1",
      storeScope: {
        allStores: false,
        storeIds: ["store_1", "store_2"],
      },
    });

    expect(inventoryBalanceFindMany).toHaveBeenCalledWith({
      where: {
        organizationId: "org_1",
        storeId: {
          in: ["store_1", "store_2"],
        },
        lowStockThreshold: {
          gt: 0,
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
    });
    expect(result).toEqual([
      {
        organizationId: "org_1",
        storeId: "store_1",
        storeName: "Orchard Central",
        storeCode: "SG-ORC",
        skuId: "sku_1",
        skuName: "Classic T-Shirt / Black / M",
        barcode: "9555000000012",
        quantityOnHand: 2,
        lowStockThreshold: 5,
      },
    ]);
  });

  it("omits store id filter for owner all-store low-stock query", async () => {
    const inventoryBalanceFindMany = vi.fn().mockResolvedValue([]);

    await createPrismaReportsRepository(
      createDb({ inventoryBalanceFindMany }),
    ).listLowStockItems({
      organizationId: "org_1",
      storeScope: {
        allStores: true,
        storeIds: [],
      },
    });

    expect(inventoryBalanceFindMany.mock.calls[0][0].where).not.toHaveProperty(
      "storeId",
    );
  });

  it("maps low-stock inventory rows into reorder suggestions", async () => {
    const inventoryBalanceFindMany = vi.fn().mockResolvedValue([
      {
        organizationId: "org_1",
        storeId: "store_1",
        quantityOnHand: 0,
        lowStockThreshold: 5,
        store: {
          name: "Orchard Central",
          code: "SG-ORC",
        },
        sku: {
          id: "sku_1",
          name: "Classic T-Shirt / Black / M",
          barcode: "9555000000012",
        },
      },
      {
        organizationId: "org_1",
        storeId: "store_1",
        quantityOnHand: 1,
        lowStockThreshold: 5,
        store: {
          name: "Orchard Central",
          code: "SG-ORC",
        },
        sku: {
          id: "sku_2",
          name: "Canvas Tote Bag",
          barcode: "9555000000029",
        },
      },
      {
        organizationId: "org_1",
        storeId: "store_2",
        quantityOnHand: 5,
        lowStockThreshold: 5,
        store: {
          name: "KLCC Pop-up",
          code: "MY-KLC",
        },
        sku: {
          id: "sku_3",
          name: "Ceramic Mug",
          barcode: "9555000000036",
        },
      },
      {
        organizationId: "org_1",
        storeId: "store_2",
        quantityOnHand: 8,
        lowStockThreshold: 5,
        store: {
          name: "KLCC Pop-up",
          code: "MY-KLC",
        },
        sku: {
          id: "sku_4",
          name: "Notebook",
          barcode: "9555000000043",
        },
      },
    ]);

    const result = await createPrismaReportsRepository(
      createDb({ inventoryBalanceFindMany }),
    ).listReorderSuggestions({
      organizationId: "org_1",
      storeScope: {
        allStores: false,
        storeIds: ["store_1", "store_2"],
      },
    });

    expect(inventoryBalanceFindMany).toHaveBeenCalledWith({
      where: {
        organizationId: "org_1",
        storeId: {
          in: ["store_1", "store_2"],
        },
        lowStockThreshold: {
          gt: 0,
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
    });
    expect(result).toEqual([
      {
        organizationId: "org_1",
        storeId: "store_1",
        storeName: "Orchard Central",
        storeCode: "SG-ORC",
        skuId: "sku_1",
        skuName: "Classic T-Shirt / Black / M",
        barcode: "9555000000012",
        quantityOnHand: 0,
        lowStockThreshold: 5,
        targetQuantity: 10,
        suggestedReorderQuantity: 10,
        urgency: "OUT_OF_STOCK",
      },
      {
        organizationId: "org_1",
        storeId: "store_1",
        storeName: "Orchard Central",
        storeCode: "SG-ORC",
        skuId: "sku_2",
        skuName: "Canvas Tote Bag",
        barcode: "9555000000029",
        quantityOnHand: 1,
        lowStockThreshold: 5,
        targetQuantity: 10,
        suggestedReorderQuantity: 9,
        urgency: "CRITICAL",
      },
      {
        organizationId: "org_1",
        storeId: "store_2",
        storeName: "KLCC Pop-up",
        storeCode: "MY-KLC",
        skuId: "sku_3",
        skuName: "Ceramic Mug",
        barcode: "9555000000036",
        quantityOnHand: 5,
        lowStockThreshold: 5,
        targetQuantity: 10,
        suggestedReorderQuantity: 5,
        urgency: "LOW",
      },
    ]);
  });

  it("aggregates completed and refunded sales separately and preserves top sku order", async () => {
    const dateFrom = new Date("2026-05-01T00:00:00.000Z");
    const dateTo = new Date("2026-05-31T23:59:59.000Z");
    const organizationFindUnique = vi.fn().mockResolvedValue({
      currency: "SGD",
    });
    const orderAggregate = vi
      .fn()
      .mockResolvedValueOnce({
        _sum: {
          totalAmount: 12000,
        },
        _count: {
          _all: 6,
        },
      })
      .mockResolvedValueOnce({
        _sum: {
          totalAmount: 2000,
        },
        _count: {
          _all: 1,
        },
      });
    const orderItemGroupBy = vi.fn().mockResolvedValue([
      {
        skuId: "sku_2",
        _sum: {
          quantity: 6,
          lineTotalAmount: 9000,
        },
      },
      {
        skuId: "sku_1",
        _sum: {
          quantity: 4,
          lineTotalAmount: 5196,
        },
      },
    ]);
    const orderItemFindMany = vi.fn().mockResolvedValue([
      {
        skuId: "sku_1",
        skuNameSnapshot: "Classic T-Shirt / Black / M",
        barcodeSnapshot: "9555000000012",
      },
      {
        skuId: "sku_2",
        skuNameSnapshot: "Canvas Tote Bag",
        barcodeSnapshot: "9555000000029",
      },
    ]);

    const result = await createPrismaReportsRepository(
      createDb({
        organizationFindUnique,
        orderAggregate,
        orderItemGroupBy,
        orderItemFindMany,
      }),
    ).getBasicSalesReport({
      organizationId: "org_1",
      dateFrom,
      dateTo,
      topSkuLimit: 2,
      storeScope: {
        allStores: false,
        storeIds: ["store_1"],
      },
    });

    expect(organizationFindUnique).toHaveBeenCalledWith({
      where: {
        id: "org_1",
      },
      select: {
        currency: true,
      },
    });
    expect(orderAggregate).toHaveBeenNthCalledWith(1, {
      where: {
        organizationId: "org_1",
        storeId: {
          in: ["store_1"],
        },
        paidAt: {
          gte: dateFrom,
          lte: dateTo,
        },
        status: {
          in: ["PAID", "FULFILLED"],
        },
      },
      _sum: {
        totalAmount: true,
      },
      _count: {
        _all: true,
      },
    });
    expect(orderAggregate).toHaveBeenNthCalledWith(2, {
      where: {
        organizationId: "org_1",
        storeId: {
          in: ["store_1"],
        },
        paidAt: {
          gte: dateFrom,
          lte: dateTo,
        },
        status: "REFUNDED",
      },
      _sum: {
        totalAmount: true,
      },
      _count: {
        _all: true,
      },
    });
    expect(orderItemGroupBy).toHaveBeenCalledWith({
      by: ["skuId"],
      where: {
        organizationId: "org_1",
        order: {
          organizationId: "org_1",
          storeId: {
            in: ["store_1"],
          },
          paidAt: {
            gte: dateFrom,
            lte: dateTo,
          },
          status: {
            in: ["PAID", "FULFILLED"],
          },
        },
      },
      _sum: {
        quantity: true,
        lineTotalAmount: true,
      },
      orderBy: {
        _sum: {
          quantity: "desc",
        },
      },
      take: 2,
    });
    expect(orderItemFindMany).toHaveBeenCalledWith({
      where: {
        organizationId: "org_1",
        skuId: {
          in: ["sku_2", "sku_1"],
        },
        order: {
          organizationId: "org_1",
          storeId: {
            in: ["store_1"],
          },
          paidAt: {
            gte: dateFrom,
            lte: dateTo,
          },
          status: {
            in: ["PAID", "FULFILLED"],
          },
        },
      },
      select: {
        skuId: true,
        skuNameSnapshot: true,
        barcodeSnapshot: true,
      },
      distinct: ["skuId"],
    });
    expect(result).toEqual({
      organizationId: "org_1",
      dateFrom,
      dateTo,
      storeScope: {
        allStores: false,
        storeIds: ["store_1"],
      },
      grossSalesAmount: 12000,
      grossOrderCount: 6,
      refundedSalesAmount: 2000,
      refundedOrderCount: 1,
      currency: "SGD",
      topSkus: [
        {
          skuId: "sku_2",
          skuName: "Canvas Tote Bag",
          barcode: "9555000000029",
          quantitySold: 6,
          salesAmount: 9000,
        },
        {
          skuId: "sku_1",
          skuName: "Classic T-Shirt / Black / M",
          barcode: "9555000000012",
          quantitySold: 4,
          salesAmount: 5196,
        },
      ],
    });
  });

  it("returns zero sales totals when aggregate sums are null", async () => {
    const dateFrom = new Date("2026-05-01T00:00:00.000Z");
    const dateTo = new Date("2026-05-31T23:59:59.000Z");
    const orderAggregate = vi
      .fn()
      .mockResolvedValueOnce({
        _sum: {
          totalAmount: null,
        },
        _count: {
          _all: 0,
        },
      })
      .mockResolvedValueOnce({
        _sum: {
          totalAmount: null,
        },
        _count: {
          _all: 0,
        },
      });

    const result = await createPrismaReportsRepository(
      createDb({
        organizationFindUnique: vi.fn().mockResolvedValue(null),
        orderAggregate,
        orderItemGroupBy: vi.fn().mockResolvedValue([]),
        orderItemFindMany: vi.fn(),
      }),
    ).getBasicSalesReport({
      organizationId: "org_1",
      dateFrom,
      dateTo,
      topSkuLimit: 5,
      storeScope: {
        allStores: true,
        storeIds: [],
      },
    });

    expect(result.grossSalesAmount).toBe(0);
    expect(result.grossOrderCount).toBe(0);
    expect(result.refundedSalesAmount).toBe(0);
    expect(result.refundedOrderCount).toBe(0);
    expect(result.currency).toBeNull();
    expect(result.topSkus).toEqual([]);
  });
});
