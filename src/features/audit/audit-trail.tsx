"use client";

import { useState, useTransition } from "react";
import { loadAuditTrailAction } from "@/app/actions";
import type {
  DemoAuditTrail,
  SerializableAuditEvent,
  SerializableStockMovement,
} from "@/server/demo/audit";
import type { DemoActionResult, DemoContextView } from "@/server/demo/workbench";
import { EmptyState } from "@/features/shared/components/empty-state";
import { MetricTile } from "@/features/shared/components/metric-tile";
import {
  formatDateTime,
  formatSignedQuantity,
} from "@/features/shared/formatters/display";

type AuditTrailProps = {
  context: DemoContextView;
};

type StoreSelection =
  | {
      kind: "all";
    }
  | {
      kind: "store";
      storeId: string;
    };

export function AuditTrail({ context }: AuditTrailProps) {
  const [storeSelection, setStoreSelection] = useState<StoreSelection>({
    kind: "all",
  });
  const [limit, setLimit] = useState("20");
  const [auditResult, setAuditResult] =
    useState<DemoActionResult<DemoAuditTrail> | null>(null);
  const [isPending, startTransition] = useTransition();

  const auditTrail = auditResult?.ok ? auditResult.data : null;
  const auditError = auditResult && !auditResult.ok ? auditResult.message : null;
  const auditEvents = auditTrail?.auditEvents ?? [];
  const stockMovements = auditTrail?.stockMovements ?? [];

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
      const result = await loadAuditTrailAction({
        role: context.role,
        storeIds:
          storeSelection.kind === "store"
            ? [storeSelection.storeId]
            : undefined,
        limit: Number(limit),
      });

      setAuditResult(result);
    });
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-5 px-4 py-5 sm:px-6 lg:px-8">
      <section className="rounded-md border border-stone-200 bg-white p-4 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_120px_140px] lg:items-end">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Audit
            </p>
            <h2 className="mt-1 text-xl font-semibold text-stone-950">
              Audit history
            </h2>
            <p className="mt-1 text-sm text-stone-600">
              Trace high-risk order, refund, and inventory changes by actor, store, and time.
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
            Rows
            <select
              className="h-10 rounded-md border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              value={limit}
              disabled={isPending}
              onChange={(event) => setLimit(event.target.value)}
            >
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
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

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <MetricTile label="Audit events" value={`${auditEvents.length}`} />
          <MetricTile label="Stock movements" value={`${stockMovements.length}`} />
          <MetricTile
            label="Scope"
            value={
              auditTrail?.storeScope.allStores
                ? "All"
                : `${auditTrail?.storeScope.storeIds.length ?? 0} stores`
            }
          />
        </div>
      </section>

      {auditError ? (
        <section className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">Audit history unavailable</p>
          <p className="mt-1">{auditError}</p>
        </section>
      ) : null}

      <section className="rounded-md border border-stone-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
          <h3 className="text-base font-semibold">Audit log</h3>
          <span className="font-mono text-sm text-stone-500">
            {isPending ? "pending" : `${auditEvents.length} rows`}
          </span>
        </div>

        {!auditTrail ? (
          <EmptyState text="Refresh to load audit events" />
        ) : auditEvents.length === 0 ? (
          <EmptyState text="No audit events in this scope" />
        ) : (
          <AuditEventTable events={auditEvents} />
        )}
      </section>

      <section className="rounded-md border border-stone-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
          <h3 className="text-base font-semibold">Stock movements</h3>
          <span className="font-mono text-sm text-stone-500">
            {isPending ? "pending" : `${stockMovements.length} rows`}
          </span>
        </div>

        {!auditTrail ? (
          <EmptyState text="Refresh to load stock movements" />
        ) : stockMovements.length === 0 ? (
          <EmptyState text="No stock movements in this scope" />
        ) : (
          <StockMovementTable movements={stockMovements} />
        )}
      </section>
    </div>
  );
}

