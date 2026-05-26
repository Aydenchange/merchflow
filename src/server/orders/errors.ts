export class InvalidPosOrderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidPosOrderError";
  }
}

export class StoreNotFoundForOrderError extends Error {
  constructor(storeId: string) {
    super(`Store ${storeId} was not found for order creation`);
    this.name = "StoreNotFoundForOrderError";
  }
}

export class OrderSkuNotFoundError extends Error {
  constructor(skuId: string) {
    super(`SKU ${skuId} was not found for order creation`);
    this.name = "OrderSkuNotFoundError";
  }
}

export class ArchivedOrderSkuError extends Error {
  constructor(skuId: string) {
    super(`SKU ${skuId} is archived and cannot be added to a new order`);
    this.name = "ArchivedOrderSkuError";
  }
}
