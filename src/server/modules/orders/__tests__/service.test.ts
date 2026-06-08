import { describe, expect, it } from "vitest";
import type { AuthContext } from "@/server/modules/authz/types";
import {
  ArchivedOrderSkuError,
  InvalidPosOrderError,
  OrderSkuNotFoundError,
  StoreNotFoundForOrderError,
} from "../errors";
import {
  createPendingPosOrder,
  type CreatedPendingOrder,
  type CreatePendingOrderInput,
  type OrderCreationContext,
  type OrderableSkuRecord,
  type OrderRepository,
} from "../service";

function authContext(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    userId: "user_1",
    membershipId: "membership_1",
    organizationId: "org_1",
    role: "STAFF",
    status: "ACTIVE",
    assignedStoreIds: ["store_1"],
    ...overrides,
  };
}

function skuRecord(
  overrides: Partial<OrderableSkuRecord> = {},
): OrderableSkuRecord {
  return {
    id: "sku_1",
    name: "Classic T-Shirt / Black / M",
    barcode: "9555000000012",
    priceAmount: 1299,
    status: "ACTIVE",
    inventoryBalance: {
      quantityOnHand: 8,
    },
    ...overrides,
  };
}

function orderCreationContext(
  overrides: Partial<OrderCreationContext> = {},
): OrderCreationContext {
  return {
    currency: "SGD",
    skus: [
      skuRecord(),
      skuRecord({
        id: "sku_2",
        name: "Canvas Tote Bag",
        barcode: "9555000000029",
        priceAmount: 2500,
        inventoryBalance: {
          quantityOnHand: 3,
        },
      }),
    ],
    ...overrides,
  };
}

function createdPendingOrder(
  input: CreatePendingOrderInput,
): CreatedPendingOrder {
  return {
    orderId: "order_1",
    paymentId: "payment_1",
    organizationId: input.organizationId,
    storeId: input.storeId,
    status: "PENDING_PAYMENT",
    paymentStatus: "PENDING",
    subtotalAmount: input.subtotalAmount,
    taxAmount: input.taxAmount,
    totalAmount: input.totalAmount,
    currency: input.currency,
    items: input.items.map((item, index) => ({
      id: `order_item_${index + 1}`,
      ...item,
    })),
  };
}

function repository(overrides: Partial<OrderRepository> = {}): OrderRepository {
  return {
    async getOrderCreationContext() {
      return orderCreationContext();
    },
    async createPendingOrder(input) {
      return createdPendingOrder(input);
    },
    ...overrides,
  };
}

