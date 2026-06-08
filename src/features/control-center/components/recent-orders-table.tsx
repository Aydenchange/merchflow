import type { SerializableControlCenterOrder } from "@/server/demo/control-center";
import { EmptyState } from "@/features/shared/components/empty-state";
import { StatusBadge } from "@/features/shared/components/status-badge";
import { formatDateTime, formatMoney } from "@/features/shared/formatters/display";
import { canCancelOrder, canFulfillOrder } from "../model/orders";

export function RecentOrdersTable({
  orders,
  hasLoaded,
  isPending,
  selectedOrderId,
  onSelectOrder,
  onFulfillOrder,
}: {
  orders: SerializableControlCenterOrder[];
  hasLoaded: boolean;
  isPending: boolean;
  selectedOrderId: string;
  onSelectOrder: (orderId: string) => void;
  onFulfillOrder: (orderId: string) => void;
}) {
  return (
    <section className="rounded-md border border-stone-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
        <h3 className="text-base font-semibold">Recent orders</h3>
        <span className="font-mono text-sm text-stone-500">
          {isPending ? "pending" : "idle"}
        </span>
      </div>

      {!hasLoaded ? (
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
                      onClick={() => onSelectOrder(order.id)}
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
                        onClick={() => onSelectOrder(order.id)}
                      >
                        Cancel
                      </button>
                      <button
                        className="h-9 rounded-md bg-emerald-700 px-3 text-xs font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-stone-300"
                        type="button"
                        disabled={isPending || !canFulfillOrder(order)}
                        onClick={() => onFulfillOrder(order.id)}
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
                        onClick={() => onSelectOrder(order.id)}
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
  );
}
