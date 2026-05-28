"use client";

import { FormEvent, useState, useTransition } from "react";
import {
  adjustStockAction,
  cancelOrderAction,
  fulfillOrderAction,
  loadControlCenterAction,
  refundOrderAction,
  restockReturnAction,
} from "./actions";
import type {
  ControlCenterInventoryOption,
  DemoControlCenter,
  SerializableControlCenterReturnRestockCandidate,
  SerializableControlCenterOrder,
} from "../server/demo/control-center";
import type { DemoActionResult, DemoContextView } from "../server/demo/workbench";

type ControlCenterProps = {
  context: DemoContextView;
  selectedStoreId: string;
};

type EventTone = "info" | "success" | "warning" | "error";

type ControlEvent = {
  id: string;
  tone: EventTone;
  title: string;
  detail: string;
};

const EMPTY_ORDERS: SerializableControlCenterOrder[] = [];
const EMPTY_INVENTORY_OPTIONS: ControlCenterInventoryOption[] = [];
const EMPTY_RETURN_RESTOCK_CANDIDATES: SerializableControlCenterReturnRestockCandidate[] =
  [];

export function ControlCenter({ context, selectedStoreId }: ControlCenterProps) {
  const [controlResult, setControlResult] =
    useState<DemoActionResult<DemoControlCenter> | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [adjustStoreId, setAdjustStoreId] = useState(
    selectedStoreId || context.selectedStoreId || context.stores[0]?.id || "",
  );
  const [adjustSkuId, setAdjustSkuId] = useState("");
  const [adjustDelta, setAdjustDelta] = useState("1");
  const [adjustNote, setAdjustNote] = useState("");
  const [selectedReturnOrderId, setSelectedReturnOrderId] = useState("");
  const [selectedReturnSkuId, setSelectedReturnSkuId] = useState("");
  const [returnQuantity, setReturnQuantity] = useState("1");
  const [returnNote, setReturnNote] = useState("");
  const [events, setEvents] = useState<ControlEvent[]>([]);
  const [isPending, startTransition] = useTransition();

  const control = controlResult?.ok ? controlResult.data : null;
  const controlError = controlResult && !controlResult.ok
    ? controlResult.message
    : null;
  const orders = control?.orders ?? EMPTY_ORDERS;
  const inventoryOptions = control?.inventoryOptions ?? EMPTY_INVENTORY_OPTIONS;
  const returnRestockCandidates =
    control?.returnRestockCandidates ?? EMPTY_RETURN_RESTOCK_CANDIDATES;
  const selectedOrder =
    orders.find((order) => order.id === selectedOrderId) ?? null;
  const selectedCancelableOrder =
    selectedOrder && canCancelOrder(selectedOrder) ? selectedOrder : null;
  const selectedRefundOrder =
    selectedOrder && canRefundOrder(selectedOrder) ? selectedOrder : null;
  const storeOptions = buildStoreOptions(inventoryOptions, context);
  const skuOptions = inventoryOptions.filter(
    (option) => !adjustStoreId || option.storeId === adjustStoreId,
  );
  const selectedInventoryOption =
    skuOptions.find((option) => option.skuId === adjustSkuId) ?? null;
  const selectedReturnCandidate =
    returnRestockCandidates.find(
      (candidate) => candidate.orderId === selectedReturnOrderId,
    ) ?? null;
  const selectedReturnItem =
    selectedReturnCandidate?.items.find(
      (item) => item.skuId === selectedReturnSkuId,
    ) ?? null;

  function pushEvent(tone: EventTone, title: string, detail: string) {
    setEvents((current) => [
      {
        id: `${Date.now()}_${current.length}`,
        tone,
        title,
        detail,
      },
      ...current,
    ]);
  }

  async function refreshControlCenter() {
    const result = await loadControlCenterAction({
      role: context.role,
      orderLimit: 8,
    });

    setControlResult(result);

    if (result.ok) {
      const nextOrder = result.data.orders.find((order) =>
        canCancelOrder(order) || canFulfillOrder(order) || canRefundOrder(order),
      );
      const nextStoreId =
        adjustStoreId ||
        selectedStoreId ||
        result.data.inventoryOptions[0]?.storeId ||
        "";
      const nextSku = result.data.inventoryOptions.find(
        (option) => option.storeId === nextStoreId,
      );
      const nextReturnCandidate = result.data.returnRestockCandidates[0];
      const nextReturnItem = nextReturnCandidate?.items[0];

      setSelectedOrderId((current) =>
        result.data.orders.some((order) => order.id === current)
          ? current
          : nextOrder?.id ?? "",
      );
      setAdjustStoreId(nextStoreId);
      setAdjustSkuId((current) =>
        result.data.inventoryOptions.some(
          (option) => option.storeId === nextStoreId && option.skuId === current,
        )
          ? current
          : nextSku?.skuId ?? "",
      );
      setSelectedReturnOrderId((current) =>
        result.data.returnRestockCandidates.some(
          (candidate) => candidate.orderId === current,
        )
          ? current
          : nextReturnCandidate?.orderId ?? "",
      );
      setSelectedReturnSkuId((current) =>
        nextReturnCandidate?.items.some((item) => item.skuId === current)
          ? current
          : nextReturnItem?.skuId ?? "",
      );
      pushEvent(
        "info",
        "Control data loaded",
        `${result.data.orders.length} orders, ${result.data.returnRestockCandidates.length} return candidates`,
      );
    } else {
      pushEvent("error", "Control load failed", result.message);
    }

    return result;
  }

  function handleRefresh() {
    startTransition(async () => {
      await refreshControlCenter();
    });
  }

  function handleFulfill(orderId: string) {
    startTransition(async () => {
      const result = await fulfillOrderAction({
        role: context.role,
        orderId,
      });

      if (!result.ok) {
        pushEvent("error", "Fulfillment rejected", result.message);
        return;
      }

      pushEvent(
        "success",
        "Order fulfilled",
        `${result.data.orderId} at ${formatDateTime(result.data.fulfilledAt)}`,
      );
      await refreshControlCenter();
    });
  }

  function handleCancel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedCancelableOrder) {
      pushEvent("warning", "Cancel order required", "Select a pending payment order");
      return;
    }

    startTransition(async () => {
      const result = await cancelOrderAction({
        role: context.role,
        orderId: selectedCancelableOrder.id,
        reason: cancelReason,
      });

      if (!result.ok) {
        pushEvent("error", "Cancellation rejected", result.message);
        return;
      }

      setCancelReason("");
      pushEvent(
        "success",
        "Order cancelled",
        `${result.data.orderId} at ${formatDateTime(result.data.cancelledAt)}`,
      );
      await refreshControlCenter();
    });
  }

  function handleRefund(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedRefundOrder) {
      pushEvent("warning", "Refund order required", "Select a paid or fulfilled order");
      return;
    }

    startTransition(async () => {
      const result = await refundOrderAction({
        role: context.role,
        orderId: selectedRefundOrder.id,
        reason: refundReason,
      });

      if (!result.ok) {
        pushEvent("error", "Refund rejected", result.message);
        return;
      }

      setRefundReason("");
      pushEvent(
        "success",
        "Refund recorded",
        `${result.data.orderId} ${formatMoney(
          result.data.refundAmount,
          result.data.currency,
        )}`,
      );
      await refreshControlCenter();
    });
  }

  function handleStockAdjustment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const quantityDelta = Number(adjustDelta);

    startTransition(async () => {
      const result = await adjustStockAction({
        role: context.role,
        storeId: adjustStoreId,
        skuId: adjustSkuId,
        quantityDelta,
        note: adjustNote,
      });

      if (!result.ok) {
        pushEvent("error", "Stock adjustment rejected", result.message);
        return;
      }

      setAdjustNote("");
      pushEvent(
        "success",
        "Stock adjusted",
        `${result.data.skuId} ${formatSignedQuantity(
          result.data.quantityDelta,
        )}, on hand ${result.data.quantityOnHand}`,
      );
      await refreshControlCenter();
    });
  }

  function handleReturnRestock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedReturnCandidate || !selectedReturnItem) {
      pushEvent("warning", "Return item required", "Select a refunded order item");
      return;
    }

    startTransition(async () => {
      const result = await restockReturnAction({
        role: context.role,
        orderId: selectedReturnCandidate.orderId,
        items: [
          {
            skuId: selectedReturnItem.skuId,
            quantity: Number(returnQuantity),
          },
        ],
        note: returnNote,
      });

      if (!result.ok) {
        pushEvent("error", "Return restock rejected", result.message);
        return;
      }

      setReturnNote("");
      pushEvent(
        "success",
        "Return restocked",
        `${result.data.orderId} ${result.data.items
          .map((item) => `${item.skuId} +${item.quantity}`)
          .join(", ")}`,
      );
      await refreshControlCenter();
    });
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-5 px-4 py-5 sm:px-6 lg:px-8">
      <section className="rounded-md border border-stone-200 bg-white p-4 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px_140px] lg:items-end">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Control
            </p>
            <h2 className="mt-1 text-xl font-semibold text-stone-950">
              Operations control center
            </h2>
            <p className="mt-1 text-sm text-stone-600">
              Fulfill paid orders, record refunds, and adjust store stock with server-side authorization.
            </p>
          </div>

          <div className="grid gap-1 text-sm">
            <span className="font-medium text-stone-700">Role scope</span>
            <span className="grid h-10 items-center rounded-md border border-stone-200 bg-stone-50 px-3 text-sm font-semibold text-stone-950">
              {context.user.organizationRole}
            </span>
          </div>

          <button
            className="h-10 rounded-md bg-stone-950 px-4 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300"
            type="button"
            disabled={isPending}
            onClick={handleRefresh}
          >
            Refresh
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <MetricTile label="Recent orders" value={`${orders.length}`} />
          <MetricTile
            label="Fulfillable"
            value={`${orders.filter(canFulfillOrder).length}`}
          />
          <MetricTile
            label="Inventory rows"
            value={`${inventoryOptions.length}`}
          />
          <MetricTile
            label="Return candidates"
            value={`${returnRestockCandidates.length}`}
          />
        </div>
      </section>

      {controlError ? (
        <section className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">Control center unavailable</p>
          <p className="mt-1">{controlError}</p>
        </section>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
        <section className="rounded-md border border-stone-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
            <h3 className="text-base font-semibold">Recent orders</h3>
            <span className="font-mono text-sm text-stone-500">
              {isPending ? "pending" : "idle"}
            </span>
          </div>

          {!control ? (
            <EmptyState text="Refresh to load order actions" />
          ) : orders.length === 0 ? (
            <EmptyState text="No recent orders in this store scope" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] border-collapse text-sm">
                <thead className="bg-stone-50 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                  <tr>
                    <th className="px-4 py-3">Order</th>
                    <th className="px-4 py-3">Store</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3">Paid</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} className="border-t border-stone-100">
                      <td className="px-4 py-3">
                        <button
                          className="max-w-[180px] truncate font-mono text-xs font-semibold text-stone-950 underline-offset-2 hover:underline"
                          type="button"
                          title={order.id}
                          onClick={() => setSelectedOrderId(order.id)}
                        >
                          {order.id}
                        </button>
                        <p className="mt-1 text-xs text-stone-500">
                          {formatDateTime(order.createdAt)}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-stone-950">
                          {order.storeCode}
                        </p>
                        <p className="mt-1 text-xs text-stone-500">
                          {order.storeName}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge value={order.status} />
                        <p className="mt-1 text-xs text-stone-500">
                          {order.payment?.status ?? "NO_PAYMENT"}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {formatMoney(order.totalAmount, order.currency)}
                      </td>
                      <td className="px-4 py-3 text-xs text-stone-600">
                        {formatDateTime(order.paidAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            className="h-9 rounded-md bg-amber-700 px-3 text-xs font-semibold text-white hover:bg-amber-800 disabled:cursor-not-allowed disabled:bg-stone-300"
                            type="button"
                            disabled={isPending || !canCancelOrder(order)}
                            onClick={() => setSelectedOrderId(order.id)}
                          >
                            Cancel
                          </button>
                          <button
                            className="h-9 rounded-md bg-emerald-700 px-3 text-xs font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-stone-300"
                            type="button"
                            disabled={isPending || !canFulfillOrder(order)}
                            onClick={() => handleFulfill(order.id)}
                          >
                            Fulfill
                          </button>
                          <button
                            className={`h-9 rounded-md border px-3 text-xs font-semibold transition ${
                              selectedOrderId === order.id
                                ? "border-stone-950 bg-stone-950 text-white"
                                : "border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
                            }`}
                            type="button"
                            disabled={isPending}
                            onClick={() => setSelectedOrderId(order.id)}
                          >
                            Select
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="grid content-start gap-5">
          <form
            className="rounded-md border border-stone-200 bg-white p-4 shadow-sm"
            onSubmit={handleCancel}
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold">Cancel unpaid order</h3>
              <StatusBadge value={selectedOrder?.status ?? "NO_ORDER"} />
            </div>

            <dl className="mt-4 grid gap-3 text-sm">
              <InfoRow
                label="Order"
                value={selectedCancelableOrder?.id ?? "Select pending"}
                mono
              />
              <InfoRow
                label="Amount"
                value={
                  selectedCancelableOrder
                    ? formatMoney(
                        selectedCancelableOrder.totalAmount,
                        selectedCancelableOrder.currency,
                      )
                    : formatMoney(0, context.organization.currency)
                }
                mono
              />
            </dl>

            <label className="mt-4 grid gap-1 text-sm font-medium text-stone-700">
              Reason
              <input
                className="h-10 rounded-md border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                value={cancelReason}
                disabled={isPending}
                onChange={(event) => setCancelReason(event.target.value)}
              />
            </label>

            <button
              className="mt-4 h-10 w-full rounded-md bg-amber-700 px-4 text-sm font-semibold text-white transition hover:bg-amber-800 disabled:cursor-not-allowed disabled:bg-stone-300"
              type="submit"
              disabled={isPending || !selectedCancelableOrder}
            >
              Cancel order
            </button>
          </form>

          <form
            className="rounded-md border border-stone-200 bg-white p-4 shadow-sm"
            onSubmit={handleRefund}
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold">Refund</h3>
              <StatusBadge value={selectedOrder?.status ?? "NO_ORDER"} />
            </div>

            <dl className="mt-4 grid gap-3 text-sm">
              <InfoRow
                label="Order"
                value={selectedRefundOrder?.id ?? "Select paid/fulfilled"}
                mono
              />
              <InfoRow
                label="Amount"
                value={
                  selectedRefundOrder
                    ? formatMoney(
                        selectedRefundOrder.totalAmount,
                        selectedRefundOrder.currency,
                      )
                    : formatMoney(0, context.organization.currency)
                }
                mono
              />
            </dl>

            <label className="mt-4 grid gap-1 text-sm font-medium text-stone-700">
              Reason
              <textarea
                className="min-h-24 resize-none rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                value={refundReason}
                disabled={isPending}
                onChange={(event) => setRefundReason(event.target.value)}
              />
            </label>

            <button
              className="mt-4 h-10 w-full rounded-md bg-stone-950 px-4 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300"
              type="submit"
              disabled={isPending || !selectedRefundOrder}
            >
              Record refund
            </button>
          </form>

          <form
            className="rounded-md border border-stone-200 bg-white p-4 shadow-sm"
            onSubmit={handleStockAdjustment}
          >
            <h3 className="text-base font-semibold">Stock adjustment</h3>

            <div className="mt-4 grid gap-3">
              <label className="grid gap-1 text-sm font-medium text-stone-700">
                Store
                <select
                  className="h-10 rounded-md border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  value={adjustStoreId}
                  disabled={isPending || storeOptions.length === 0}
                  onChange={(event) => {
                    const nextStoreId = event.target.value;
                    const nextSku = inventoryOptions.find(
                      (option) => option.storeId === nextStoreId,
                    );

                    setAdjustStoreId(nextStoreId);
                    setAdjustSkuId(nextSku?.skuId ?? "");
                  }}
                >
                  {storeOptions.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.code} - {store.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1 text-sm font-medium text-stone-700">
                SKU
                <select
                  className="h-10 rounded-md border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  value={adjustSkuId}
                  disabled={isPending || skuOptions.length === 0}
                  onChange={(event) => setAdjustSkuId(event.target.value)}
                >
                  {skuOptions.map((option) => (
                    <option key={`${option.storeId}:${option.skuId}`} value={option.skuId}>
                      {option.skuName}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-3 sm:grid-cols-[130px_minmax(0,1fr)]">
                <label className="grid gap-1 text-sm font-medium text-stone-700">
                  Delta
                  <input
                    className="h-10 rounded-md border border-stone-300 bg-white px-3 font-mono text-sm text-stone-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                    type="number"
                    step="1"
                    value={adjustDelta}
                    disabled={isPending}
                    onChange={(event) => setAdjustDelta(event.target.value)}
                  />
                </label>

                <div className="grid gap-1 text-sm">
                  <span className="font-medium text-stone-700">Current stock</span>
                  <span className="grid h-10 items-center rounded-md border border-stone-200 bg-stone-50 px-3 font-mono text-sm font-semibold text-stone-950">
                    {selectedInventoryOption
                      ? `${selectedInventoryOption.quantityOnHand} on hand`
                      : "No SKU selected"}
                  </span>
                </div>
              </div>

              <label className="grid gap-1 text-sm font-medium text-stone-700">
                Note
                <input
                  className="h-10 rounded-md border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  value={adjustNote}
                  disabled={isPending}
                  onChange={(event) => setAdjustNote(event.target.value)}
                />
              </label>
            </div>

            <button
              className="mt-4 h-10 w-full rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-stone-300"
              type="submit"
              disabled={isPending || !adjustStoreId || !adjustSkuId}
            >
              Apply adjustment
            </button>
          </form>

          <form
            className="rounded-md border border-stone-200 bg-white p-4 shadow-sm"
            onSubmit={handleReturnRestock}
          >
            <h3 className="text-base font-semibold">Return restock</h3>

            <div className="mt-4 grid gap-3">
              <label className="grid gap-1 text-sm font-medium text-stone-700">
                Refunded order
                <select
                  className="h-10 rounded-md border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  value={selectedReturnOrderId}
                  disabled={isPending || returnRestockCandidates.length === 0}
                  onChange={(event) => {
                    const nextOrderId = event.target.value;
                    const nextCandidate = returnRestockCandidates.find(
                      (candidate) => candidate.orderId === nextOrderId,
                    );

                    setSelectedReturnOrderId(nextOrderId);
                    setSelectedReturnSkuId(nextCandidate?.items[0]?.skuId ?? "");
                  }}
                >
                  {returnRestockCandidates.length === 0 ? (
                    <option value="">No refunded orders</option>
                  ) : null}
                  {returnRestockCandidates.map((candidate) => (
                    <option key={candidate.orderId} value={candidate.orderId}>
                      {candidate.storeCode} - {shortId(candidate.orderId)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1 text-sm font-medium text-stone-700">
                Item
                <select
                  className="h-10 rounded-md border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  value={selectedReturnSkuId}
                  disabled={isPending || !selectedReturnCandidate}
                  onChange={(event) => setSelectedReturnSkuId(event.target.value)}
                >
                  {selectedReturnCandidate?.items.map((item) => (
                    <option key={item.skuId} value={item.skuId}>
                      {item.skuName}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-3 sm:grid-cols-[130px_minmax(0,1fr)]">
                <label className="grid gap-1 text-sm font-medium text-stone-700">
                  Quantity
                  <input
                    className="h-10 rounded-md border border-stone-300 bg-white px-3 font-mono text-sm text-stone-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                    type="number"
                    min="1"
                    max={selectedReturnItem?.restockableQuantity ?? 1}
                    step="1"
                    value={returnQuantity}
                    disabled={isPending || !selectedReturnItem}
                    onChange={(event) => setReturnQuantity(event.target.value)}
                  />
                </label>

                <div className="grid gap-1 text-sm">
                  <span className="font-medium text-stone-700">Available</span>
                  <span className="grid h-10 items-center rounded-md border border-stone-200 bg-stone-50 px-3 font-mono text-sm font-semibold text-stone-950">
                    {selectedReturnItem
                      ? `${selectedReturnItem.restockableQuantity} restockable`
                      : "No item selected"}
                  </span>
                </div>
              </div>

              <label className="grid gap-1 text-sm font-medium text-stone-700">
                Inspection note
                <input
                  className="h-10 rounded-md border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  value={returnNote}
                  disabled={isPending}
                  onChange={(event) => setReturnNote(event.target.value)}
                />
              </label>
            </div>

            <button
              className="mt-4 h-10 w-full rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-stone-300"
              type="submit"
              disabled={isPending || !selectedReturnCandidate || !selectedReturnItem}
            >
              Restock return
            </button>
          </form>

          <section className="rounded-md border border-stone-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
              <h3 className="text-base font-semibold">Control events</h3>
              <span className="font-mono text-xs text-stone-500">
                {events.length} rows
              </span>
            </div>
            <div className="grid max-h-[300px] overflow-y-auto">
              {events.length === 0 ? (
                <p className="px-4 py-6 text-sm text-stone-500">No events</p>
              ) : (
                events.map((event) => (
                  <div
                    key={event.id}
                    className="border-b border-stone-100 px-4 py-3 last:border-b-0"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-stone-950">
                        {event.title}
                      </p>
                      <span
                        className={`rounded-md px-2 py-1 text-xs font-semibold ${eventToneClass(
                          event.tone,
                        )}`}
                      >
                        {event.tone}
                      </span>
                    </div>
                    <p className="mt-1 break-words text-xs text-stone-600">
                      {event.detail}
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function buildStoreOptions(
  inventoryOptions: ControlCenterInventoryOption[],
  context: DemoContextView,
) {
  if (inventoryOptions.length === 0) {
    return context.stores.map((store) => ({
      id: store.id,
      name: store.name,
      code: store.code,
    }));
  }

  const storeById = new Map<string, { id: string; name: string; code: string }>();

  for (const option of inventoryOptions) {
    storeById.set(option.storeId, {
      id: option.storeId,
      name: option.storeName,
      code: option.storeCode,
    });
  }

  return [...storeById.values()];
}

function canFulfillOrder(order: SerializableControlCenterOrder) {
  return order.status === "PAID";
}

function canCancelOrder(order: SerializableControlCenterOrder) {
  return order.status === "PENDING_PAYMENT";
}

function canRefundOrder(order: SerializableControlCenterOrder) {
  return order.status === "PAID" || order.status === "FULFILLED";
}

function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-3">
      <dt className="text-stone-500">{label}</dt>
      <dd
        className={`min-w-0 truncate text-right font-medium text-stone-950 ${
          mono ? "font-mono text-xs" : ""
        }`}
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
        {label}
      </p>
      <p className="mt-2 truncate font-mono text-xl font-semibold text-stone-950">
        {value}
      </p>
    </div>
  );
}

function StatusBadge({ value }: { value: string }) {
  return (
    <span
      className={`inline-flex max-w-[180px] truncate rounded-md border px-2 py-1 text-xs font-semibold ${statusClass(
        value,
      )}`}
      title={value}
    >
      {value}
    </span>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="grid min-h-[220px] place-items-center px-4 py-8 text-center text-sm text-stone-500">
      {text}
    </div>
  );
}

function statusClass(value: string) {
  if (
    value === "PAID" ||
    value === "FULFILLED" ||
    value === "SUCCEEDED"
  ) {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  if (
    value === "PAYMENT_REQUIRES_REVIEW" ||
    value === "REQUIRES_REVIEW"
  ) {
    return "border-red-200 bg-red-50 text-red-800";
  }

  if (value === "PENDING_PAYMENT" || value === "PENDING" || value === "NO_ORDER") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  return "border-stone-200 bg-stone-50 text-stone-700";
}

function eventToneClass(tone: EventTone) {
  switch (tone) {
    case "success":
      return "bg-emerald-50 text-emerald-800";
    case "warning":
      return "bg-amber-50 text-amber-800";
    case "error":
      return "bg-red-50 text-red-800";
    case "info":
      return "bg-stone-100 text-stone-700";
  }
}

function formatSignedQuantity(value: number) {
  return value > 0 ? `+${value}` : `${value}`;
}

function shortId(value: string) {
  return value.length > 8 ? value.slice(0, 8) : value;
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "None";
  }

  return new Intl.DateTimeFormat("en-SG", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency,
  }).format(amount / 100);
}
