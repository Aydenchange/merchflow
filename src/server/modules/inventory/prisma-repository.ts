import type { Prisma, PrismaClient } from "@prisma/client";
import { InsufficientStockError } from "./errors";
import type { InventoryRepository } from "./service";

type PrismaWithInventoryAccess = Pick<PrismaClient, "$transaction">;

const balanceSelect = {
  organizationId: true,
  storeId: true,
  skuId: true,
  quantityOnHand: true,
  lowStockThreshold: true,
} satisfies Prisma.InventoryBalanceSelect;

export function createPrismaInventoryRepository(
  db: PrismaWithInventoryAccess,
): InventoryRepository {
  return {
    async applyStockAdjustment(input) {
      return db.$transaction(async (tx) => {
        const balanceKey = {
          organizationId: input.organizationId,
          storeId: input.storeId,
          skuId: input.skuId,
        };

        const balance =
          input.quantityDelta > 0
            ? await tx.inventoryBalance.upsert({
                where: {
                  organizationId_storeId_skuId: balanceKey,
                },
                create: {
                  ...balanceKey,
                  quantityOnHand: input.quantityDelta,
                  lowStockThreshold: 0,
                },
                update: {
                  quantityOnHand: {
                    increment: input.quantityDelta,
                  },
                },
                select: balanceSelect,
              })
            : await decrementStock(tx, {
                ...balanceKey,
                quantityDelta: input.quantityDelta,
              });

        const ledger = await tx.stockLedger.create({
          data: {
            organizationId: input.organizationId,
            storeId: input.storeId,
            skuId: input.skuId,
            quantityDelta: input.quantityDelta,
            reason: input.reason,
            actorMembershipId: input.actorMembershipId,
            note: input.note,
          },
          select: {
            id: true,
          },
        });

        return {
          organizationId: balance.organizationId,
          storeId: balance.storeId,
          skuId: balance.skuId,
          quantityDelta: input.quantityDelta,
          quantityOnHand: balance.quantityOnHand,
          lowStockThreshold: balance.lowStockThreshold,
          reason: input.reason,
          ledgerId: ledger.id,
        };
      });
    },
  };
}

async function decrementStock(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string;
    storeId: string;
    skuId: string;
    quantityDelta: number;
  },
) {
  const decrementBy = Math.abs(input.quantityDelta);

  const updateResult = await tx.inventoryBalance.updateMany({
    where: {
      organizationId: input.organizationId,
      storeId: input.storeId,
      skuId: input.skuId,
      quantityOnHand: {
        gte: decrementBy,
      },
    },
    data: {
      quantityOnHand: {
        decrement: decrementBy,
      },
    },
  });

  if (updateResult.count !== 1) {
    const latestBalance = await tx.inventoryBalance.findUnique({
      where: {
        organizationId_storeId_skuId: {
          organizationId: input.organizationId,
          storeId: input.storeId,
          skuId: input.skuId,
        },
      },
      select: {
        quantityOnHand: true,
      },
    });

    throw new InsufficientStockError({
      storeId: input.storeId,
      skuId: input.skuId,
      quantityOnHand: latestBalance?.quantityOnHand ?? 0,
      quantityRequested: decrementBy,
    });
  }

  return tx.inventoryBalance.findUniqueOrThrow({
    where: {
      organizationId_storeId_skuId: {
        organizationId: input.organizationId,
        storeId: input.storeId,
        skuId: input.skuId,
      },
    },
    select: balanceSelect,
  });
}
