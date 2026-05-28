import type { DemoContextView } from "../server/demo/workbench";

export type ReportPreset = "7d" | "30d";

export type ReportDateRange = {
  dateFrom: string;
  dateTo: string;
};

export type StoreScopeSelection =
  | {
      kind: "all";
    }
  | {
      kind: "store";
      storeId: string;
    };

export function getDefaultReportRange(now = new Date()): ReportDateRange {
  return getReportRangeForPreset("30d", now);
}

export function getReportRangeForPreset(
  preset: ReportPreset,
  now = new Date(),
): ReportDateRange {
  const dateTo = startOfUtcDay(now);
  const dateFrom = new Date(dateTo);
  dateFrom.setUTCDate(dateTo.getUTCDate() - (preset === "7d" ? 6 : 29));

  return {
    dateFrom: toDateInputValue(dateFrom),
    dateTo: toDateInputValue(dateTo),
  };
}

export function buildOperationsStoreIds(
  context: DemoContextView,
  selection: StoreScopeSelection,
) {
  if (selection.kind === "store") {
    return selection.storeId ? [selection.storeId] : undefined;
  }

  if (context.user.organizationRole === "OWNER") {
    return undefined;
  }

  return context.stores.map((store) => store.id);
}

function startOfUtcDay(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}
