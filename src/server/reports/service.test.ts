import { describe, expect, it } from "vitest";
import type { AuthContext } from "../authz/types";
import { InvalidReportInputError } from "./errors";
import {
  getBasicSalesReport,
  listLowStockItems,
  listReorderSuggestions,
  type BasicSalesReport,
  type LowStockItem,
  type LowStockReportQuery,
  type ReportsRepository,
  type ReorderSuggestion,
  type ReorderSuggestionQuery,
  type SalesReportQuery,
} from "./service";

function authContext(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    userId: "user_1",
    membershipId: "membership_1",
    organizationId: "org_1",
    role: "MANAGER",
    status: "ACTIVE",
    assignedStoreIds: ["store_1", "store_2"],
    ...overrides,
  };
}

function lowStockItem(overrides: Partial<LowStockItem> = {}): LowStockItem {
  return {
    organizationId: "org_1",
    storeId: "store_1",
    storeName: "Orchard Central",
    storeCode: "SG-ORC",
    skuId: "sku_1",
    skuName: "Classic T-Shirt / Black / M",
    barcode: "9555000000012",
    quantityOnHand: 2,
    lowStockThreshold: 5,
    ...overrides,
  };
}

function reorderSuggestion(
  overrides: Partial<ReorderSuggestion> = {},
): ReorderSuggestion {
  return {
    organizationId: "org_1",
    storeId: "store_1",
    storeName: "Orchard Central",
    storeCode: "SG-ORC",
    skuId: "sku_1",
    skuName: "Classic T-Shirt / Black / M",
    barcode: "9555000000012",
    quantityOnHand: 2,
    lowStockThreshold: 5,
    targetQuantity: 10,
    suggestedReorderQuantity: 8,
    urgency: "LOW",
    ...overrides,
  };
}

function salesReport(
  overrides: Partial<BasicSalesReport> = {},
): BasicSalesReport {
  return {
    organizationId: "org_1",
    dateFrom: new Date("2026-05-01T00:00:00.000Z"),
    dateTo: new Date("2026-05-31T23:59:59.000Z"),
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
        skuId: "sku_1",
        skuName: "Classic T-Shirt / Black / M",
        barcode: "9555000000012",
        quantitySold: 4,
        salesAmount: 5196,
      },
    ],
    ...overrides,
  };
}

function repository(
  overrides: Partial<ReportsRepository> = {},
): ReportsRepository {
  return {
    async listLowStockItems() {
      return [lowStockItem()];
    },
    async getBasicSalesReport(input) {
      return salesReport({
        organizationId: input.organizationId,
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
        storeScope: input.storeScope,
      });
    },
    async listReorderSuggestions() {
      return [reorderSuggestion()];
    },
    ...overrides,
  };
}

