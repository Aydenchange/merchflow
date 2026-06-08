import { EmptyState } from "@/features/shared/components/empty-state";
import { formatMoney } from "@/features/shared/formatters/display";
import type { CartLine } from "../model/cart";

type CartSectionProps = {
  cart: CartLine[];
  currency: string;
  subtotalAmount: number;
  isLocked: boolean;
  isPending: boolean;
  canCreateOrder: boolean;
  onQuantityChange: (skuId: string, quantity: number) => void;
  onRemoveLine: (skuId: string) => void;
  onCreateOrder: () => void;
};

export function CartSection({
  cart,
  currency,
  subtotalAmount,
  isLocked,
  isPending,
  canCreateOrder,
  onQuantityChange,
  onRemoveLine,
  onCreateOrder,
}: CartSectionProps) {
  return (
    <div className="rounded-md border border-stone-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
        <h2 className="text-base font-semibold">Cart</h2>
        <span className="font-mono text-sm text-stone-500">
          {cart.length} lines
        </span>
      </div>

      {cart.length === 0 ? (
        <EmptyState text="No scanned items" />
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
                        disabled={isLocked}
                        onClick={() =>
                          onQuantityChange(line.skuId, line.quantity - 1)
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
                        disabled={isLocked}
                        onClick={() =>
                          onQuantityChange(line.skuId, line.quantity + 1)
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
                      disabled={isLocked}
                      onClick={() => onRemoveLine(line.skuId)}
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
          onClick={onCreateOrder}
        >
          Create order
        </button>
      </div>
    </div>
  );
}
