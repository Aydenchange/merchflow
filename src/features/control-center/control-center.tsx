"use client";

import { FormEvent, useState, useTransition } from "react";
import {
  adjustStockAction,
  cancelOrderAction,
  fulfillOrderAction,
  loadControlCenterAction,
  refundOrderAction,
  restockReturnAction,
} from "@/app/actions";
import type {
  ControlCenterInventoryOption,
  DemoControlCenter,
  SerializableControlCenterReturnRestockCandidate,
  SerializableControlCenterOrder,
} from "@/server/demo/control-center";
import type { DemoActionResult, DemoContextView } from "@/server/demo/workbench";
import { EventStream } from "@/features/shared/components/event-stream";
import { MetricTile } from "@/features/shared/components/metric-tile";
import { useTimelineEvents } from "@/features/shared/hooks/use-timeline-events";
import {
  formatDateTime,
  formatMoney,
  formatSignedQuantity,
} from "@/features/shared/formatters/display";
import { CancelOrderPanel } from "./components/cancel-order-panel";
import { RefundPanel } from "./components/refund-panel";
import { RecentOrdersTable } from "./components/recent-orders-table";
import { ReturnRestockPanel } from "./components/return-restock-panel";
import { StockAdjustmentPanel } from "./components/stock-adjustment-panel";
import {
  canCancelOrder,
  canFulfillOrder,
  canRefundOrder,
} from "./model/orders";

type ControlCenterProps = {
  context: DemoContextView;
  selectedStoreId: string;
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
  const { events, pushEvent } = useTimelineEvents();
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

  function handleAdjustStoreChange(nextStoreId: string) {
    const nextSku = inventoryOptions.find(
      (option) => option.storeId === nextStoreId,
    );

    setAdjustStoreId(nextStoreId);
    setAdjustSkuId(nextSku?.skuId ?? "");
  }

  function handleReturnOrderChange(nextOrderId: string) {
    const nextCandidate = returnRestockCandidates.find(
      (candidate) => candidate.orderId === nextOrderId,
    );

    setSelectedReturnOrderId(nextOrderId);
    setSelectedReturnSkuId(nextCandidate?.items[0]?.skuId ?? "");
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
        <RecentOrdersTable
          orders={orders}
          hasLoaded={Boolean(control)}
          isPending={isPending}
          selectedOrderId={selectedOrderId}
          onSelectOrder={setSelectedOrderId}
          onFulfillOrder={handleFulfill}
        />

        <aside className="grid content-start gap-5">
          <CancelOrderPanel
            selectedOrder={selectedOrder}
            cancelableOrder={selectedCancelableOrder}
            cancelReason={cancelReason}
            fallbackCurrency={context.organization.currency}
            isPending={isPending}
            onCancelReasonChange={setCancelReason}
            onSubmit={handleCancel}
          />

          <RefundPanel
            selectedOrder={selectedOrder}
            refundableOrder={selectedRefundOrder}
            refundReason={refundReason}
            fallbackCurrency={context.organization.currency}
            isPending={isPending}
            onRefundReasonChange={setRefundReason}
            onSubmit={handleRefund}
          />

          <StockAdjustmentPanel
            storeOptions={storeOptions}
            skuOptions={skuOptions}
            selectedInventoryOption={selectedInventoryOption}
            storeId={adjustStoreId}
            skuId={adjustSkuId}
            quantityDelta={adjustDelta}
            note={adjustNote}
            isPending={isPending}
            onStoreChange={handleAdjustStoreChange}
            onSkuChange={setAdjustSkuId}
            onQuantityDeltaChange={setAdjustDelta}
            onNoteChange={setAdjustNote}
            onSubmit={handleStockAdjustment}
          />

          <ReturnRestockPanel
            candidates={returnRestockCandidates}
            selectedCandidate={selectedReturnCandidate}
            selectedItem={selectedReturnItem ?? null}
            selectedOrderId={selectedReturnOrderId}
            selectedSkuId={selectedReturnSkuId}
            quantity={returnQuantity}
            note={returnNote}
            isPending={isPending}
            onOrderChange={handleReturnOrderChange}
            onSkuChange={setSelectedReturnSkuId}
            onQuantityChange={setReturnQuantity}
            onNoteChange={setReturnNote}
            onSubmit={handleReturnRestock}
          />

          <EventStream events={events} title="Control events" />
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