function AuditEventTable({ events }: { events: SerializableAuditEvent[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] border-collapse text-sm">
        <thead className="bg-stone-50 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
          <tr>
            <th className="px-4 py-3">Time</th>
            <th className="px-4 py-3">Store</th>
            <th className="px-4 py-3">Actor</th>
            <th className="px-4 py-3">Action</th>
            <th className="px-4 py-3">Entity</th>
            <th className="px-4 py-3">Metadata</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.id} className="border-t border-stone-100">
              <td className="px-4 py-3 font-mono text-xs text-stone-600">
                {formatDateTime(event.createdAt)}
              </td>
              <td className="px-4 py-3">
                <StoreLabel code={event.storeCode} name={event.storeName} />
              </td>
              <td className="px-4 py-3">
                <ActorLabel name={event.actorName} email={event.actorEmail} />
              </td>
              <td className="px-4 py-3">
                <StatusBadge value={event.action} />
              </td>
              <td className="px-4 py-3">
                <p className="font-semibold text-stone-950">
                  {event.entityType}
                </p>
                <p className="mt-1 max-w-[180px] truncate font-mono text-xs text-stone-500">
                  {event.entityId}
                </p>
              </td>
              <td className="px-4 py-3">
                <p
                  className="max-w-[300px] truncate font-mono text-xs text-stone-600"
                  title={event.metadataText ?? "None"}
                >
                  {event.metadataText ?? "None"}
                </p>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StockMovementTable({
  movements,
}: {
  movements: SerializableStockMovement[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] border-collapse text-sm">
        <thead className="bg-stone-50 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
          <tr>
            <th className="px-4 py-3">Time</th>
            <th className="px-4 py-3">Store</th>
            <th className="px-4 py-3">SKU</th>
            <th className="px-4 py-3 text-right">Delta</th>
            <th className="px-4 py-3">Reason</th>
            <th className="px-4 py-3">Actor</th>
            <th className="px-4 py-3">Note</th>
          </tr>
        </thead>
        <tbody>
          {movements.map((movement) => (
            <tr key={movement.id} className="border-t border-stone-100">
              <td className="px-4 py-3 font-mono text-xs text-stone-600">
                {formatDateTime(movement.createdAt)}
              </td>
              <td className="px-4 py-3">
                <StoreLabel code={movement.storeCode} name={movement.storeName} />
              </td>
              <td className="px-4 py-3">
                <p className="max-w-[220px] truncate font-semibold text-stone-950">
                  {movement.skuName}
                </p>
                <p className="mt-1 font-mono text-xs text-stone-500">
                  {movement.barcode}
                </p>
              </td>
              <td className="px-4 py-3 text-right">
                <span
                  className={`inline-flex min-w-14 justify-center rounded-md border px-2 py-1 font-mono text-xs font-semibold ${
                    movement.quantityDelta >= 0
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-amber-200 bg-amber-50 text-amber-800"
                  }`}
                >
                  {formatSignedQuantity(movement.quantityDelta)}
                </span>
              </td>
              <td className="px-4 py-3">
                <StatusBadge value={movement.reason} />
              </td>
              <td className="px-4 py-3">
                <ActorLabel
                  name={movement.actorName}
                  email={movement.actorEmail}
                />
              </td>
              <td className="px-4 py-3">
                <p className="max-w-[220px] truncate text-xs text-stone-600">
                  {movement.note ?? movement.relatedOrderId ?? "None"}
                </p>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StoreLabel({
  code,
  name,
}: {
  code: string | null;
  name: string | null;
}) {
  return (
    <div>
      <p className="font-semibold text-stone-950">{code ?? "ORG"}</p>
      <p className="mt-1 text-xs text-stone-500">{name ?? "Organization"}</p>
    </div>
  );
}

function ActorLabel({
  name,
  email,
}: {
  name: string | null;
  email: string | null;
}) {
  return (
    <div>
      <p className="max-w-[180px] truncate font-semibold text-stone-950">
        {name ?? "System"}
      </p>
      <p className="mt-1 max-w-[180px] truncate text-xs text-stone-500">
        {email ?? "No actor"}
      </p>
    </div>
  );
}

function StatusBadge({ value }: { value: string }) {
  return (
    <span
      className="inline-flex max-w-[180px] truncate rounded-md border border-stone-200 bg-stone-50 px-2 py-1 text-xs font-semibold text-stone-700"
      title={value}
    >
      {value}
    </span>
  );
}
