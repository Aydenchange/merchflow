import { multiplyMoney } from "./money";

type CreateOrderItemSnapshotInput = {
  skuId: string;
  skuName: string;
  barcode: string;
  unitPriceAmount: number;
  quantity: number;
};

export function createOrderItemSnapshot(input: CreateOrderItemSnapshotInput) {
  return {
    skuId: input.skuId,
    skuNameSnapshot: input.skuName,
    barcodeSnapshot: input.barcode,
    unitPriceAmount: input.unitPriceAmount,
    quantity: input.quantity,
    lineTotalAmount: multiplyMoney(input.unitPriceAmount, input.quantity),
  };
}
