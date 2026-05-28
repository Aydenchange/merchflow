import { describe, expect, it } from "vitest";
import type { AuthContextRepository, MembershipRecord } from "../authz/context-loader";
import type {
  LowStockReportQuery,
  ReorderSuggestionQuery,
  SalesReportQuery,
} from "../reports/service";
import type { ReportsRepository } from "../reports/service";
import { loadDemoOperationsDashboard } from "./operations";

function membershipRecord(
  overrides: Partial<MembershipRecord> = {},
): MembershipRecord {
  return {
    userId: "user_owner",
    membershipId: "membership_owner",
    organizationId: "org_merchflow_demo",
    role: "OWNER",
    status: "ACTIVE",
    storeAssignments: [],
    ...overrides,
  };
}

function authRepository(record: MembershipRecord): AuthContextRepository {
  return {
    async findMembershipByUserId() {
      return record;
    },
  };
}

function reportsRepository(
  calls: {
    lowStock: LowStockReportQuery[];
    reorder: ReorderSuggestionQuery[];
    sales: SalesReportQuery[];
  } = {
    lowStock: [],
    reorder: [],
    sales: [],
  },
): ReportsRepository {
  return {
    async listLowStockItems(input) {
      calls.lowStock.push(input);
      return [
        {
          organizationId: input.organizationId,
          storeId: "store_orchard",
          storeName: "Orchard Central",
          storeCode: "ORCHARD",
          skuId: "sku_tote",
          skuName: "Canvas Tote Bag",
          barcode: "9555000000029",
          quantityOnHand: 3,
          lowStockThreshold: 5,
        },
      ];
    },
    async listReorderSuggestions(input) {
      calls.reorder.push(input);
      return [
        {
          organizationId: input.organizationId,
          storeId: "store_orchard",
          storeName: "Orchard Central",
          storeCode: "ORCHARD",
          skuId: "sku_tote",
          skuName: "Canvas Tote Bag",
          barcode: "9555000000029",
          quantityOnHand: 3,
          lowStockThreshold: 5,
          targetQuantity: 10,
          suggestedReorderQuantity: 7,
          urgency: "LOW",
        },
      ];
    },
    async getBasicSalesReport(input) {
      calls.sales.push(input);
      return {
        organizationId: input.organizationId,
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
        storeScope: input.storeScope,
        grossSalesAmount: 129900,
        grossOrderCount: 10,
        refundedSalesAmount: 1299,
        refundedOrderCount: 1,
        currency: "SGD",
        topSkus: [
          {
            skuId: "sku_tshirt_black_m",
            skuName: "Classic T-Shirt / Black / M",
            barcode: "9555000000012",
            quantitySold: 6,
            salesAmount: 7794,
          },
        ],
      };
    },
  };
}

