"use client";

import { FormEvent, useMemo, useState, useTransition } from "react";
import {
  createPosOrderAction,
  loadDemoContextAction,
  lookupSkuAction,
  simulatePaymentSuccessAction,
} from "@/app/actions";
import { AuditTrail } from "@/features/audit/audit-trail";
import { ControlCenter } from "@/features/control-center/control-center";
import { OperationsDashboard } from "@/features/operations/operations-dashboard";
import {
  EventStream,
  type EventTone,
} from "@/features/shared/components/event-stream";
import { useTimelineEvents } from "@/features/shared/hooks/use-timeline-events";
import { formatMoney } from "@/features/shared/formatters/display";
import { CartSection } from "./components/cart-section";
import { OrderPaymentPanel } from "./components/order-payment-panel";
import {
  addScannedSkuToCart,
  buildOrderItemsFromCart,
  getCartSubtotalAmount,
  removeCartLine,
  setCartLineQuantity,
  type CartLine,
} from "./model/cart";
import type {
  DemoActionResult,
  DemoContextView,
  DemoPaymentSuccessView,
  DemoPosOrderView,
  DemoRole,
} from "@/server/demo/workbench";

type PosWorkbenchProps = {
  initialContext: DemoActionResult<DemoContextView>;
};

type AppView = "pos" | "operations" | "control" | "audit";

const roleOptions: Array<{ value: DemoRole; label: string }> = [
  { value: "owner", label: "Owner" },
  { value: "manager", label: "Manager" },
  { value: "staff", label: "Staff" },
];

export function PosWorkbench({ initialContext }: PosWorkbenchProps) {
  const [contextResult, setContextResult] = useState(initialContext);
  const [selectedStoreId, setSelectedStoreId] = useState(
    initialContext.ok ? (initialContext.data.selectedStoreId ?? "") : "",
  );
  const [barcode, setBarcode] = useState(
    initialContext.ok ? initialContext.data.demoBarcode : "",
  );
  const [cart, setCart] = useState<CartLine[]>([]);
  const [activeOrder, setActiveOrder] = useState<DemoPosOrderView | null>(null);
  const [paymentResult, setPaymentResult] =
    useState<DemoPaymentSuccessView | null>(null);
  const [providerEventId, setProviderEventId] = useState("");
  const { events, pushEvent } = useTimelineEvents();
  const [activeView, setActiveView] = useState<AppView>("pos");
  const [isPending, startTransition] = useTransition();

  const context = contextResult.ok ? contextResult.data : null;
  const selectedStore = context?.stores.find(
    (store) => store.id === selectedStoreId,
  );
  const subtotalAmount = useMemo(() => getCartSubtotalAmount(cart), [cart]);
  const currency =
    context?.organization.currency ?? activeOrder?.currency ?? "SGD";
  const canCreateOrder =
    cart.length > 0 && Boolean(selectedStoreId) && !activeOrder;
  const paymentSnapshot = paymentResult?.payment;

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
      pushEvent(
        "error",
        "Context unavailable",
        "Reload the demo context first",
      );
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
          <h1 className="mt-3 text-2xl font-semibold">
            Demo context unavailable
          </h1>
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

      <div className="border-b border-stone-200 bg-white">
        <nav className="mx-auto flex max-w-7xl gap-2 px-4 py-3 sm:px-6 lg:px-8">
          <button
            className={`h-9 rounded-md px-4 text-sm font-semibold transition ${
              activeView === "pos"
                ? "bg-stone-950 text-white"
                : "border border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
            }`}
            type="button"
            onClick={() => setActiveView("pos")}
          >
            POS
          </button>
          <button
            className={`h-9 rounded-md px-4 text-sm font-semibold transition ${
              activeView === "operations"
                ? "bg-stone-950 text-white"
                : "border border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
            }`}
            type="button"
            onClick={() => setActiveView("operations")}
          >
            Operations
          </button>
          <button
            className={`h-9 rounded-md px-4 text-sm font-semibold transition ${
              activeView === "control"
                ? "bg-stone-950 text-white"
                : "border border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
            }`}
            type="button"
            onClick={() => setActiveView("control")}
          >
            Control
          </button>
          <button
            className={`h-9 rounded-md px-4 text-sm font-semibold transition ${
              activeView === "audit"
                ? "bg-stone-950 text-white"
                : "border border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
            }`}
            type="button"
            onClick={() => setActiveView("audit")}
          >
            Audit
          </button>
        </nav>
      </div>

      {activeView === "operations" ? (
        <OperationsDashboard context={currentContext} />
      ) : activeView === "control" ? (
        <ControlCenter
          key={`${currentContext.role}:${selectedStoreId}`}
          context={currentContext}
          selectedStoreId={selectedStoreId}
        />
      ) : activeView === "audit" ? (
        <AuditTrail
          key={`${currentContext.role}:${selectedStoreId}`}
          context={currentContext}
        />
      ) : (
        <div className="mx-auto grid max-w-7xl gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:px-8">
          <section className="grid gap-5">
            <div className="rounded-md border border-stone-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
                <form className="grid flex-1 gap-2" onSubmit={handleScan}>
                  <label
                    className="text-sm font-medium text-stone-700"
                    htmlFor="barcode"
                  >
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

            <CartSection
              cart={cart}
              currency={currency}
              subtotalAmount={subtotalAmount}
              isLocked={Boolean(activeOrder)}
              isPending={isPending}
              canCreateOrder={canCreateOrder}
              onQuantityChange={(skuId, quantity) =>
                setCart((current) => setCartLineQuantity(current, skuId, quantity))
              }
              onRemoveLine={(skuId) =>
                setCart((current) => removeCartLine(current, skuId))
              }
              onCreateOrder={handleCreateOrder}
            />
          </section>

          <aside className="grid content-start gap-5">
            <OrderPaymentPanel
              activeOrder={activeOrder}
              paymentResult={paymentResult}
              paymentSnapshot={paymentSnapshot}
              providerEventId={providerEventId}
              selectedStoreCode={selectedStore?.code ?? "None"}
              currency={currency}
              isPending={isPending}
              hasCartLines={cart.length > 0}
              onSimulatePayment={() => handlePayment(false)}
              onReplayPayment={() => handlePayment(true)}
              onNewSale={() => {
                resetSale(currentContext.demoBarcode);
                pushEvent(
                  "info",
                  "New sale",
                  "Cart and payment state cleared",
                );
              }}
            />

            <EventStream
              events={events}
              title="Event stream"
              status={isPending ? "pending" : "idle"}
            />
          </aside>
        </div>
      )}
    </main>
  );
}

function paymentTone(
  status: DemoPaymentSuccessView["result"]["status"],
): EventTone {
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

