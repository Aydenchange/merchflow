import type { FormEventHandler } from "react";
import type { SerializableControlCenterOrder } from "@/server/demo/control-center";
import { InfoRow } from "@/features/shared/components/info-row";
import { StatusBadge } from "@/features/shared/components/status-badge";
import { formatMoney } from "@/features/shared/formatters/display";

type RefundPanelProps = {
  selectedOrder: SerializableControlCenterOrder | null;
  refundableOrder: SerializableControlCenterOrder | null;
  refundReason: string;
  fallbackCurrency: string;
  isPending: boolean;
  onRefundReasonChange: (value: string) => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
};

export function RefundPanel({
  selectedOrder,
  refundableOrder,
  refundReason,
  fallbackCurrency,
  isPending,
  onRefundReasonChange,
  onSubmit,
}: RefundPanelProps) {
  return (
    <form
      className="rounded-md border border-stone-200 bg-white p-4 shadow-sm"
      onSubmit={onSubmit}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold">Refund</h3>
        <StatusBadge value={selectedOrder?.status ?? "NO_ORDER"} />
      </div>

      <dl className="mt-4 grid gap-3 text-sm">
        <InfoRow
          label="Order"
          value={refundableOrder?.id ?? "Select paid/fulfilled"}
          mono
        />
        <InfoRow
          label="Amount"
          value={
            refundableOrder
              ? formatMoney(refundableOrder.totalAmount, refundableOrder.currency)
              : formatMoney(0, fallbackCurrency)
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
          onChange={(event) => onRefundReasonChange(event.target.value)}
        />
      </label>

      <button
        className="mt-4 h-10 w-full rounded-md bg-stone-950 px-4 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300"
        type="submit"
        disabled={isPending || !refundableOrder}
      >
        Record refund
      </button>
    </form>
  );
}