describe("createPendingPosOrder", () => {
  it("creates pending order and payment from scanned items", async () => {
    const calls: CreatePendingOrderInput[] = [];

    const result = await createPendingPosOrder(
      authContext(),
      {
        storeId: "store_1",
        customerId: "customer_1",
        items: [
          { skuId: "sku_1", quantity: 1 },
          { skuId: "sku_2", quantity: 2 },
        ],
      },
      repository({
        async createPendingOrder(input) {
          calls.push(input);
          return createdPendingOrder(input);
        },
      }),
    );

    expect(calls).toEqual([
      {
        organizationId: "org_1",
        storeId: "store_1",
        customerId: "customer_1",
        createdByMembershipId: "membership_1",
        currency: "SGD",
        subtotalAmount: 6299,
        taxAmount: 0,
        totalAmount: 6299,
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
          {
            skuId: "sku_2",
            skuNameSnapshot: "Canvas Tote Bag",
            barcodeSnapshot: "9555000000029",
            unitPriceAmount: 2500,
            quantity: 2,
            lineTotalAmount: 5000,
          },
        ],
      },
    ]);
    expect(result).toEqual({
      ...createdPendingOrder(calls[0]),
      stockWarnings: [],
    });
  });

  it("aggregates duplicate sku scans before creating order items", async () => {
    const calls: CreatePendingOrderInput[] = [];

    await createPendingPosOrder(
      authContext(),
      {
        storeId: "store_1",
        items: [
          { skuId: "sku_1", quantity: 1 },
          { skuId: "sku_1", quantity: 2 },
        ],
      },
      repository({
        async createPendingOrder(input) {
          calls.push(input);
          return createdPendingOrder(input);
        },
      }),
    );

    expect(calls[0].items).toEqual([
      {
        skuId: "sku_1",
        skuNameSnapshot: "Classic T-Shirt / Black / M",
        barcodeSnapshot: "9555000000012",
        unitPriceAmount: 1299,
        quantity: 3,
        lineTotalAmount: 3897,
      },
    ]);
  });

  it("returns stock warnings without blocking order creation", async () => {
    const calls: CreatePendingOrderInput[] = [];

    const result = await createPendingPosOrder(
      authContext(),
      {
        storeId: "store_1",
        items: [{ skuId: "sku_1", quantity: 9 }],
      },
      repository({
        async getOrderCreationContext() {
          return orderCreationContext({
            skus: [
              skuRecord({
                inventoryBalance: {
                  quantityOnHand: 2,
                },
              }),
            ],
          });
        },
        async createPendingOrder(input) {
          calls.push(input);
          return createdPendingOrder(input);
        },
      }),
    );

    expect(calls).toHaveLength(1);
    expect(result.stockWarnings).toEqual([
      {
        skuId: "sku_1",
        requestedQuantity: 9,
        quantityOnHand: 2,
      },
    ]);
  });

  it("denies order creation for unassigned store", async () => {
    await expect(
      createPendingPosOrder(
        authContext({ role: "STAFF", assignedStoreIds: ["store_1"] }),
        {
          storeId: "store_2",
          items: [{ skuId: "sku_1", quantity: 1 }],
        },
        repository(),
      ),
    ).rejects.toThrow("Store access denied");
  });

  it("rejects empty cart", async () => {
    await expect(
      createPendingPosOrder(
        authContext(),
        {
          storeId: "store_1",
          items: [],
        },
        repository(),
      ),
    ).rejects.toThrow(InvalidPosOrderError);
  });

  it("rejects zero quantity", async () => {
    await expect(
      createPendingPosOrder(
        authContext(),
        {
          storeId: "store_1",
          items: [{ skuId: "sku_1", quantity: 0 }],
        },
        repository(),
      ),
    ).rejects.toThrow(InvalidPosOrderError);
  });

  it("rejects fractional quantity", async () => {
    await expect(
      createPendingPosOrder(
        authContext(),
        {
          storeId: "store_1",
          items: [{ skuId: "sku_1", quantity: 1.5 }],
        },
        repository(),
      ),
    ).rejects.toThrow(InvalidPosOrderError);
  });

  it("rejects store outside organization even when owner can access all assigned stores", async () => {
    await expect(
      createPendingPosOrder(
        authContext({ role: "OWNER", assignedStoreIds: [] }),
        {
          storeId: "other_org_store",
          items: [{ skuId: "sku_1", quantity: 1 }],
        },
        repository({
          async getOrderCreationContext() {
            return null;
          },
        }),
      ),
    ).rejects.toThrow(StoreNotFoundForOrderError);
  });

  it("rejects missing sku", async () => {
    await expect(
      createPendingPosOrder(
        authContext(),
        {
          storeId: "store_1",
          items: [{ skuId: "missing_sku", quantity: 1 }],
        },
        repository(),
      ),
    ).rejects.toThrow(OrderSkuNotFoundError);
  });

  it("rejects archived sku", async () => {
    await expect(
      createPendingPosOrder(
        authContext(),
        {
          storeId: "store_1",
          items: [{ skuId: "sku_1", quantity: 1 }],
        },
        repository({
          async getOrderCreationContext() {
            return orderCreationContext({
              skus: [skuRecord({ status: "ARCHIVED" })],
            });
          },
        }),
      ),
    ).rejects.toThrow(ArchivedOrderSkuError);
  });
});
