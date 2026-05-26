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

export class OrderNotFoundError extends Error {
  constructor(orderId: string) {
    super(`Order ${orderId} was not found`);
    this.name = "OrderNotFoundError";
  }
}

export class InvalidOrderTransitionError extends Error {
  constructor(input: {
    orderId: string;
    currentStatus: string;
    expectedStatus: string;
    targetStatus: string;
  }) {
    super(
      `Order ${input.orderId} cannot transition from ${input.currentStatus} to ${input.targetStatus}; expected ${input.expectedStatus}`,
    );
    this.name = "InvalidOrderTransitionError";
  }
}
