import type { Prisma, PrismaClient } from "@prisma/client";
import type {
  ControlCenterInventoryOption,
  ControlCenterOrder,
  ControlCenterQuery,
  DemoControlCenterRepository,
} from "./control-center";

type PrismaWithControlCenterAccess = Pick<
  PrismaClient,
  "inventoryBalance" | "order" | "stockLedger"
>;

const orderSelect = {
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
} satisfies Prisma.OrderSelect;

const inventoryOptionSelect = {
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
} satisfies Prisma.InventoryBalanceSelect;

const returnRestockCandidateSelect = {
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
} satisfies Prisma.OrderSelect;

type OrderRow = Prisma.OrderGetPayload<{ select: typeof orderSelect }>;
type InventoryOptionRow = Prisma.InventoryBalanceGetPayload<{
  select: typeof inventoryOptionSelect;
}>;
type ReturnRestockCandidateRow = Prisma.OrderGetPayload<{
  select: typeof returnRestockCandidateSelect;
}>;

export function createPrismaControlCenterRepository(
  db: PrismaWithControlCenterAccess,
): DemoControlCenterRepository {
  return {
    async listRecentOrders(input) {
      const where = scopedWhere(input);

      if (!where) {
        return [];
      }

      const orders = await db.order.findMany({
        where,
        select: orderSelect,
        orderBy: {
          createdAt: "desc",
        },
        take: input.limit,
      });

      return orders.map(mapOrderRow);
    },

    async listInventoryOptions(input) {
      const where = scopedWhere(input);

      if (!where) {
        return [];
      }

      const options = await db.inventoryBalance.findMany({
        where: {
          ...where,
          store: {
            status: "ACTIVE",
          },
          sku: {
            status: "ACTIVE",
          },
        },
        select: inventoryOptionSelect,
        orderBy: [
          {
            storeId: "asc",
          },
          {
            skuId: "asc",
          },
        ],
      });

      return options.map(mapInventoryOptionRow);
    },

    async listReturnRestockCandidates(input) {
      const where = scopedWhere(input);

      if (!where) {
        return [];
      }

      const orders = await db.order.findMany({
        where: {
          ...where,
          status: "REFUNDED",
        },
        select: returnRestockCandidateSelect,
        orderBy: {
          refundedAt: "desc",
        },
        take: 8,
      });

      if (orders.length === 0) {
        return [];
      }

      const restockedQuantities = await db.stockLedger.groupBy({
        by: ["relatedOrderId", "skuId"],
        where: {
          organizationId: input.organizationId,
          relatedOrderId: {
            in: orders.map((order) => order.id),
          },
          reason: "RETURN_RESTOCK",
        },
        _sum: {
          quantityDelta: true,
        },
      });

      return orders
        .map((order) => mapReturnRestockCandidateRow(order, restockedQuantities))
        .filter((candidate) => candidate.items.length > 0);
    },
  };
}

function scopedWhere(input: Omit<ControlCenterQuery, "limit">) {
  if (!input.storeScope.allStores && input.storeScope.storeIds.length === 0) {
    return null;
  }

  return {
    organizationId: input.organizationId,
    ...(input.storeScope.allStores
      ? {}
      : {
          storeId: {
            in: input.storeScope.storeIds,
          },
        }),
  };
}

function mapOrderRow(order: OrderRow): ControlCenterOrder {
  return {
    id: order.id,
    organizationId: order.organizationId,
    storeId: order.storeId,
    storeName: order.store.name,
    storeCode: order.store.code,
    status: order.status,
    totalAmount: order.totalAmount,
    currency: order.currency,
    createdAt: order.createdAt,
    paidAt: order.paidAt,
    fulfilledAt: order.fulfilledAt,
    cancelledAt: order.cancelledAt,
    refundedAt: order.refundedAt,
    payment: order.payment
      ? {
          id: order.payment.id,
          status: order.payment.status,
          amount: order.payment.amount,
          currency: order.payment.currency,
        }
      : null,
  };
}

function mapInventoryOptionRow(
  option: InventoryOptionRow,
): ControlCenterInventoryOption {
  return {
    organizationId: option.organizationId,
    storeId: option.storeId,
    storeName: option.store.name,
    storeCode: option.store.code,
    skuId: option.sku.id,
    skuName: option.sku.name,
    barcode: option.sku.barcode,
    quantityOnHand: option.quantityOnHand,
    lowStockThreshold: option.lowStockThreshold,
  };
}

function mapReturnRestockCandidateRow(
  order: ReturnRestockCandidateRow,
  restockedQuantities: Array<{
    relatedOrderId: string | null;
    skuId: string;
    _sum: {
      quantityDelta: number | null;
    };
  }>,
) {
  const restockedQuantityBySku = new Map<string, number>();

  for (const item of restockedQuantities) {
    if (item.relatedOrderId !== order.id) {
      continue;
    }

    restockedQuantityBySku.set(item.skuId, item._sum.quantityDelta ?? 0);
  }

  return {
    orderId: order.id,
    organizationId: order.organizationId,
    storeId: order.storeId,
    storeName: order.store.name,
    storeCode: order.store.code,
    refundedAt: order.refundedAt,
    items: order.items
      .map((item) => {
        const quantityRestocked = restockedQuantityBySku.get(item.skuId) ?? 0;
        const restockableQuantity = item.quantity - quantityRestocked;

        return {
          orderItemId: item.id,
          skuId: item.skuId,
          skuName: item.skuNameSnapshot,
          barcode: item.barcodeSnapshot,
          orderedQuantity: item.quantity,
          quantityRestocked,
          restockableQuantity,
        };
      })
      .filter((item) => item.restockableQuantity > 0),
  };
}
