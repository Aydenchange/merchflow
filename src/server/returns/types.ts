export type ReturnRestockOrderStatus =
  | "PENDING_PAYMENT"
  | "PAID"
  | "FULFILLED"
  | "CANCELLED"
  | "PAYMENT_FAILED"
  | "REFUNDED"
  | "PAYMENT_REQUIRES_REVIEW";

export type ReturnRestockOrderItemRecord = {
  orderItemId: string;
  skuId: string;
  skuName: string;
  barcode: string;
  orderedQuantity: number;
};

export type RestockedQuantityRecord = {
  skuId: string;
  quantityRestocked: number;
};

export type ReturnRestockOrderRecord = {
  id: string;
  organizationId: string;
  storeId: string;
  status: ReturnRestockOrderStatus;
  items: ReturnRestockOrderItemRecord[];
  restockedQuantities: RestockedQuantityRecord[];
};

export type ReturnRestockInput = {
  orderId: string;
  items: Array<{
    skuId: string;
    quantity: number;
  }>;
  note: string;
  restockedAt?: Date;
};

export type ApplyReturnRestockInput = {
  organizationId: string;
  orderId: string;
  storeId: string;
  actorMembershipId: string;
  note: string;
  restockedAt: Date;
  items: Array<{
    skuId: string;
    quantity: number;
  }>;
};

export type ReturnRestockResult = {
  organizationId: string;
  orderId: string;
  storeId: string;
  restockedAt: Date;
  items: Array<{
    skuId: string;
    quantity: number;
    quantityOnHand: number;
    ledgerId: string;
  }>;
};
