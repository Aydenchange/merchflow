export type OrderableSkuStatus = "ACTIVE" | "ARCHIVED";

export type CreatePosOrderItemInput = {
  skuId: string;
  quantity: number;
};

export type CreatePosOrderInput = {
  storeId: string;
  customerId?: string;
  paymentProvider?: string;
  items: CreatePosOrderItemInput[];
};

export type OrderableSkuRecord = {
  id: string;
  name: string;
  barcode: string;
  priceAmount: number;
  status: OrderableSkuStatus;
  inventoryBalance: {
    quantityOnHand: number;
  } | null;
};

export type OrderCreationContext = {
  currency: string;
  skus: OrderableSkuRecord[];
};

export type CreatePendingOrderItemInput = {
  skuId: string;
  skuNameSnapshot: string;
  barcodeSnapshot: string;
  unitPriceAmount: number;
  quantity: number;
  lineTotalAmount: number;
};

export type CreatePendingOrderInput = {
  organizationId: string;
  storeId: string;
  customerId?: string;
  createdByMembershipId: string;
  currency: string;
  subtotalAmount: number;
  taxAmount: number;
  totalAmount: number;
  paymentProvider: string;
  items: CreatePendingOrderItemInput[];
};

export type CreatedPendingOrderItem = CreatePendingOrderItemInput & {
  id: string;
};

export type CreatedPendingOrder = {
  orderId: string;
  paymentId: string;
  organizationId: string;
  storeId: string;
  status: "PENDING_PAYMENT";
  paymentStatus: "PENDING";
  subtotalAmount: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  items: CreatedPendingOrderItem[];
};

export type PosOrderStockWarning = {
  skuId: string;
  requestedQuantity: number;
  quantityOnHand: number;
};

export type CreatedPosOrder = CreatedPendingOrder & {
  stockWarnings: PosOrderStockWarning[];
};
