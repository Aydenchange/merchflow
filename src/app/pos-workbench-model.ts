import type { DemoCartSku } from "../server/demo/workbench";

export type CartLine = DemoCartSku & {
  quantity: number;
};

export function addScannedSkuToCart(
  cart: CartLine[],
  scannedSku: DemoCartSku,
): CartLine[] {
  const existingLine = cart.find((line) => line.skuId === scannedSku.skuId);

  if (!existingLine) {
    return [
      ...cart,
      {
        ...scannedSku,
        quantity: 1,
      },
    ];
  }

  return cart.map((line) =>
    line.skuId === scannedSku.skuId
      ? {
          ...scannedSku,
          quantity: line.quantity + 1,
        }
      : line,
  );
}

export function setCartLineQuantity(
  cart: CartLine[],
  skuId: string,
  quantity: number,
): CartLine[] {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return removeCartLine(cart, skuId);
  }

  return cart.map((line) =>
    line.skuId === skuId
      ? {
          ...line,
          quantity,
        }
      : line,
  );
}

export function removeCartLine(cart: CartLine[], skuId: string): CartLine[] {
  return cart.filter((line) => line.skuId !== skuId);
}

export function buildOrderItemsFromCart(cart: CartLine[]) {
  return cart.map((line) => ({
    skuId: line.skuId,
    quantity: line.quantity,
  }));
}

export function getCartSubtotalAmount(cart: CartLine[]) {
  return cart.reduce(
    (subtotal, line) => subtotal + line.priceAmount * line.quantity,
    0,
  );
}
