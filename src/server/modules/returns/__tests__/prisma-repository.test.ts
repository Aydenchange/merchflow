import { describe, expect, it, vi } from "vitest";
import { createPrismaReturnRestockRepository } from "../prisma-repository";
import type { ApplyReturnRestockInput } from "../service";

type TransactionClient = {
  inventoryBalance: {
    upsert: ReturnType<typeof vi.fn>;
  };
  stockLedger: {
    create: ReturnType<typeof vi.fn>;
  };
  auditLog: {
    create: ReturnType<typeof vi.fn>;
  };
};

function createTransactionClient(): TransactionClient {
  return {
    inventoryBalance: {
      upsert: vi.fn(),
    },
    stockLedger: {
      create: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  };
}

function createDb(
  tx: TransactionClient,
  overrides: {
    orderFindFirst?: ReturnType<typeof vi.fn>;
    stockLedgerGroupBy?: ReturnType<typeof vi.fn>;
  } = {},
) {
  return {
    order: {
      findFirst: overrides.orderFindFirst ?? vi.fn(),
    },
    stockLedger: {
      groupBy: overrides.stockLedgerGroupBy ?? vi.fn(),
    },
    async $transaction<T>(callback: (client: TransactionClient) => Promise<T>) {
      return callback(tx);
    },
  } as unknown as Parameters<typeof createPrismaReturnRestockRepository>[0];
}

function restockInput(
  overrides: Partial<ApplyReturnRestockInput> = {},
): ApplyReturnRestockInput {
  return {
    organizationId: "org_1",
    orderId: "order_1",
    storeId: "store_1",
    actorMembershipId: "membership_1",
    note: "Item inspected and returned to shelf",
    restockedAt: new Date("2026-05-28T08:00:00.000Z"),
    items: [
      {
        skuId: "sku_1",
        quantity: 1,
      },
    ],
    ...overrides,
  };
}

describe("prisma return restock repository", () => {
  it("loads refunded order items and existing return-restock quantities", async () => {
    const tx = createTransactionClient();
    const orderFindFirst = vi.fn().mockResolvedValue({
      id: "order_1",
      organizationId: "org_1",
      storeId: "store_1",
      status: "REFUNDED",
      items: [
        {
          id: "item_1",
          skuId: "sku_1",
          skuNameSnapshot: "Classic T-Shirt / Black / M",
          barcodeSnapshot: "9555000000012",
          quantity: 2,
        },
      ],
    });
    const stockLedgerGroupBy = vi.fn().mockResolvedValue([
      {
        skuId: "sku_1",
        _sum: {
          quantityDelta: 1,
        },
      },
    ]);

    const result = await createPrismaReturnRestockRepository(
      createDb(tx, { orderFindFirst, stockLedgerGroupBy }),
    ).findOrderForReturnRestock({
      organizationId: "org_1",
      orderId: "order_1",
    });

    expect(orderFindFirst).toHaveBeenCalledWith({
      where: {
        id: "order_1",
        organizationId: "org_1",
      },
      select: {
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
      },
    });
    expect(stockLedgerGroupBy).toHaveBeenCalledWith({
      by: ["skuId"],
      where: {
        organizationId: "org_1",
        relatedOrderId: "order_1",
        reason: "RETURN_RESTOCK",
      },
      _sum: {
        quantityDelta: true,
      },
    });
    expect(result).toEqual({
      id: "order_1",
      organizationId: "org_1",
      storeId: "store_1",
      status: "REFUNDED",
      items: [
        {
          orderItemId: "item_1",
          skuId: "sku_1",
          skuName: "Classic T-Shirt / Black / M",
          barcode: "9555000000012",
          orderedQuantity: 2,
        },
      ],
      restockedQuantities: [
        {
          skuId: "sku_1",
          quantityRestocked: 1,
        },
      ],
    });
  });

  it("returns null without querying ledgers when order is missing", async () => {
    const tx = createTransactionClient();
    const orderFindFirst = vi.fn().mockResolvedValue(null);
    const stockLedgerGroupBy = vi.fn();

    const result = await createPrismaReturnRestockRepository(
      createDb(tx, { orderFindFirst, stockLedgerGroupBy }),
    ).findOrderForReturnRestock({
      organizationId: "org_1",
      orderId: "missing_order",
    });

    expect(result).toBeNull();
    expect(stockLedgerGroupBy).not.toHaveBeenCalled();
  });

  it("increments inventory, writes return-restock ledgers, and records an audit log in one transaction", async () => {
    const tx = createTransactionClient();
    tx.inventoryBalance.upsert.mockResolvedValue({
      organizationId: "org_1",
      storeId: "store_1",
      skuId: "sku_1",
      quantityOnHand: 15,
      lowStockThreshold: 5,
    });
    tx.stockLedger.create.mockResolvedValue({ id: "ledger_1" });
    tx.auditLog.create.mockResolvedValue({});

    const result = await createPrismaReturnRestockRepository(
      createDb(tx),
    ).applyReturnRestock(restockInput());

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
        quantityOnHand: 1,
        lowStockThreshold: 0,
      },
      update: {
        quantityOnHand: {
          increment: 1,
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
        quantityDelta: 1,
        reason: "RETURN_RESTOCK",
        relatedOrderId: "order_1",
        actorMembershipId: "membership_1",
        note: "Item inspected and returned to shelf",
        createdAt: new Date("2026-05-28T08:00:00.000Z"),
      },
      select: {
        id: true,
      },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        organizationId: "org_1",
        storeId: "store_1",
        actorMembershipId: "membership_1",
        action: "return.restocked",
        entityType: "Order",
        entityId: "order_1",
        metadata: {
          note: "Item inspected and returned to shelf",
          restockedAt: "2026-05-28T08:00:00.000Z",
          stockLedgerIds: ["ledger_1"],
          items: [
            {
              skuId: "sku_1",
              quantity: 1,
            },
          ],
        },
      },
    });
    expect(result).toEqual({
      organizationId: "org_1",
      orderId: "order_1",
      storeId: "store_1",
      restockedAt: new Date("2026-05-28T08:00:00.000Z"),
      items: [
        {
          skuId: "sku_1",
          quantity: 1,
          quantityOnHand: 15,
          ledgerId: "ledger_1",
        },
      ],
    });
  });
});