describe("loadDemoOperationsDashboard", () => {
  it("loads owner all-store low-stock and sales reports", async () => {
    const calls = {
      lowStock: [] as LowStockReportQuery[],
      reorder: [] as ReorderSuggestionQuery[],
      sales: [] as SalesReportQuery[],
    };

    const result = await loadDemoOperationsDashboard(
      {
        role: "owner",
        dateFrom: "2026-05-01",
        dateTo: "2026-05-31",
      },
      {
        authRepository: authRepository(membershipRecord()),
        reportsRepository: reportsRepository(calls),
      },
    );

    expect(calls.lowStock).toEqual([
      {
        organizationId: "org_merchflow_demo",
        storeScope: {
          allStores: true,
          storeIds: [],
        },
      },
    ]);
    expect(calls.sales).toEqual([
      {
        organizationId: "org_merchflow_demo",
        dateFrom: new Date("2026-05-01T00:00:00.000Z"),
        dateTo: new Date("2026-05-31T23:59:59.999Z"),
        topSkuLimit: 5,
        storeScope: {
          allStores: true,
          storeIds: [],
        },
      },
    ]);
    expect(calls.reorder).toEqual([
      {
        organizationId: "org_merchflow_demo",
        storeScope: {
          allStores: true,
          storeIds: [],
        },
      },
    ]);
    expect(result).toEqual({
      ok: true,
      data: {
        role: "owner",
        dateFrom: "2026-05-01T00:00:00.000Z",
        dateTo: "2026-05-31T23:59:59.999Z",
        lowStockItems: [
          {
            organizationId: "org_merchflow_demo",
            storeId: "store_orchard",
            storeName: "Orchard Central",
            storeCode: "ORCHARD",
            skuId: "sku_tote",
            skuName: "Canvas Tote Bag",
            barcode: "9555000000029",
            quantityOnHand: 3,
            lowStockThreshold: 5,
          },
        ],
        reorderSuggestions: [
          {
            organizationId: "org_merchflow_demo",
            storeId: "store_orchard",
            storeName: "Orchard Central",
            storeCode: "ORCHARD",
            skuId: "sku_tote",
            skuName: "Canvas Tote Bag",
            barcode: "9555000000029",
            quantityOnHand: 3,
            lowStockThreshold: 5,
            targetQuantity: 10,
            suggestedReorderQuantity: 7,
            urgency: "LOW",
          },
        ],
        salesReport: {
          organizationId: "org_merchflow_demo",
          dateFrom: "2026-05-01T00:00:00.000Z",
          dateTo: "2026-05-31T23:59:59.999Z",
          storeScope: {
            allStores: true,
            storeIds: [],
          },
          grossSalesAmount: 129900,
          grossOrderCount: 10,
          refundedSalesAmount: 1299,
          refundedOrderCount: 1,
          currency: "SGD",
          topSkus: [
            {
              skuId: "sku_tshirt_black_m",
              skuName: "Classic T-Shirt / Black / M",
              barcode: "9555000000012",
              quantitySold: 6,
              salesAmount: 7794,
            },
          ],
        },
      },
    });
  });

  it("loads manager reports scoped to assigned stores by default", async () => {
    const calls = {
      lowStock: [] as LowStockReportQuery[],
      reorder: [] as ReorderSuggestionQuery[],
      sales: [] as SalesReportQuery[],
    };

    const result = await loadDemoOperationsDashboard(
      {
        role: "manager",
        dateFrom: "2026-05-01",
        dateTo: "2026-05-31",
      },
      {
        authRepository: authRepository(
          membershipRecord({
            userId: "user_manager",
            membershipId: "membership_manager",
            role: "MANAGER",
            storeAssignments: [{ storeId: "store_orchard" }],
          }),
        ),
        reportsRepository: reportsRepository(calls),
      },
    );

    expect(result.ok).toBe(true);
    expect(calls.lowStock[0].storeScope).toEqual({
      allStores: false,
      storeIds: ["store_orchard"],
    });
    expect(calls.sales[0].storeScope).toEqual({
      allStores: false,
      storeIds: ["store_orchard"],
    });
    expect(calls.reorder[0].storeScope).toEqual({
      allStores: false,
      storeIds: ["store_orchard"],
    });
  });

  it("passes an explicit store filter to report services", async () => {
    const calls = {
      lowStock: [] as LowStockReportQuery[],
      reorder: [] as ReorderSuggestionQuery[],
      sales: [] as SalesReportQuery[],
    };

    await loadDemoOperationsDashboard(
      {
        role: "owner",
        storeIds: ["store_klcc"],
        dateFrom: "2026-05-01",
        dateTo: "2026-05-31",
        topSkuLimit: 3,
      },
      {
        authRepository: authRepository(membershipRecord()),
        reportsRepository: reportsRepository(calls),
      },
    );

    expect(calls.lowStock[0].storeScope).toEqual({
      allStores: false,
      storeIds: ["store_klcc"],
    });
    expect(calls.sales[0]).toMatchObject({
      topSkuLimit: 3,
      storeScope: {
        allStores: false,
        storeIds: ["store_klcc"],
      },
    });
    expect(calls.reorder[0].storeScope).toEqual({
      allStores: false,
      storeIds: ["store_klcc"],
    });
  });

  it("returns staff report denial as a UI-safe error", async () => {
    const result = await loadDemoOperationsDashboard(
      {
        role: "staff",
        dateFrom: "2026-05-01",
        dateTo: "2026-05-31",
      },
      {
        authRepository: authRepository(
          membershipRecord({
            userId: "user_staff",
            membershipId: "membership_staff",
            role: "STAFF",
            storeAssignments: [{ storeId: "store_orchard" }],
          }),
        ),
        reportsRepository: reportsRepository(),
      },
    );

    expect(result).toEqual({
      ok: false,
      message: "Role cannot view reports",
    });
  });

  it("returns invalid date range as a UI-safe error", async () => {
    const result = await loadDemoOperationsDashboard(
      {
        role: "owner",
        dateFrom: "2026-06-01",
        dateTo: "2026-05-31",
      },
      {
        authRepository: authRepository(membershipRecord()),
        reportsRepository: reportsRepository(),
      },
    );

    expect(result).toEqual({
      ok: false,
      message: "Sales report dateFrom must be before or equal to dateTo",
    });
  });
});
