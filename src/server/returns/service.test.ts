import { describe, expect, it } from "vitest";
import type { AuthContext } from "../authz/types";
import {
  InvalidReturnRestockError,
  ReturnRestockOrderNotFoundError,
} from "./errors";
import {
  recordReturnRestock,
  type ApplyReturnRestockInput,
  type ReturnRestockOrderRecord,
  type ReturnRestockRepository,
  type ReturnRestockResult,
} from "./service";

function authContext(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    userId: "user_1",
    membershipId: "membership_1",
    organizationId: "org_1",
    role: "MANAGER",
    status: "ACTIVE",
    assignedStoreIds: ["store_1"],
    ...overrides,
  };
}

function refundedOrder(
  overrides: Partial<ReturnRestockOrderRecord> = {},
): ReturnRestockOrderRecord {
  return {
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
    ...overrides,
  };
}

function result(
  overrides: Partial<ReturnRestockResult> = {},
): ReturnRestockResult {
  return {
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
    ...overrides,
  };
}

function repository(
  overrides: Partial<ReturnRestockRepository> = {},
): ReturnRestockRepository {
  return {
    async findOrderForReturnRestock() {
      return refundedOrder();
    },
    async applyReturnRestock(input) {
      return result({
        organizationId: input.organizationId,
        orderId: input.orderId,
        storeId: input.storeId,
        restockedAt: input.restockedAt,
        items: input.items.map((item) => ({
          skuId: item.skuId,
          quantity: item.quantity,
          quantityOnHand: 15,
          ledgerId: `ledger_${item.skuId}`,
        })),
      });
    },
    ...overrides,
  };
}

describe("recordReturnRestock", () => {
  it("allows manager to restock a refunded order item within remaining quantity", async () => {
    const calls: ApplyReturnRestockInput[] = [];
    const restockedAt = new Date("2026-05-28T08:00:00.000Z");

    const restock = await recordReturnRestock(
      authContext({
        role: "MANAGER",
        assignedStoreIds: ["store_1"],
      }),
      {
        orderId: "order_1",
        items: [{ skuId: "sku_1", quantity: 1 }],
        note: " Item inspected and returned to shelf ",
        restockedAt,
      },
      repository({
        async applyReturnRestock(input) {
          calls.push(input);
          return result({
            restockedAt: input.restockedAt,
            items: input.items.map((item) => ({
              skuId: item.skuId,
              quantity: item.quantity,
              quantityOnHand: 15,
              ledgerId: "ledger_1",
            })),
          });
        },
      }),
    );

    expect(calls).toEqual([
      {
        organizationId: "org_1",
        orderId: "order_1",
        storeId: "store_1",
        actorMembershipId: "membership_1",
        note: "Item inspected and returned to shelf",
        restockedAt,
        items: [
          {
            skuId: "sku_1",
            quantity: 1,
          },
        ],
      },
    ]);
    expect(restock).toEqual(
      result({
        restockedAt,
      }),
    );
  });

  it("aggregates duplicate SKU restock lines", async () => {
    const calls: ApplyReturnRestockInput[] = [];

    await recordReturnRestock(
      authContext({ role: "OWNER", assignedStoreIds: [] }),
      {
        orderId: "order_1",
        items: [
          { skuId: "sku_1", quantity: 1 },
          { skuId: "sku_1", quantity: 1 },
        ],
        note: "Two units inspected",
      },
      repository({
        async findOrderForReturnRestock() {
          return refundedOrder({
            restockedQuantities: [],
          });
        },
        async applyReturnRestock(input) {
          calls.push(input);
          return result();
        },
      }),
    );

    expect(calls[0].items).toEqual([
      {
        skuId: "sku_1",
        quantity: 2,
      },
    ]);
  });

  it("denies staff return restock", async () => {
    await expect(
      recordReturnRestock(
        authContext({ role: "STAFF" }),
        {
          orderId: "order_1",
          items: [{ skuId: "sku_1", quantity: 1 }],
          note: "Returned item",
        },
        repository(),
      ),
    ).rejects.toThrow("Role cannot adjust stock");
  });

  it("rejects missing order", async () => {
    await expect(
      recordReturnRestock(
        authContext(),
        {
          orderId: "missing_order",
          items: [{ skuId: "sku_1", quantity: 1 }],
          note: "Returned item",
        },
        repository({
          async findOrderForReturnRestock() {
            return null;
          },
        }),
      ),
    ).rejects.toThrow(ReturnRestockOrderNotFoundError);
  });

  it("rejects non-refunded order", async () => {
    await expect(
      recordReturnRestock(
        authContext(),
        {
          orderId: "order_1",
          items: [{ skuId: "sku_1", quantity: 1 }],
          note: "Returned item",
        },
        repository({
          async findOrderForReturnRestock() {
            return refundedOrder({ status: "FULFILLED" });
          },
        }),
      ),
    ).rejects.toThrow(InvalidReturnRestockError);
  });

  it("rejects blank note", async () => {
    await expect(
      recordReturnRestock(
        authContext(),
        {
          orderId: "order_1",
          items: [{ skuId: "sku_1", quantity: 1 }],
          note: "   ",
        },
        repository(),
      ),
    ).rejects.toThrow(InvalidReturnRestockError);
  });

  it("rejects invalid restock quantity", async () => {
    await expect(
      recordReturnRestock(
        authContext(),
        {
          orderId: "order_1",
          items: [{ skuId: "sku_1", quantity: 0 }],
          note: "Returned item",
        },
        repository(),
      ),
    ).rejects.toThrow(InvalidReturnRestockError);
  });

  it("rejects SKU that is not on the refunded order", async () => {
    await expect(
      recordReturnRestock(
        authContext(),
        {
          orderId: "order_1",
          items: [{ skuId: "sku_missing", quantity: 1 }],
          note: "Returned item",
        },
        repository(),
      ),
    ).rejects.toThrow("SKU sku_missing is not on order order_1");
  });

  it("rejects restocking more than the remaining sold quantity", async () => {
    await expect(
      recordReturnRestock(
        authContext(),
        {
          orderId: "order_1",
          items: [{ skuId: "sku_1", quantity: 2 }],
          note: "Returned item",
        },
        repository(),
      ),
    ).rejects.toThrow("SKU sku_1 can only restock 1 more units");
  });
});
