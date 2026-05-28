import { assertCanAdjustStock } from "../authz/policy";
import type { AuthContext } from "../authz/types";
import {
  InvalidReturnRestockError,
  ReturnRestockOrderNotFoundError,
} from "./errors";
import type {
  ApplyReturnRestockInput,
  ReturnRestockInput,
  ReturnRestockOrderRecord,
  ReturnRestockResult,
} from "./types";

export type ReturnRestockRepository = {
  findOrderForReturnRestock(input: {
    organizationId: string;
    orderId: string;
  }): Promise<ReturnRestockOrderRecord | null>;
  applyReturnRestock(
    input: ApplyReturnRestockInput,
  ): Promise<ReturnRestockResult>;
};

export type {
  ApplyReturnRestockInput,
  ReturnRestockOrderRecord,
  ReturnRestockResult,
} from "./types";

export async function recordReturnRestock(
  context: AuthContext,
  input: ReturnRestockInput,
  repository: ReturnRestockRepository,
): Promise<ReturnRestockResult> {
  const note = input.note.trim();

  if (note.length === 0) {
    throw new InvalidReturnRestockError("Return restock note must not be blank");
  }

  const items = aggregateRestockItems(input.items);
  const order = await repository.findOrderForReturnRestock({
    organizationId: context.organizationId,
    orderId: input.orderId,
  });

  if (!order) {
    throw new ReturnRestockOrderNotFoundError(input.orderId);
  }

  assertCanAdjustStock(context, order.storeId);

  if (order.status !== "REFUNDED") {
    throw new InvalidReturnRestockError(
      `Order ${order.id} cannot be restocked from status ${order.status}`,
    );
  }

  assertRestockableQuantities(order, items);

  return repository.applyReturnRestock({
    organizationId: context.organizationId,
    orderId: order.id,
    storeId: order.storeId,
    actorMembershipId: context.membershipId,
    note,
    restockedAt: input.restockedAt ?? new Date(),
    items,
  });
}

function aggregateRestockItems(items: ReturnRestockInput["items"]) {
  if (items.length === 0) {
    throw new InvalidReturnRestockError(
      "Return restock must include at least one item",
    );
  }

  const itemBySkuId = new Map<string, { skuId: string; quantity: number }>();

  for (const item of items) {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new InvalidReturnRestockError(
        "Return restock quantity must be a positive integer",
      );
    }

    const existingItem = itemBySkuId.get(item.skuId);

    if (existingItem) {
      existingItem.quantity += item.quantity;
      continue;
    }

    itemBySkuId.set(item.skuId, {
      skuId: item.skuId,
      quantity: item.quantity,
    });
  }

  return [...itemBySkuId.values()];
}

function assertRestockableQuantities(
  order: ReturnRestockOrderRecord,
  requestedItems: Array<{ skuId: string; quantity: number }>,
) {
  const orderedQuantityBySku = new Map<string, number>();

  for (const item of order.items) {
    orderedQuantityBySku.set(
      item.skuId,
      (orderedQuantityBySku.get(item.skuId) ?? 0) + item.orderedQuantity,
    );
  }

  const restockedQuantityBySku = new Map(
    order.restockedQuantities.map((item) => [
      item.skuId,
      item.quantityRestocked,
    ]),
  );

  for (const item of requestedItems) {
    const orderedQuantity = orderedQuantityBySku.get(item.skuId);

    if (!orderedQuantity) {
      throw new InvalidReturnRestockError(
        `SKU ${item.skuId} is not on order ${order.id}`,
      );
    }

    const remainingQuantity =
      orderedQuantity - (restockedQuantityBySku.get(item.skuId) ?? 0);

    if (item.quantity > remainingQuantity) {
      throw new InvalidReturnRestockError(
        `SKU ${item.skuId} can only restock ${remainingQuantity} more units`,
      );
    }
  }
}
