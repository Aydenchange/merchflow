import { describe, expect, it, vi } from "vitest";
import { InsufficientStockError } from "./errors";
import { createPrismaInventoryRepository } from "./prisma-repository";

type TransactionClient = {
  inventoryBalance: {
    upsert: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    findUniqueOrThrow: ReturnType<typeof vi.fn>;
  };
  stockLedger: {
    create: ReturnType<typeof vi.fn>;
  };
};

function createTransactionClient(): TransactionClient {
  return {
    inventoryBalance: {
      upsert: vi.fn(),
      updateMany: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    stockLedger: {
      create: vi.fn(),
    },
  };
}

function createDb(tx: TransactionClient) {
  return {
    async $transaction<T>(callback: (client: TransactionClient) => Promise<T>) {
      return callback(tx);
    },
  } as unknown as Parameters<typeof createPrismaInventoryRepository>[0];
}

describe("prisma inventory repository", () => {
  it("upserts positive adjustment balance and writes ledger in one transaction", async () => {
    const tx = createTransactionClient();
    tx.inventoryBalance.upsert.mockResolvedValue({
      organizationId: "org_1",
      storeId: "store_1",
      skuId: "sku_1",
      quantityOnHand: 12,
      lowStockThreshold: 2,
    });
    tx.stockLedger.create.mockResolvedValue({ id: "ledger_1" });

    const result = await createPrismaInventoryRepository(
      createDb(tx),
    ).applyStockAdjustment({
      organizationId: "org_1",
      storeId: "store_1",
      skuId: "sku_1",
      quantityDelta: 5,
      reason: "ADJUSTMENT_IN",
      actorMembershipId: "membership_1",
      note: "Received stock",
    });

    expect(tx.inventoryBalance.upsert).toHaveBeenCalledWith({
      where: {
        organizationId_storeId_skuId: {
          organizationId: "org_1",
          storeId: "store_1",
          skuId: "sku_1",
        },
      },
      create: {
        organizationId: "org_1",
        storeId: "store_1",
        skuId: "sku_1",
        quantityOnHand: 5,
        lowStockThreshold: 0,
      },
      update: {
        quantityOnHand: {
          increment: 5,
        },
      },
      select: {
        organizationId: true,
        storeId: true,
        skuId: true,
        quantityOnHand: true,
        lowStockThreshold: true,
      },
    });
    expect(tx.stockLedger.create).toHaveBeenCalledWith({
      data: {
        organizationId: "org_1",
        storeId: "store_1",
        skuId: "sku_1",
        quantityDelta: 5,
        reason: "ADJUSTMENT_IN",
        actorMembershipId: "membership_1",
        note: "Received stock",
      },
      select: {
        id: true,
      },
    });
    expect(result).toEqual({
      organizationId: "org_1",
      storeId: "store_1",
      skuId: "sku_1",
      quantityDelta: 5,
      quantityOnHand: 12,
      lowStockThreshold: 2,
      reason: "ADJUSTMENT_IN",
      ledgerId: "ledger_1",
    });
  });

  it("uses guarded update for negative adjustment", async () => {
    const tx = createTransactionClient();
    tx.inventoryBalance.updateMany.mockResolvedValue({ count: 1 });
    tx.inventoryBalance.findUniqueOrThrow.mockResolvedValue({
      organizationId: "org_1",
      storeId: "store_1",
      skuId: "sku_1",
      quantityOnHand: 3,
      lowStockThreshold: 1,
    });
    tx.stockLedger.create.mockResolvedValue({ id: "ledger_2" });

    await createPrismaInventoryRepository(createDb(tx)).applyStockAdjustment({
      organizationId: "org_1",
      storeId: "store_1",
      skuId: "sku_1",
      quantityDelta: -4,
      reason: "ADJUSTMENT_OUT",
      actorMembershipId: "membership_1",
      note: "Damaged items removed",
    });

    expect(tx.inventoryBalance.updateMany).toHaveBeenCalledWith({
      where: {
        organizationId: "org_1",
        storeId: "store_1",
        skuId: "sku_1",
        quantityOnHand: {
          gte: 4,
        },
      },
      data: {
        quantityOnHand: {
          decrement: 4,
        },
      },
    });
    expect(tx.inventoryBalance.findUniqueOrThrow).toHaveBeenCalledWith({
      where: {
        organizationId_storeId_skuId: {
          organizationId: "org_1",
          storeId: "store_1",
          skuId: "sku_1",
        },
      },
      select: {
        organizationId: true,
        storeId: true,
        skuId: true,
        quantityOnHand: true,
        lowStockThreshold: true,
      },
    });
  });

  it("throws insufficient stock and skips ledger when guarded update fails", async () => {
    const tx = createTransactionClient();
    tx.inventoryBalance.updateMany.mockResolvedValue({ count: 0 });
    tx.inventoryBalance.findUnique.mockResolvedValue({ quantityOnHand: 2 });

    await expect(
      createPrismaInventoryRepository(createDb(tx)).applyStockAdjustment({
        organizationId: "org_1",
        storeId: "store_1",
        skuId: "sku_1",
        quantityDelta: -4,
        reason: "ADJUSTMENT_OUT",
        actorMembershipId: "membership_1",
        note: "Shrinkage correction",
      }),
    ).rejects.toThrow(InsufficientStockError);

    expect(tx.stockLedger.create).not.toHaveBeenCalled();
  });
});
