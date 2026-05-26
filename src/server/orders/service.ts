import { addMoney } from "../../domain/money";
import { createOrderItemSnapshot } from "../../domain/order-pricing";
import { assertCanCreateSale } from "../authz/policy";
import type { AuthContext } from "../authz/types";
import {
  ArchivedOrderSkuError,
  InvalidPosOrderError,
  OrderSkuNotFoundError,
  StoreNotFoundForOrderError,
} from "./errors";
import type {
  CreatedPendingOrder,
  CreatedPosOrder,
  CreatePendingOrderInput,
  CreatePosOrderInput,
  OrderCreationContext,
  OrderableSkuRecord,
  PosOrderStockWarning,
} from "./types";

const DEFAULT_PAYMENT_PROVIDER = "simulated_pos";

export type OrderRepository = {
  getOrderCreationContext(input: {
    organizationId: string;
    storeId: string;
    skuIds: string[];
  }): Promise<OrderCreationContext | null>;
  createPendingOrder(input: CreatePendingOrderInput): Promise<CreatedPendingOrder>;
};

export type {
  CreatedPendingOrder,
  CreatePendingOrderInput,
  OrderCreationContext,
  OrderableSkuRecord,
} from "./types";

type AggregatedOrderItem = {
  skuId: string;
  quantity: number;
};

export async function createPendingPosOrder(
  context: AuthContext,
  input: CreatePosOrderInput,
  repository: OrderRepository,
): Promise<CreatedPosOrder> {
  assertCanCreateSale(context, input.storeId);

  const aggregatedItems = aggregateOrderItems(input.items);

  const orderContext = await repository.getOrderCreationContext({
    organizationId: context.organizationId,
    storeId: input.storeId,
    skuIds: aggregatedItems.map((item) => item.skuId),
  });

  if (!orderContext) {
    throw new StoreNotFoundForOrderError(input.storeId);
  }

  const skuById = new Map(orderContext.skus.map((sku) => [sku.id, sku]));
  const stockWarnings: PosOrderStockWarning[] = [];
  const orderItems = aggregatedItems.map((item) => {
    const sku = skuById.get(item.skuId);

    if (!sku) {
      throw new OrderSkuNotFoundError(item.skuId);
    }

    if (sku.status !== "ACTIVE") {
      throw new ArchivedOrderSkuError(item.skuId);
    }

    const quantityOnHand = sku.inventoryBalance?.quantityOnHand ?? 0;

    if (item.quantity > quantityOnHand) {
      stockWarnings.push({
        skuId: item.skuId,
        requestedQuantity: item.quantity,
        quantityOnHand,
      });
    }

    return createSnapshotForSku(sku, item.quantity);
  });

  const subtotalAmount = orderItems.reduce(
    (sum, item) => addMoney(sum, item.lineTotalAmount),
    0,
  );
  const taxAmount = 0;
  const totalAmount = addMoney(subtotalAmount, taxAmount);

  const order = await repository.createPendingOrder({
    organizationId: context.organizationId,
    storeId: input.storeId,
    customerId: input.customerId,
    createdByMembershipId: context.membershipId,
    currency: orderContext.currency,
    subtotalAmount,
    taxAmount,
    totalAmount,
    paymentProvider: input.paymentProvider ?? DEFAULT_PAYMENT_PROVIDER,
    items: orderItems,
  });

  return {
    ...order,
    stockWarnings,
  };
}

function aggregateOrderItems(
  items: CreatePosOrderInput["items"],
): AggregatedOrderItem[] {
  if (items.length === 0) {
    throw new InvalidPosOrderError("POS order must contain at least one item");
  }

  const aggregatedItems: AggregatedOrderItem[] = [];
  const itemBySkuId = new Map<string, AggregatedOrderItem>();

  for (const item of items) {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new InvalidPosOrderError(
        "POS order item quantity must be a positive integer",
      );
    }

    const existingItem = itemBySkuId.get(item.skuId);

    if (existingItem) {
      existingItem.quantity += item.quantity;
      continue;
    }

    const aggregatedItem = {
      skuId: item.skuId,
      quantity: item.quantity,
    };

    aggregatedItems.push(aggregatedItem);
    itemBySkuId.set(item.skuId, aggregatedItem);
  }

  return aggregatedItems;
}

function createSnapshotForSku(sku: OrderableSkuRecord, quantity: number) {
  return createOrderItemSnapshot({
    skuId: sku.id,
    skuName: sku.name,
    barcode: sku.barcode,
    unitPriceAmount: sku.priceAmount,
    quantity,
  });
}
