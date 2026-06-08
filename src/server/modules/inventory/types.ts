export type StockAdjustmentReason = "ADJUSTMENT_IN" | "ADJUSTMENT_OUT";

export type StockAdjustmentInput = {
  storeId: string;
  skuId: string;
  quantityDelta: number;
  note: string;
};

export type ApplyStockAdjustmentInput = {
  organizationId: string;
  storeId: string;
  skuId: string;
  quantityDelta: number;
  reason: StockAdjustmentReason;
  actorMembershipId: string;
  note: string;
};

export type StockAdjustmentResult = {
  organizationId: string;
  storeId: string;
  skuId: string;
  quantityDelta: number;
  quantityOnHand: number;
  lowStockThreshold: number;
  reason: StockAdjustmentReason;
  ledgerId: string;
};
