import type { SerializableControlCenterOrder } from "@/server/demo/control-center";

export function canFulfillOrder(order: SerializableControlCenterOrder) {
  return order.status === "PAID";
}

export function canCancelOrder(order: SerializableControlCenterOrder) {
  return order.status === "PENDING_PAYMENT";
}

export function canRefundOrder(order: SerializableControlCenterOrder) {
  return order.status === "PAID" || order.status === "FULFILLED";
}