describe("reports service", () => {
  it("lets owner list low stock across all stores by default", async () => {
    const calls: LowStockReportQuery[] = [];

    await listLowStockItems(
      authContext({ role: "OWNER", assignedStoreIds: [] }),
      {},
      repository({
        async listLowStockItems(input) {
          calls.push(input);
          return [];
        },
      }),
    );

    expect(calls).toEqual([
      {
        organizationId: "org_1",
        storeScope: {
          allStores: true,
          storeIds: [],
        },
      },
    ]);
  });

  it("lets owner filter low stock by selected stores", async () => {
    const calls: LowStockReportQuery[] = [];

    await listLowStockItems(
      authContext({ role: "OWNER", assignedStoreIds: [] }),
      { storeIds: ["store_2", "store_2", "store_1"] },
      repository({
        async listLowStockItems(input) {
          calls.push(input);
          return [];
        },
      }),
    );

    expect(calls[0].storeScope).toEqual({
      allStores: false,
      storeIds: ["store_2", "store_1"],
    });
  });

  it("scopes manager low stock to assigned stores by default", async () => {
    const calls: LowStockReportQuery[] = [];

    await listLowStockItems(
      authContext({ role: "MANAGER", assignedStoreIds: ["store_1"] }),
      {},
      repository({
        async listLowStockItems(input) {
          calls.push(input);
          return [];
        },
      }),
    );

    expect(calls[0].storeScope).toEqual({
      allStores: false,
      storeIds: ["store_1"],
    });
  });

  it("denies manager requesting unassigned store reports", async () => {
    await expect(
      listLowStockItems(
        authContext({ role: "MANAGER", assignedStoreIds: ["store_1"] }),
        { storeIds: ["store_2"] },
        repository(),
      ),
    ).rejects.toThrow("Store access denied");
  });

  it("denies staff report access", async () => {
    await expect(
      listLowStockItems(
        authContext({ role: "STAFF", assignedStoreIds: ["store_1"] }),
        {},
        repository(),
      ),
    ).rejects.toThrow("Role cannot view reports");
  });

  it("rejects sales report with inverted date range", async () => {
    await expect(
      getBasicSalesReport(
        authContext(),
        {
          dateFrom: new Date("2026-05-31T00:00:00.000Z"),
          dateTo: new Date("2026-05-01T00:00:00.000Z"),
        },
        repository(),
      ),
    ).rejects.toThrow(InvalidReportInputError);
  });

  it("passes normalized sales report query to repository", async () => {
    const calls: SalesReportQuery[] = [];
    const dateFrom = new Date("2026-05-01T00:00:00.000Z");
    const dateTo = new Date("2026-05-31T23:59:59.000Z");

    const result = await getBasicSalesReport(
      authContext({ role: "MANAGER", assignedStoreIds: ["store_1", "store_2"] }),
      {
        dateFrom,
        dateTo,
        storeIds: ["store_2"],
        topSkuLimit: 3,
      },
      repository({
        async getBasicSalesReport(input) {
          calls.push(input);
          return salesReport({
            dateFrom: input.dateFrom,
            dateTo: input.dateTo,
            storeScope: input.storeScope,
          });
        },
      }),
    );

    expect(calls).toEqual([
      {
        organizationId: "org_1",
        dateFrom,
        dateTo,
        topSkuLimit: 3,
        storeScope: {
          allStores: false,
          storeIds: ["store_2"],
        },
      },
    ]);
    expect(result.storeScope).toEqual({
      allStores: false,
      storeIds: ["store_2"],
    });
  });

  it("lets owner list reorder suggestions across all stores by default", async () => {
    const calls: ReorderSuggestionQuery[] = [];

    await listReorderSuggestions(
      authContext({ role: "OWNER", assignedStoreIds: [] }),
      {},
      repository({
        async listReorderSuggestions(input) {
          calls.push(input);
          return [];
        },
      }),
    );

    expect(calls).toEqual([
      {
        organizationId: "org_1",
        storeScope: {
          allStores: true,
          storeIds: [],
        },
      },
    ]);
  });

  it("scopes manager reorder suggestions to assigned stores", async () => {
    const calls: ReorderSuggestionQuery[] = [];

    await listReorderSuggestions(
      authContext({ role: "MANAGER", assignedStoreIds: ["store_1"] }),
      {},
      repository({
        async listReorderSuggestions(input) {
          calls.push(input);
          return [];
        },
      }),
    );

    expect(calls[0].storeScope).toEqual({
      allStores: false,
      storeIds: ["store_1"],
    });
  });

  it("denies staff reorder suggestion access", async () => {
    await expect(
      listReorderSuggestions(
        authContext({ role: "STAFF", assignedStoreIds: ["store_1"] }),
        {},
        repository(),
      ),
    ).rejects.toThrow("Role cannot view reports");
  });

  it("rejects empty explicit reorder store filters", async () => {
    await expect(
      listReorderSuggestions(authContext(), { storeIds: [] }, repository()),
    ).rejects.toThrow("Report store filter must not be empty");
  });
});
