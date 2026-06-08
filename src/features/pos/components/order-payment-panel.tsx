import { InfoRow } from "@/features/shared/components/info-row";
import { StatusBadge } from "@/features/shared/components/status-badge";
import { formatMoney } from "@/features/shared/formatters/display";
import type {
  DemoPaymentSnapshot,
  DemoPaymentSuccessView,
  DemoPosOrderView,
} from "@/server/demo/workbench";

type OrderPaymentPanelProps = {
  activeOrder: DemoPosOrderView | null;
  paymentResult: DemoPaymentSuccessView | null;
  paymentSnapshot: DemoPaymentSnapshot | null | undefined;
  providerEventId: string;
  selectedStoreCode: string;
  currency: string;
  isPending: boolean;
  hasCartLines: boolean;
  onSimulatePayment: () => void;
  onReplayPayment: () => void;
  onNewSale: () => void;
};

export function OrderPaymentPanel({
  activeOrder,
  paymentResult,
  paymentSnapshot,
  providerEventId,
  selectedStoreCode,
  currency,
  isPending,
  hasCartLines,
  onSimulatePayment,
  onReplayPayment,
  onNewSale,
}: OrderPaymentPanelProps) {
  return (
    <>
      <section className="rounded-md border border-stone-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Order</h2>
          <StatusBadge value={activeOrder?.status ?? "NO_ORDER"} />
        </div>

        <dl className="mt-4 grid gap-3 text-sm">
          <InfoRow label="Store" value={selectedStoreCode} />
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
            onClick={onSimulatePayment}
          >
            Simulate payment success
          </button>
          <button
            className="h-10 rounded-md border border-stone-300 px-4 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:text-stone-300"
            type="button"
            disabled={isPending || !activeOrder || !providerEventId}
            onClick={onReplayPayment}
          >
            Replay same event
          </button>
          <button
            className="h-10 rounded-md border border-stone-300 px-4 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:text-stone-300"
            type="button"
            disabled={isPending || (!activeOrder && !hasCartLines)}
            onClick={onNewSale}
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
          <InfoRow label="Event ID" value={providerEventId || "None"} mono />
          <InfoRow label="Result" value={paymentResult?.result.status ?? "None"} />
        </dl>

        {paymentResult?.result.status === "requires_review" ? (
          <div className="mt-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
            {paymentResult.result.shortages.map((shortage) => (
              <p key={shortage.skuId}>
                {shortage.skuId}: requested {shortage.requestedQuantity}, stock{" "}
                {shortage.quantityOnHand}
              </p>
            ))}
          </div>
        ) : null}
      </section>
    </>
  );
}
