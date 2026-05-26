import { describe, expect, it } from "vitest";
import { createOrderItemSnapshot } from "./order-pricing";

describe("createOrderItemSnapshot", () => {
  it("snapshots SKU display fields and calculates line total", () => {
    const item = createOrderItemSnapshot({
      skuId: "sku_1",
      skuName: "Classic T-Shirt / Black / M",
      barcode: "9555000000012",
      unitPriceAmount: 1299,
      quantity: 2,
    });

    expect(item).toEqual({
      skuId: "sku_1",
      skuNameSnapshot: "Classic T-Shirt / Black / M",
      barcodeSnapshot: "9555000000012",
      unitPriceAmount: 1299,
      quantity: 2,
      lineTotalAmount: 2598,
    });
  });

  it("rejects zero quantity", () => {
    expect(() =>
      createOrderItemSnapshot({
        skuId: "sku_1",
        skuName: "Classic T-Shirt / Black / M",
        barcode: "9555000000012",
        unitPriceAmount: 1299,
        quantity: 0,
      }),
    ).toThrow("Quantity must be positive");
  });
});
