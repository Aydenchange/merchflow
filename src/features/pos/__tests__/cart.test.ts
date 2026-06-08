import { describe, expect, it } from "vitest";
import type { DemoCartSku } from "@/server/demo/workbench";
import {
  addScannedSkuToCart,
  buildOrderItemsFromCart,
  removeCartLine,
  setCartLineQuantity,
} from "../model/cart";

function scannedSku(overrides: Partial<DemoCartSku> = {}): DemoCartSku {
  return {
    skuId: "sku_tshirt_black_m",
    productId: "product_tshirt",
    name: "Classic T-Shirt / Black / M",
    barcode: "9555000000012",
    priceAmount: 1299,
    quantityOnHand: 24,
    lowStockThreshold: 5,
    isLowStock: false,
    ...overrides,
  };
}

describe("pos workbench cart model", () => {
  it("adds a newly scanned sku as quantity one", () => {
    expect(addScannedSkuToCart([], scannedSku())).toEqual([
      {
        ...scannedSku(),
        quantity: 1,
      },
    ]);
  });

  it("increments quantity when the same sku is scanned again", () => {
    expect(
      addScannedSkuToCart(
        [
          {
            ...scannedSku(),
            quantity: 1,
          },
        ],
        scannedSku({ quantityOnHand: 23 }),
      ),
    ).toEqual([
      {
        ...scannedSku({ quantityOnHand: 23 }),
        quantity: 2,
      },
    ]);
  });

  it("keeps different sku lines in scan order", () => {
    const tote = scannedSku({
      skuId: "sku_tote",
      productId: "product_tote",
      name: "Canvas Tote Bag",
      barcode: "9555000000029",
      priceAmount: 2500,
    });

    expect(addScannedSkuToCart([{ ...scannedSku(), quantity: 1 }], tote)).toEqual([
      {
        ...scannedSku(),
        quantity: 1,
      },
      {
        ...tote,
        quantity: 1,
      },
    ]);
  });

  it("updates line quantity and removes non-positive quantities", () => {
    const cart = [{ ...scannedSku(), quantity: 3 }];

    expect(setCartLineQuantity(cart, "sku_tshirt_black_m", 2)).toEqual([
      {
        ...scannedSku(),
        quantity: 2,
      },
    ]);
    expect(setCartLineQuantity(cart, "sku_tshirt_black_m", 0)).toEqual([]);
  });

  it("removes a cart line by sku id", () => {
    expect(removeCartLine([{ ...scannedSku(), quantity: 1 }], "sku_tshirt_black_m")).toEqual(
      [],
    );
  });

  it("builds server action order items from cart lines", () => {
    expect(buildOrderItemsFromCart([{ ...scannedSku(), quantity: 2 }])).toEqual([
      {
        skuId: "sku_tshirt_black_m",
        quantity: 2,
      },
    ]);
  });
});
