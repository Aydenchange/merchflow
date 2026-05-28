import type { Prisma, PrismaClient } from "@prisma/client";
import type {
  ControlCenterInventoryOption,
  ControlCenterOrder,
  ControlCenterQuery,
  DemoControlCenterRepository,
} from "./control-center";

type PrismaWithControlCenterAccess = Pick<
  PrismaClient,
  "inventoryBalance" | "order"
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

type OrderRow = Prisma.OrderGetPayload<{ select: typeof orderSelect }>;
type InventoryOptionRow = Prisma.InventoryBalanceGetPayload<{
  select: typeof inventoryOptionSelect;
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
