import type { FormEventHandler } from "react";
import type { SerializableControlCenterOrder } from "@/server/demo/control-center";
import { InfoRow } from "@/features/shared/components/info-row";
import { StatusBadge } from "@/features/shared/components/status-badge";
import { formatMoney } from "@/features/shared/formatters/display";

type CancelOrderPanelProps = {
  selectedOrder: SerializableControlCenterOrder | null;
  cancelableOrder: SerializableControlCenterOrder | null;
  cancelReason: string;
  fallbackCurrency: string;
  isPending: boolean;
  onCancelReasonChange: (value: string) => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
};

export function CancelOrderPanel({
  selectedOrder,
  cancelableOrder,
  cancelReason,
  fallbackCurrency,
  isPending,
  onCancelReasonChange,
  onSubmit,
}: CancelOrderPanelProps) {
  return (
    <form
      className="rounded-md border border-stone-200 bg-white p-4 shadow-sm"
      onSubmit={onSubmit}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold">Cancel unpaid order</h3>
        <StatusBadge value={selectedOrder?.status ?? "NO_ORDER"} />
      </div>

      <dl className="mt-4 grid gap-3 text-sm">
        <InfoRow
          label="Order"
          value={cancelableOrder?.id ?? "Select pending"}
          mono
        />
        <InfoRow
          label="Amount"
          value={
            cancelableOrder
              ? formatMoney(cancelableOrder.totalAmount, cancelableOrder.currency)
              : formatMoney(0, fallbackCurrency)
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
          onChange={(event) => onCancelReasonChange(event.target.value)}
        />
      </label>

      <button
        className="mt-4 h-10 w-full rounded-md bg-amber-700 px-4 text-sm font-semibold text-white transition hover:bg-amber-800 disabled:cursor-not-allowed disabled:bg-stone-300"
        type="submit"
        disabled={isPending || !cancelableOrder}
      >
        Cancel order
      </button>
    </form>
  );
}
