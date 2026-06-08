export class SkuNotFoundError extends Error {
  constructor(barcode: string) {
    super(`SKU not found for barcode ${barcode}`);
    this.name = "SkuNotFoundError";
  }
}

export class ArchivedSkuError extends Error {
  constructor(barcode: string) {
    super(`SKU is archived for barcode ${barcode}`);
    this.name = "ArchivedSkuError";
  }
}
