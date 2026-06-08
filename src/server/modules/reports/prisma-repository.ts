import type { Prisma, PrismaClient } from "@prisma/client";
import type { ReportsRepository } from "./service";
import type {
  ReportStoreScope,
  ReorderUrgency,
  SalesReportQuery,
  TopSkuSales,
} from "./types";

type PrismaWithReportsAccess = Pick<
  PrismaClient,
  "inventoryBalance" | "order" | "orderItem" | "organization"
>;

const COMPLETED_SALE_STATUSES = ["PAID", "FULFILLED"] as const;

export function createPrismaReportsRepository(
  db: PrismaWithReportsAccess,
): ReportsRepository {
  return {
    async listLowStockItems(input) {
      const candidates = await findLowStockCandidates(db, input);

      return candidates
        .filter((item) => item.quantityOnHand <= item.lowStockThreshold)
        .map((item) => ({
          organizationId: item.organizationId,
          storeId: item.storeId,
          storeName: item.store.name,
          storeCode: item.store.code,
          skuId: item.sku.id,
          skuName: item.sku.name,
          barcode: item.sku.barcode,
          quantityOnHand: item.quantityOnHand,
          lowStockThreshold: item.lowStockThreshold,
        }));
    },

    async listReorderSuggestions(input) {
      const candidates = await findLowStockCandidates(db, input);

      return candidates
        .filter((item) => item.quantityOnHand <= item.lowStockThreshold)
        .map((item) => {
          const targetQuantity = item.lowStockThreshold * 2;

          return {
            organizationId: item.organizationId,
            storeId: item.storeId,
            storeName: item.store.name,
            storeCode: item.store.code,
            skuId: item.sku.id,
            skuName: item.sku.name,
            barcode: item.sku.barcode,
            quantityOnHand: item.quantityOnHand,
            lowStockThreshold: item.lowStockThreshold,
            targetQuantity,
            suggestedReorderQuantity: targetQuantity - item.quantityOnHand,
            urgency: resolveReorderUrgency(
              item.quantityOnHand,
              item.lowStockThreshold,
            ),
          };
        });
    },

    async getBasicSalesReport(input) {
      const orderWhere = orderReportWhere(input);
      const completedOrderWhere = {
        ...orderWhere,
        status: {
          in: [...COMPLETED_SALE_STATUSES],
        },
      };

      const [
        organization,
        grossSales,
        refundedSales,
        topSkuGroups,
      ] = await Promise.all([
        db.organization.findUnique({
          where: {
            id: input.organizationId,
          },
          select: {
            currency: true,
          },
        }),
        db.order.aggregate({
          where: completedOrderWhere,
          _sum: {
            totalAmount: true,
          },
          _count: {
            _all: true,
          },
        }),
        db.order.aggregate({
          where: {
            ...orderWhere,
            status: "REFUNDED",
          },
          _sum: {
            totalAmount: true,
          },
          _count: {
            _all: true,
          },
        }),
        db.orderItem.groupBy({
          by: ["skuId"],
          where: {
            organizationId: input.organizationId,
            order: completedOrderWhere,
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
          take: input.topSkuLimit,
        }),
      ]);

      const topSkus = await mapTopSkuSales(db, input, completedOrderWhere, topSkuGroups);

      return {
        organizationId: input.organizationId,
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
        storeScope: input.storeScope,
        grossSalesAmount: grossSales._sum.totalAmount ?? 0,
        grossOrderCount: grossSales._count._all,
        refundedSalesAmount: refundedSales._sum.totalAmount ?? 0,
        refundedOrderCount: refundedSales._count._all,
        currency: organization?.currency ?? null,
        topSkus,
      };
    },
  };
}

async function findLowStockCandidates(
  db: PrismaWithReportsAccess,
  input: {
    organizationId: string;
    storeScope: ReportStoreScope;
  },
) {
  return db.inventoryBalance.findMany({
    where: {
      organizationId: input.organizationId,
      ...storeScopeWhere(input.storeScope),
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
}

function resolveReorderUrgency(
  quantityOnHand: number,
  lowStockThreshold: number,
): ReorderUrgency {
  if (quantityOnHand === 0) {
    return "OUT_OF_STOCK";
  }

  if (quantityOnHand <= Math.floor(lowStockThreshold / 2)) {
    return "CRITICAL";
  }

  return "LOW";
}

function storeScopeWhere(
  storeScope: ReportStoreScope,
): Pick<Prisma.InventoryBalanceWhereInput, "storeId"> {
  if (storeScope.allStores) {
    return {};
  }

  return {
    storeId: {
      in: storeScope.storeIds,
    },
  };
}

function orderReportWhere(input: SalesReportQuery): Prisma.OrderWhereInput {
  return {
    organizationId: input.organizationId,
    ...orderStoreScopeWhere(input.storeScope),
    paidAt: {
      gte: input.dateFrom,
      lte: input.dateTo,
    },
  };
}

function orderStoreScopeWhere(
  storeScope: ReportStoreScope,
): Pick<Prisma.OrderWhereInput, "storeId"> {
  if (storeScope.allStores) {
    return {};
  }

  return {
    storeId: {
      in: storeScope.storeIds,
    },
  };
}

async function mapTopSkuSales(
  db: PrismaWithReportsAccess,
  input: SalesReportQuery,
  completedOrderWhere: Prisma.OrderWhereInput,
  topSkuGroups: Array<{
    skuId: string;
    _sum: {
      quantity: number | null;
      lineTotalAmount: number | null;
    };
  }>,
): Promise<TopSkuSales[]> {
  const topSkuIds = topSkuGroups.map((group) => group.skuId);

  if (topSkuIds.length === 0) {
    return [];
  }

  const snapshots = await db.orderItem.findMany({
    where: {
      organizationId: input.organizationId,
      skuId: {
        in: topSkuIds,
      },
      order: completedOrderWhere,
    },
    select: {
      skuId: true,
      skuNameSnapshot: true,
      barcodeSnapshot: true,
    },
    distinct: ["skuId"],
  });
  const snapshotBySkuId = new Map(
    snapshots.map((snapshot) => [snapshot.skuId, snapshot]),
  );

  return topSkuGroups.map((group) => {
    const snapshot = snapshotBySkuId.get(group.skuId);

    return {
      skuId: group.skuId,
      skuName: snapshot?.skuNameSnapshot ?? "",
      barcode: snapshot?.barcodeSnapshot ?? "",
      quantitySold: group._sum.quantity ?? 0,
      salesAmount: group._sum.lineTotalAmount ?? 0,
    };
  });
}
