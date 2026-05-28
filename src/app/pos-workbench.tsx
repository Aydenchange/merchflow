"use client";

import { FormEvent, useMemo, useState, useTransition } from "react";
import {
  createPosOrderAction,
  loadDemoContextAction,
  lookupSkuAction,
  simulatePaymentSuccessAction,
} from "./actions";
import {
  addScannedSkuToCart,
  buildOrderItemsFromCart,
  getCartSubtotalAmount,
  removeCartLine,
  setCartLineQuantity,
  type CartLine,
} from "./pos-workbench-model";
import type {
  DemoActionResult,
  DemoContextView,
  DemoPaymentSuccessView,
  DemoPosOrderView,
  DemoRole,
} from "../server/demo/workbench";

type PosWorkbenchProps = {
  initialContext: DemoActionResult<DemoContextView>;
};

type EventTone = "info" | "success" | "warning" | "error";

type WorkbenchEvent = {
  id: string;
  tone: EventTone;
  title: string;
  detail: string;
};

const roleOptions: Array<{ value: DemoRole; label: string }> = [
  { value: "owner", label: "Owner" },
  { value: "manager", label: "Manager" },
  { value: "staff", label: "Staff" },
];

export function PosWorkbench({ initialContext }: PosWorkbenchProps) {
  const [contextResult, setContextResult] = useState(initialContext);
  const [selectedStoreId, setSelectedStoreId] = useState(
    initialContext.ok ? initialContext.data.selectedStoreId ?? "" : "",
  );
  const [barcode, setBarcode] = useState(
    initialContext.ok ? initialContext.data.demoBarcode : "",
  );
  const [cart, setCart] = useState<CartLine[]>([]);
  const [activeOrder, setActiveOrder] = useState<DemoPosOrderView | null>(null);
  const [paymentResult, setPaymentResult] =
    useState<DemoPaymentSuccessView | null>(null);
  const [providerEventId, setProviderEventId] = useState("");
  const [events, setEvents] = useState<WorkbenchEvent[]>([]);
  const [isPending, startTransition] = useTransition();

  const context = contextResult.ok ? contextResult.data : null;
  const selectedStore = context?.stores.find(
    (store) => store.id === selectedStoreId,
  );
  const subtotalAmount = useMemo(() => getCartSubtotalAmount(cart), [cart]);
  const currency = context?.organization.currency ?? activeOrder?.currency ?? "SGD";
  const canCreateOrder = cart.length > 0 && Boolean(selectedStoreId) && !activeOrder;
  const paymentSnapshot = paymentResult?.payment;

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

  function resetSale(nextBarcode = barcode) {
    setCart([]);
    setActiveOrder(null);
    setPaymentResult(null);
    setProviderEventId("");
    setBarcode(nextBarcode);
  }

  function handleRoleChange(role: DemoRole) {
    startTransition(async () => {
      const result = await loadDemoContextAction(role);
      setContextResult(result);

      if (!result.ok) {
        resetSale("");
        setSelectedStoreId("");
        pushEvent("error", "Role switch failed", result.message);
        return;
      }

      setSelectedStoreId(result.data.selectedStoreId ?? "");
      resetSale(result.data.demoBarcode);
      pushEvent(
        "info",
        "Role switched",
        `${result.data.user.organizationRole} as ${result.data.user.email}`,
      );
    });
  }

  function handleStoreChange(storeId: string) {
    setSelectedStoreId(storeId);
    resetSale(context?.demoBarcode ?? barcode);
    const nextStore = context?.stores.find((store) => store.id === storeId);
    pushEvent(
      "info",
      "Store changed",
      nextStore ? `${nextStore.code} ${nextStore.name}` : "No store selected",
    );
  }

  function handleScan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!context) {
      pushEvent("error", "Context unavailable", "Reload the demo context first");
      return;
    }

    if (!selectedStoreId) {
      pushEvent("error", "Store required", "Choose a store before scanning");
      return;
    }

    if (activeOrder) {
      pushEvent("warning", "Sale locked", "Start a new sale before scanning");
      return;
    }

    startTransition(async () => {
      const result = await lookupSkuAction({
        role: context.role,
        storeId: selectedStoreId,
        barcode,
      });

      if (!result.ok) {
        pushEvent("error", "Scan rejected", result.message);
        return;
      }

      setCart((current) => addScannedSkuToCart(current, result.data));
      setBarcode(context.demoBarcode);
      pushEvent(
        result.data.isLowStock ? "warning" : "success",
        "SKU scanned",
        `${result.data.name} stock ${result.data.quantityOnHand}`,
      );
    });
  }

  function handleCreateOrder() {
    if (!context || !selectedStoreId || cart.length === 0) {
      return;
    }

    startTransition(async () => {
      const result = await createPosOrderAction({
        role: context.role,
        storeId: selectedStoreId,
        items: buildOrderItemsFromCart(cart),
      });

      if (!result.ok) {
        pushEvent("error", "Order rejected", result.message);
        return;
      }

      setActiveOrder(result.data);
      setPaymentResult(null);
      setProviderEventId(createProviderEventId(result.data.paymentId));
      pushEvent(
        result.data.stockWarnings.length > 0 ? "warning" : "success",
        "Pending order created",
        `${result.data.orderId} ${formatMoney(
          result.data.totalAmount,
          result.data.currency,
        )}`,
      );
    });
  }

  function handlePayment(replay: boolean) {
    if (!activeOrder) {
      return;
    }

    const nextProviderEventId = replay
      ? providerEventId
      : createProviderEventId(activeOrder.paymentId);

    startTransition(async () => {
      const result = await simulatePaymentSuccessAction({
        paymentId: activeOrder.paymentId,
        providerEventId: nextProviderEventId,
      });

      setProviderEventId(nextProviderEventId);

      if (!result.ok) {
        pushEvent("error", "Payment event rejected", result.message);
        return;
      }

      setPaymentResult(result.data);
      pushEvent(
        paymentTone(result.data.result.status),
        "Payment event processed",
        `${result.data.result.status} ${result.data.result.providerEventId}`,
      );
    });
  }

  if (!contextResult.ok) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6 py-10 text-foreground">
        <section className="w-full max-w-lg rounded-md border border-red-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-red-700">
            MerchFlow
          </p>
          <h1 className="mt-3 text-2xl font-semibold">Demo context unavailable</h1>
          <p className="mt-3 text-sm text-stone-600">{contextResult.message}</p>
        </section>
      </main>
    );
  }

  const currentContext = contextResult.data;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              MerchFlow
            </p>
            <h1 className="mt-1 truncate text-2xl font-semibold">
              {currentContext.organization.name}
            </h1>
            <p className="mt-1 text-sm text-stone-600">
              {currentContext.organization.country} retail operations
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[480px]">
            <label className="grid gap-1 text-sm font-medium text-stone-700">
              Role
              <select
                className="h-10 rounded-md border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                value={currentContext.role}
                disabled={isPending}
                onChange={(event) =>
                  handleRoleChange(event.target.value as DemoRole)
                }
              >
                {roleOptions.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-sm font-medium text-stone-700">
              Store
              <select
                className="h-10 rounded-md border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                value={selectedStoreId}
                disabled={isPending || currentContext.stores.length === 0}
                onChange={(event) => handleStoreChange(event.target.value)}
              >
                {currentContext.stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.code} - {store.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:px-8">
        <section className="grid gap-5">
          <div className="rounded-md border border-stone-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
              <form className="grid flex-1 gap-2" onSubmit={handleScan}>
                <label className="text-sm font-medium text-stone-700" htmlFor="barcode">
                  Barcode
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    id="barcode"
                    className="h-12 min-w-0 flex-1 rounded-md border border-stone-300 bg-white px-3 font-mono text-base text-stone-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                    value={barcode}
                    disabled={isPending || Boolean(activeOrder)}
                    inputMode="numeric"
                    autoComplete="off"
                    onChange={(event) => setBarcode(event.target.value)}
                  />
                  <button
                    className="h-12 rounded-md bg-stone-950 px-5 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300"
                    type="submit"
                    disabled={isPending || Boolean(activeOrder)}
                  >
                    Scan
                  </button>
                </div>
              </form>

              <div className="grid min-w-[180px] gap-1 rounded-md border border-stone-200 bg-stone-50 px-3 py-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                  Store scope
                </span>
                <span className="truncate text-sm font-semibold text-stone-950">
                  {selectedStore ? selectedStore.code : "No store"}
                </span>
                <span className="truncate text-xs text-stone-500">
                  {currentContext.user.organizationRole}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-md border border-stone-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
              <h2 className="text-base font-semibold">Cart</h2>
              <span className="font-mono text-sm text-stone-500">
                {cart.length} lines
              </span>
            </div>

            {cart.length === 0 ? (
              <div className="grid min-h-[260px] place-items-center px-4 py-8 text-center text-sm text-stone-500">
                No scanned items
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-sm">
                  <thead className="bg-stone-50 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                    <tr>
                      <th className="px-4 py-3">Item</th>
                      <th className="px-4 py-3">Barcode</th>
                      <th className="px-4 py-3 text-right">Stock</th>
                      <th className="px-4 py-3 text-right">Qty</th>
                      <th className="px-4 py-3 text-right">Line total</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map((line) => (
                      <tr key={line.skuId} className="border-t border-stone-100">
                        <td className="px-4 py-3">
                          <div className="font-medium text-stone-950">
                            {line.name}
                          </div>
                          <div className="mt-1 text-xs text-stone-500">
                            {formatMoney(line.priceAmount, currency)}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-stone-600">
                          {line.barcode}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={`inline-flex min-w-16 justify-center rounded-md border px-2 py-1 font-mono text-xs ${
                              line.isLowStock
                                ? "border-amber-300 bg-amber-50 text-amber-800"
                                : "border-emerald-200 bg-emerald-50 text-emerald-800"
                            }`}
                          >
                            {line.quantityOnHand}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="ml-auto grid w-28 grid-cols-3 overflow-hidden rounded-md border border-stone-300">
                            <button
                              className="h-9 bg-stone-50 text-stone-700 hover:bg-stone-100 disabled:text-stone-300"
                              type="button"
                              disabled={Boolean(activeOrder)}
                              onClick={() =>
                                setCart((current) =>
                                  setCartLineQuantity(
                                    current,
                                    line.skuId,
                                    line.quantity - 1,
                                  ),
                                )
                              }
                            >
                              -
                            </button>
                            <span className="grid h-9 place-items-center border-x border-stone-300 font-mono">
                              {line.quantity}
                            </span>
                            <button
                              className="h-9 bg-stone-50 text-stone-700 hover:bg-stone-100 disabled:text-stone-300"
                              type="button"
                              disabled={Boolean(activeOrder)}
                              onClick={() =>
                                setCart((current) =>
                                  setCartLineQuantity(
                                    current,
                                    line.skuId,
                                    line.quantity + 1,
                                  ),
                                )
                              }
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          {formatMoney(line.priceAmount * line.quantity, currency)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            className="rounded-md border border-stone-300 px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:text-stone-300"
                            type="button"
                            disabled={Boolean(activeOrder)}
                            onClick={() =>
                              setCart((current) =>
                                removeCartLine(current, line.skuId),
                              )
                            }
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex flex-col gap-3 border-t border-stone-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                  Subtotal
                </p>
                <p className="mt-1 font-mono text-2xl font-semibold">
                  {formatMoney(subtotalAmount, currency)}
                </p>
              </div>
              <button
                className="h-11 rounded-md bg-emerald-700 px-5 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-stone-300"
                type="button"
                disabled={isPending || !canCreateOrder}
                onClick={handleCreateOrder}
              >
                Create order
              </button>
            </div>
          </div>
        </section>

        <aside className="grid content-start gap-5">
          <section className="rounded-md border border-stone-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold">Order</h2>
              <StatusBadge value={activeOrder?.status ?? "NO_ORDER"} />
            </div>

            <dl className="mt-4 grid gap-3 text-sm">
              <InfoRow label="Store" value={selectedStore?.code ?? "None"} />
              <InfoRow
                label="Order ID"
                value={activeOrder?.orderId ?? "Not created"}
                mono
              />
              <InfoRow
                label="Payment ID"
                value={activeOrder?.paymentId ?? "Not created"}
                mono
              />
              <InfoRow
                label="Amount"
                value={formatMoney(activeOrder?.totalAmount ?? 0, currency)}
                mono
              />
            </dl>

            {activeOrder?.stockWarnings.length ? (
              <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                {activeOrder.stockWarnings.map((warning) => (
                  <p key={warning.skuId}>
                    {warning.skuId}: requested {warning.requestedQuantity}, stock{" "}
                    {warning.quantityOnHand}
                  </p>
                ))}
              </div>
            ) : null}

            <div className="mt-4 grid gap-2">
              <button
                className="h-10 rounded-md bg-stone-950 px-4 text-sm font-semibold text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300"
                type="button"
                disabled={isPending || !activeOrder}
                onClick={() => handlePayment(false)}
              >
                Simulate payment success
              </button>
              <button
                className="h-10 rounded-md border border-stone-300 px-4 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:text-stone-300"
                type="button"
                disabled={isPending || !activeOrder || !providerEventId}
                onClick={() => handlePayment(true)}
              >
                Replay same event
              </button>
              <button
                className="h-10 rounded-md border border-stone-300 px-4 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:text-stone-300"
                type="button"
                disabled={isPending || (!activeOrder && cart.length === 0)}
                onClick={() => {
                  resetSale(currentContext.demoBarcode);
                  pushEvent("info", "New sale", "Cart and payment state cleared");
                }}
              >
                New sale
              </button>
            </div>
          </section>

          <section className="rounded-md border border-stone-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold">Payment</h2>
              <StatusBadge value={paymentSnapshot?.paymentStatus ?? "PENDING"} />
            </div>
            <dl className="mt-4 grid gap-3 text-sm">
              <InfoRow
                label="Order status"
                value={paymentSnapshot?.orderStatus ?? activeOrder?.status ?? "None"}
              />
              <InfoRow
                label="Event ID"
                value={providerEventId || "None"}
                mono
              />
              <InfoRow
                label="Result"
                value={paymentResult?.result.status ?? "None"}
              />
            </dl>

            {paymentResult?.result.status === "requires_review" ? (
              <div className="mt-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
                {paymentResult.result.shortages.map((shortage) => (
                  <p key={shortage.skuId}>
                    {shortage.skuId}: requested {shortage.requestedQuantity},
                    stock {shortage.quantityOnHand}
                  </p>
                ))}
              </div>
            ) : null}
          </section>

          <section className="rounded-md border border-stone-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
              <h2 className="text-base font-semibold">Event stream</h2>
              <span className="font-mono text-xs text-stone-500">
                {isPending ? "pending" : "idle"}
              </span>
            </div>
            <div className="grid max-h-[340px] gap-0 overflow-y-auto">
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
    </main>
  );
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
    <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-3">
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

function StatusBadge({ value }: { value: string }) {
  const className = statusClass(value);

  return (
    <span
      className={`inline-flex max-w-[190px] truncate rounded-md border px-2 py-1 text-xs font-semibold ${className}`}
      title={value}
    >
      {value}
    </span>
  );
}

function statusClass(value: string) {
  if (value === "PAID" || value === "SUCCEEDED") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  if (
    value === "PAYMENT_REQUIRES_REVIEW" ||
    value === "REQUIRES_REVIEW" ||
    value === "requires_review"
  ) {
    return "border-red-200 bg-red-50 text-red-800";
  }

  if (value === "PENDING_PAYMENT" || value === "PENDING") {
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

function paymentTone(status: DemoPaymentSuccessView["result"]["status"]): EventTone {
  if (status === "processed") {
    return "success";
  }

  if (status === "requires_review") {
    return "warning";
  }

  if (status === "duplicate" || status === "ignored") {
    return "info";
  }

  return "error";
}

function createProviderEventId(paymentId: string) {
  return `evt_demo_${paymentId}_${Date.now()}`;
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency,
  }).format(amount / 100);
}
