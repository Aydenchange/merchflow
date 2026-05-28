import type { Prisma, PrismaClient } from "@prisma/client";
import type { ReturnRestockRepository } from "./service";
import type { ReturnRestockOrderRecord } from "./types";

type PrismaWithReturnRestockAccess = Pick<
  PrismaClient,
  "$transaction" | "order" | "stockLedger"
>;

const balanceSelect = {
  organizationId: true,
  storeId: true,
  skuId: true,
  quantityOnHand: true,
  lowStockThreshold: true,
} satisfies Prisma.InventoryBalanceSelect;

const returnRestockOrderSelect = {
  id: true,
  organizationId: true,
  storeId: true,
  status: true,
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

type ReturnRestockOrderRow = Prisma.OrderGetPayload<{
  select: typeof returnRestockOrderSelect;
}>;

export function createPrismaReturnRestockRepository(
  db: PrismaWithReturnRestockAccess,
): ReturnRestockRepository {
  return {
    async findOrderForReturnRestock(input) {
      const order = await db.order.findFirst({
        where: {
          id: input.orderId,
          organizationId: input.organizationId,
        },
        select: returnRestockOrderSelect,
      });

      if (!order) {
        return null;
      }

      const restockedQuantities = await db.stockLedger.groupBy({
        by: ["skuId"],
        where: {
          organizationId: input.organizationId,
          relatedOrderId: input.orderId,
          reason: "RETURN_RESTOCK",
        },
        _sum: {
          quantityDelta: true,
        },
      });

      return mapReturnRestockOrder(order, restockedQuantities);
    },

    async applyReturnRestock(input) {
      return db.$transaction(async (tx) => {
        const restockedItems = [];
        const stockLedgerIds: string[] = [];

        for (const item of input.items) {
          const balance = await tx.inventoryBalance.upsert({
            where: {
              organizationId_storeId_skuId: {
                organizationId: input.organizationId,
                storeId: input.storeId,
                skuId: item.skuId,
              },
            },
            create: {
              organizationId: input.organizationId,
              storeId: input.storeId,
              skuId: item.skuId,
              quantityOnHand: item.quantity,
              lowStockThreshold: 0,
            },
            update: {
              quantityOnHand: {
                increment: item.quantity,
              },
            },
            select: balanceSelect,
          });
          const ledger = await tx.stockLedger.create({
            data: {
              organizationId: input.organizationId,
              storeId: input.storeId,
              skuId: item.skuId,
              quantityDelta: item.quantity,
              reason: "RETURN_RESTOCK",
              relatedOrderId: input.orderId,
              actorMembershipId: input.actorMembershipId,
              note: input.note,
              createdAt: input.restockedAt,
            },
            select: {
              id: true,
            },
          });

          stockLedgerIds.push(ledger.id);
          restockedItems.push({
            skuId: item.skuId,
            quantity: item.quantity,
            quantityOnHand: balance.quantityOnHand,
            ledgerId: ledger.id,
          });
        }

        await tx.auditLog.create({
          data: {
            organizationId: input.organizationId,
            storeId: input.storeId,
            actorMembershipId: input.actorMembershipId,
            action: "return.restocked",
            entityType: "Order",
            entityId: input.orderId,
            metadata: {
              note: input.note,
              restockedAt: input.restockedAt.toISOString(),
              stockLedgerIds,
              items: input.items,
            },
          },
        });

        return {
          organizationId: input.organizationId,
          orderId: input.orderId,
          storeId: input.storeId,
          restockedAt: input.restockedAt,
          items: restockedItems,
        };
      });
    },
  };
}

function mapReturnRestockOrder(
  order: ReturnRestockOrderRow,
  restockedQuantities: Array<{
    skuId: string;
    _sum: {
      quantityDelta: number | null;
    };
  }>,
): ReturnRestockOrderRecord {
  return {
    id: order.id,
    organizationId: order.organizationId,
    storeId: order.storeId,
    status: order.status,
    items: order.items.map((item) => ({
      orderItemId: item.id,
      skuId: item.skuId,
      skuName: item.skuNameSnapshot,
      barcode: item.barcodeSnapshot,
      orderedQuantity: item.quantity,
    })),
    restockedQuantities: restockedQuantities.map((item) => ({
      skuId: item.skuId,
      quantityRestocked: item._sum.quantityDelta ?? 0,
    })),
  };
}
