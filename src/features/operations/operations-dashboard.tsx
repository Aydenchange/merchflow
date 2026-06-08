"use client";

import { useMemo, useState, useTransition } from "react";
import { loadOperationsDashboardAction } from "@/app/actions";
import {
  buildOperationsStoreIds,
  getDefaultReportRange,
  getReportRangeForPreset,
  type ReportDateRange,
  type ReportPreset,
  type StoreScopeSelection,
} from "./model/dashboard";
import type { DemoOperationsDashboard } from "@/server/demo/operations";
import type { DemoActionResult, DemoContextView } from "@/server/demo/workbench";
import { EmptyState } from "@/features/shared/components/empty-state";
import { MetricTile } from "@/features/shared/components/metric-tile";
import { formatMoney } from "@/features/shared/formatters/display";

type OperationsDashboardProps = {
  context: DemoContextView;
};

export function OperationsDashboard({ context }: OperationsDashboardProps) {
  const defaultRange = useMemo(() => getDefaultReportRange(), []);
  const [preset, setPreset] = useState<ReportPreset>("30d");
  const [dateRange, setDateRange] = useState<ReportDateRange>(defaultRange);
  const [storeSelection, setStoreSelection] = useState<StoreScopeSelection>({
    kind: "all",
  });
  const [dashboardResult, setDashboardResult] =
    useState<DemoActionResult<DemoOperationsDashboard> | null>(null);
  const [isPending, startTransition] = useTransition();

  const dashboard = dashboardResult?.ok ? dashboardResult.data : null;
  const dashboardError = dashboardResult && !dashboardResult.ok
    ? dashboardResult.message
    : null;
  const currency = dashboard?.salesReport.currency ?? context.organization.currency;
  const lowStockCount = dashboard?.lowStockItems.length ?? 0;
  const reorderCount = dashboard?.reorderSuggestions.length ?? 0;
  const topSku = dashboard?.salesReport.topSkus[0];

  function handlePresetChange(nextPreset: ReportPreset) {
    setPreset(nextPreset);
    setDateRange(getReportRangeForPreset(nextPreset));
  }

  function handleStoreSelection(value: string) {
    if (value === "all") {
      setStoreSelection({ kind: "all" });
      return;
    }

    setStoreSelection({
      kind: "store",
      storeId: value,
    });
  }

  function handleRefresh() {
    startTransition(async () => {
      const result = await loadOperationsDashboardAction({
        role: context.role,
        storeIds: buildOperationsStoreIds(context, storeSelection),
        dateFrom: dateRange.dateFrom,
        dateTo: dateRange.dateTo,
        topSkuLimit: 5,
      });

      setDashboardResult(result);
    });
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-5 px-4 py-5 sm:px-6 lg:px-8">
      <section className="rounded-md border border-stone-200 bg-white p-4 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_180px_150px] lg:items-end">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Operations
            </p>
            <h2 className="mt-1 text-xl font-semibold text-stone-950">
              Store health dashboard
            </h2>
            <p className="mt-1 text-sm text-stone-600">
              Low stock, completed sales, refunds, and top SKU movement.
            </p>
          </div>

          <label className="grid gap-1 text-sm font-medium text-stone-700">
            Store scope
            <select
              className="h-10 rounded-md border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              value={
                storeSelection.kind === "all" ? "all" : storeSelection.storeId
              }
              disabled={isPending}
              onChange={(event) => handleStoreSelection(event.target.value)}
            >
              <option value="all">
                {context.user.organizationRole === "OWNER"
                  ? "All stores"
                  : "Assigned stores"}
              </option>
              {context.stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.code} - {store.name}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-sm font-medium text-stone-700">
            Period
            <select
              className="h-10 rounded-md border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              value={preset}
              disabled={isPending}
              onChange={(event) =>
                handlePresetChange(event.target.value as ReportPreset)
              }
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
            </select>
          </label>

          <button
            className="h-10 rounded-md bg-stone-950 px-4 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300"
            type="button"
            disabled={isPending}
            onClick={handleRefresh}
          >
            Refresh
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <MetricTile
            label="Gross sales"
            value={formatMoney(
              dashboard?.salesReport.grossSalesAmount ?? 0,
              currency,
            )}
          />
          <MetricTile
            label="Completed orders"
            value={`${dashboard?.salesReport.grossOrderCount ?? 0}`}
          />
          <MetricTile
            label="Refunded sales"
            value={formatMoney(
              dashboard?.salesReport.refundedSalesAmount ?? 0,
              currency,
            )}
          />
          <MetricTile label="Low-stock rows" value={`${lowStockCount}`} />
          <MetricTile label="Reorder rows" value={`${reorderCount}`} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs text-stone-500">
          <span className="rounded-md border border-stone-200 bg-stone-50 px-2 py-1 font-mono">
            {dateRange.dateFrom} to {dateRange.dateTo}
          </span>
          <span className="rounded-md border border-stone-200 bg-stone-50 px-2 py-1">
            {topSku ? `Top SKU ${topSku.skuName}` : "No top SKU yet"}
          </span>
          <span className="rounded-md border border-stone-200 bg-stone-50 px-2 py-1">
            {isPending ? "Loading" : "Idle"}
          </span>
        </div>
      </section>

      {dashboardError ? (
        <section className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">Reports unavailable</p>
          <p className="mt-1">{dashboardError}</p>
        </section>
      ) : null}

      <section className="rounded-md border border-stone-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
          <h3 className="text-base font-semibold">Reorder plan</h3>
          <span className="font-mono text-sm text-stone-500">
            {reorderCount} rows
          </span>
        </div>

        {!dashboard ? (
          <EmptyState text="Refresh to load reorder suggestions" />
        ) : dashboard.reorderSuggestions.length === 0 ? (
          <EmptyState text="No reorder suggestions in this scope" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-sm">
              <thead className="bg-stone-50 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-4 py-3">Store</th>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3 text-right">Stock</th>
                  <th className="px-4 py-3 text-right">Target</th>
                  <th className="px-4 py-3 text-right">Reorder</th>
                  <th className="px-4 py-3">Urgency</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.reorderSuggestions.map((item) => (
                  <tr
                    key={`${item.storeId}:${item.skuId}`}
                    className="border-t border-stone-100"
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold text-stone-950">
                        {item.storeCode}
                      </div>
                      <div className="mt-1 text-xs text-stone-500">
                        {item.storeName}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-stone-950">
                        {item.skuName}
                      </div>
                      <div className="mt-1 font-mono text-xs text-stone-500">
                        {item.barcode}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {item.quantityOnHand}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {item.targetQuantity}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex min-w-14 justify-center rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 font-mono text-xs font-semibold text-emerald-800">
                        +{item.suggestedReorderQuantity}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${urgencyClassName(
                          item.urgency,
                        )}`}
                      >
                        {formatUrgency(item.urgency)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
        <section className="rounded-md border border-stone-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
            <h3 className="text-base font-semibold">Low stock</h3>
            <span className="font-mono text-sm text-stone-500">
              {lowStockCount} rows
            </span>
          </div>

          {!dashboard ? (
            <EmptyState text="Refresh to load low-stock rows" />
          ) : dashboard.lowStockItems.length === 0 ? (
            <EmptyState text="No low-stock rows in this scope" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead className="bg-stone-50 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                  <tr>
                    <th className="px-4 py-3">Store</th>
                    <th className="px-4 py-3">SKU</th>
                    <th className="px-4 py-3">Barcode</th>
                    <th className="px-4 py-3 text-right">Stock</th>
                    <th className="px-4 py-3 text-right">Threshold</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.lowStockItems.map((item) => (
                    <tr
                      key={`${item.storeId}:${item.skuId}`}
                      className="border-t border-stone-100"
                    >
                      <td className="px-4 py-3">
                        <div className="font-semibold text-stone-950">
                          {item.storeCode}
                        </div>
                        <div className="mt-1 text-xs text-stone-500">
                          {item.storeName}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-stone-950">
                        {item.skuName}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-stone-600">
                        {item.barcode}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="inline-flex min-w-14 justify-center rounded-md border border-amber-300 bg-amber-50 px-2 py-1 font-mono text-xs text-amber-800">
                          {item.quantityOnHand}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {item.lowStockThreshold}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-md border border-stone-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
            <h3 className="text-base font-semibold">Top SKUs</h3>
            <span className="font-mono text-sm text-stone-500">
              {dashboard?.salesReport.topSkus.length ?? 0} rows
            </span>
          </div>

          {!dashboard ? (
            <EmptyState text="Refresh to load sales report" />
          ) : dashboard.salesReport.topSkus.length === 0 ? (
            <EmptyState text="No completed sales in this period" />
          ) : (
            <div className="grid">
              {dashboard.salesReport.topSkus.map((sku) => (
                <div
                  key={sku.skuId}
                  className="grid gap-3 border-b border-stone-100 px-4 py-3 last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-stone-950">
                      {sku.skuName}
                    </p>
                    <p className="mt-1 font-mono text-xs text-stone-500">
                      {sku.barcode}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <MiniMetric label="Qty sold" value={`${sku.quantitySold}`} />
                    <MiniMetric
                      label="Sales"
                      value={formatMoney(sku.salesAmount, currency)}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2">
      <p className="text-xs text-stone-500">{label}</p>
      <p className="mt-1 truncate font-mono text-sm font-semibold text-stone-950">
        {value}
      </p>
    </div>
  );
}

function urgencyClassName(urgency: string) {
  if (urgency === "OUT_OF_STOCK") {
    return "border-red-200 bg-red-50 text-red-800";
  }

  if (urgency === "CRITICAL") {
    return "border-amber-300 bg-amber-50 text-amber-800";
  }

  return "border-stone-200 bg-stone-50 text-stone-700";
}

function formatUrgency(urgency: string) {
  if (urgency === "OUT_OF_STOCK") {
    return "Out of stock";
  }

  if (urgency === "CRITICAL") {
    return "Critical";
  }

  return "Low";
}
