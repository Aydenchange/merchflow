import type { FormEventHandler } from "react";
import type { ControlCenterInventoryOption } from "@/server/demo/control-center";

type StoreOption = {
  id: string;
  name: string;
  code: string;
};

type StockAdjustmentPanelProps = {
  storeOptions: StoreOption[];
  skuOptions: ControlCenterInventoryOption[];
  selectedInventoryOption: ControlCenterInventoryOption | null;
  storeId: string;
  skuId: string;
  quantityDelta: string;
  note: string;
  isPending: boolean;
  onStoreChange: (value: string) => void;
  onSkuChange: (value: string) => void;
  onQuantityDeltaChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
};

export function StockAdjustmentPanel({
  storeOptions,
  skuOptions,
  selectedInventoryOption,
  storeId,
  skuId,
  quantityDelta,
  note,
  isPending,
  onStoreChange,
  onSkuChange,
  onQuantityDeltaChange,
  onNoteChange,
  onSubmit,
}: StockAdjustmentPanelProps) {
  return (
    <form
      className="rounded-md border border-stone-200 bg-white p-4 shadow-sm"
      onSubmit={onSubmit}
    >
      <h3 className="text-base font-semibold">Stock adjustment</h3>

      <div className="mt-4 grid gap-3">
        <label className="grid gap-1 text-sm font-medium text-stone-700">
          Store
          <select
            className="h-10 rounded-md border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            value={storeId}
            disabled={isPending || storeOptions.length === 0}
            onChange={(event) => onStoreChange(event.target.value)}
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
            value={skuId}
            disabled={isPending || skuOptions.length === 0}
            onChange={(event) => onSkuChange(event.target.value)}
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
              value={quantityDelta}
              disabled={isPending}
              onChange={(event) => onQuantityDeltaChange(event.target.value)}
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
            value={note}
            disabled={isPending}
            onChange={(event) => onNoteChange(event.target.value)}
          />
        </label>
      </div>

      <button
        className="mt-4 h-10 w-full rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-stone-300"
        type="submit"
        disabled={isPending || !storeId || !skuId}
      >
        Apply adjustment
      </button>
    </form>
  );
}
