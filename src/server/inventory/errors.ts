export class InvalidStockAdjustmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidStockAdjustmentError";
  }
}

export class InsufficientStockError extends Error {
  constructor(input: {
    storeId: string;
    skuId: string;
    quantityOnHand: number;
    quantityRequested: number;
  }) {
    super(
      `Insufficient stock for SKU ${input.skuId} at store ${input.storeId}: requested ${input.quantityRequested}, available ${input.quantityOnHand}`,
    );
    this.name = "InsufficientStockError";
  }
}
