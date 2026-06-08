import type { FormEventHandler } from "react";
import type { SerializableControlCenterReturnRestockCandidate } from "@/server/demo/control-center";
import { shortId } from "@/features/shared/formatters/display";

type ReturnRestockItem =
  SerializableControlCenterReturnRestockCandidate["items"][number];

type ReturnRestockPanelProps = {
  candidates: SerializableControlCenterReturnRestockCandidate[];
  selectedCandidate: SerializableControlCenterReturnRestockCandidate | null;
  selectedItem: ReturnRestockItem | null;
  selectedOrderId: string;
  selectedSkuId: string;
  quantity: string;
  note: string;
  isPending: boolean;
  onOrderChange: (value: string) => void;
  onSkuChange: (value: string) => void;
  onQuantityChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
};

export function ReturnRestockPanel({
  candidates,
  selectedCandidate,
  selectedItem,
  selectedOrderId,
  selectedSkuId,
  quantity,
  note,
  isPending,
  onOrderChange,
  onSkuChange,
  onQuantityChange,
  onNoteChange,
  onSubmit,
}: ReturnRestockPanelProps) {
  return (
    <form
      className="rounded-md border border-stone-200 bg-white p-4 shadow-sm"
      onSubmit={onSubmit}
    >
      <h3 className="text-base font-semibold">Return restock</h3>

      <div className="mt-4 grid gap-3">
        <label className="grid gap-1 text-sm font-medium text-stone-700">
          Refunded order
          <select
            className="h-10 rounded-md border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            value={selectedOrderId}
            disabled={isPending || candidates.length === 0}
            onChange={(event) => onOrderChange(event.target.value)}
          >
            {candidates.length === 0 ? (
              <option value="">No refunded orders</option>
            ) : null}
            {candidates.map((candidate) => (
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
            value={selectedSkuId}
            disabled={isPending || !selectedCandidate}
            onChange={(event) => onSkuChange(event.target.value)}
          >
            {selectedCandidate?.items.map((item) => (
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
              max={selectedItem?.restockableQuantity ?? 1}
              step="1"
              value={quantity}
              disabled={isPending || !selectedItem}
              onChange={(event) => onQuantityChange(event.target.value)}
            />
          </label>

          <div className="grid gap-1 text-sm">
            <span className="font-medium text-stone-700">Available</span>
            <span className="grid h-10 items-center rounded-md border border-stone-200 bg-stone-50 px-3 font-mono text-sm font-semibold text-stone-950">
              {selectedItem
                ? `${selectedItem.restockableQuantity} restockable`
                : "No item selected"}
            </span>
          </div>
        </div>

        <label className="grid gap-1 text-sm font-medium text-stone-700">
          Inspection note
          <input
            className="h-10 rounded-md border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            value={note}
            disabled={isPending}
            onChange={(event) => onNoteChange(event.target.value)}
          />
        </label>
      </div>

      <button
        className="mt-4 h-10 w-full rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-stone-300"
        type="submit"
        disabled={isPending || !selectedCandidate || !selectedItem}
      >
        Restock return
      </button>
    </form>
  );
}
