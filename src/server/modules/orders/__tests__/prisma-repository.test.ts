import { describe, expect, it, vi } from "vitest";
import { createPrismaOrderRepository } from "../prisma-repository";
import type { CreatePendingOrderInput } from "../service";

type TransactionClient = {
  order: {
    create: ReturnType<typeof vi.fn>;
  };
  auditLog: {
    create: ReturnType<typeof vi.fn>;
  };
};

function createTransactionClient(): TransactionClient {
  return {
    order: {
      create: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  };
}

function createDb(input: {
  tx?: TransactionClient;
  storeFindFirst?: ReturnType<typeof vi.fn>;
  skuFindMany?: ReturnType<typeof vi.fn>;
}) {
  const tx = input.tx ?? createTransactionClient();

  return {
    store: {
      findFirst: input.storeFindFirst ?? vi.fn(),
    },
    sku: {
      findMany: input.skuFindMany ?? vi.fn(),
    },
    async $transaction<T>(callback: (client: TransactionClient) => Promise<T>) {
      return callback(tx);
    },
  } as unknown as Parameters<typeof createPrismaOrderRepository>[0];
}

function createPendingOrderInput(
  overrides: Partial<CreatePendingOrderInput> = {},
): CreatePendingOrderInput {
  return {
    organizationId: "org_1",
    storeId: "store_1",
    customerId: "customer_1",
    createdByMembershipId: "membership_1",
    currency: "SGD",
    subtotalAmount: 1299,
    taxAmount: 0,
    totalAmount: 1299,
    paymentProvider: "simulated_pos",
    items: [
      {
        skuId: "sku_1",
        skuNameSnapshot: "Classic T-Shirt / Black / M",
        barcodeSnapshot: "9555000000012",
        unitPriceAmount: 1299,
        quantity: 1,
        lineTotalAmount: 1299,
      },
    ],
    ...overrides,
  };
}

describe("prisma order repository", () => {
  it("loads order creation context from an active organization store", async () => {
    const storeFindFirst = vi.fn().mockResolvedValue({
      organization: {
        currency: "SGD",
      },
    });
    const skuFindMany = vi.fn().mockResolvedValue([
      {
        id: "sku_1",
        name: "Classic T-Shirt / Black / M",
        barcode: "9555000000012",
        priceAmount: 1299,
        status: "ACTIVE",
        inventoryBalances: [{ quantityOnHand: 8 }],
      },
      {
        id: "sku_2",
        name: "Canvas Tote Bag",
        barcode: "9555000000029",
        priceAmount: 2500,
        status: "ACTIVE",
        inventoryBalances: [],
      },
    ]);

    const result = await createPrismaOrderRepository(
      createDb({ storeFindFirst, skuFindMany }),
    ).getOrderCreationContext({
      organizationId: "org_1",
      storeId: "store_1",
      skuIds: ["sku_1", "sku_2"],
    });

    expect(storeFindFirst).toHaveBeenCalledWith({
      where: {
        id: "store_1",
        organizationId: "org_1",
        status: "ACTIVE",
      },
      select: {
        organization: {
          select: {
            currency: true,
          },
        },
      },
    });
    expect(skuFindMany).toHaveBeenCalledWith({
      where: {
        organizationId: "org_1",
        id: {
          in: ["sku_1", "sku_2"],
        },
      },
      select: {
        id: true,
        name: true,
        barcode: true,
        priceAmount: true,
        status: true,
        inventoryBalances: {
          where: {
            organizationId: "org_1",
            storeId: "store_1",
          },
          select: {
            quantityOnHand: true,
          },
          take: 1,
        },
      },
    });
    expect(result).toEqual({
      currency: "SGD",
      skus: [
        {
          id: "sku_1",
          name: "Classic T-Shirt / Black / M",
          barcode: "9555000000012",
          priceAmount: 1299,
          status: "ACTIVE",
          inventoryBalance: { quantityOnHand: 8 },
        },
        {
          id: "sku_2",
          name: "Canvas Tote Bag",
          barcode: "9555000000029",
          priceAmount: 2500,
          status: "ACTIVE",
          inventoryBalance: null,
        },
      ],
    });
  });

  it("returns null order creation context when store is outside organization", async () => {
    const storeFindFirst = vi.fn().mockResolvedValue(null);
    const skuFindMany = vi.fn();

    const result = await createPrismaOrderRepository(
      createDb({ storeFindFirst, skuFindMany }),
    ).getOrderCreationContext({
      organizationId: "org_1",
      storeId: "other_store",
      skuIds: ["sku_1"],
    });

    expect(result).toBeNull();
    expect(skuFindMany).not.toHaveBeenCalled();
  });

  it("creates order, payment, and audit log in one transaction", async () => {
    const tx = createTransactionClient();
    tx.order.create.mockResolvedValue({
      id: "order_1",
      organizationId: "org_1",
      storeId: "store_1",
      subtotalAmount: 1299,
      taxAmount: 0,
      totalAmount: 1299,
      currency: "SGD",
      items: [
        {
          id: "order_item_1",
          skuId: "sku_1",
          skuNameSnapshot: "Classic T-Shirt / Black / M",
          barcodeSnapshot: "9555000000012",
          unitPriceAmount: 1299,
          quantity: 1,
          lineTotalAmount: 1299,
        },
      ],
      payment: {
        id: "payment_1",
      },
    });
    tx.auditLog.create.mockResolvedValue({ id: "audit_1" });

    const result = await createPrismaOrderRepository(
      createDb({ tx }),
    ).createPendingOrder(createPendingOrderInput());

    expect(tx.order.create).toHaveBeenCalledWith({
      data: {
        organizationId: "org_1",
        storeId: "store_1",
        customerId: "customer_1",
        createdByMembershipId: "membership_1",
        status: "PENDING_PAYMENT",
        subtotalAmount: 1299,
        taxAmount: 0,
        totalAmount: 1299,
        currency: "SGD",
        items: {
          create: [
            {
              organizationId: "org_1",
              skuId: "sku_1",
              skuNameSnapshot: "Classic T-Shirt / Black / M",
              barcodeSnapshot: "9555000000012",
              unitPriceAmount: 1299,
              quantity: 1,
              lineTotalAmount: 1299,
            },
          ],
        },
        payment: {
          create: {
            organizationId: "org_1",
            provider: "simulated_pos",
            status: "PENDING",
            amount: 1299,
            currency: "SGD",
          },
        },
      },
      include: {
        items: {
          select: {
            id: true,
            skuId: true,
            skuNameSnapshot: true,
            barcodeSnapshot: true,
            unitPriceAmount: true,
            quantity: true,
            lineTotalAmount: true,
          },
        },
        payment: {
          select: {
            id: true,
          },
        },
      },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        organizationId: "org_1",
        storeId: "store_1",
        actorMembershipId: "membership_1",
        action: "order.created",
        entityType: "Order",
        entityId: "order_1",
        metadata: {
          paymentId: "payment_1",
          totalAmount: 1299,
          itemCount: 1,
        },
      },
    });
    expect(result).toEqual({
      orderId: "order_1",
      paymentId: "payment_1",
      organizationId: "org_1",
      storeId: "store_1",
      status: "PENDING_PAYMENT",
      paymentStatus: "PENDING",
      subtotalAmount: 1299,
      taxAmount: 0,
      totalAmount: 1299,
      currency: "SGD",
      items: [
        {
          id: "order_item_1",
          skuId: "sku_1",
          skuNameSnapshot: "Classic T-Shirt / Black / M",
          barcodeSnapshot: "9555000000012",
          unitPriceAmount: 1299,
          quantity: 1,
          lineTotalAmount: 1299,
        },
      ],
    });
  });
});
