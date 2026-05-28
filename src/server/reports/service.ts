import { AuthorizationError } from "../authz/errors";
import { assertActiveMembership } from "../authz/policy";
import type { AuthContext } from "../authz/types";
import { InvalidReportInputError } from "./errors";
import type {
  BasicSalesReport,
  LowStockItem,
  LowStockReportInput,
  LowStockReportQuery,
  ReportStoreScope,
  SalesReportInput,
  SalesReportQuery,
} from "./types";

const DEFAULT_TOP_SKU_LIMIT = 5;

export type ReportsRepository = {
  listLowStockItems(input: LowStockReportQuery): Promise<LowStockItem[]>;
  getBasicSalesReport(input: SalesReportQuery): Promise<BasicSalesReport>;
};

export type {
  BasicSalesReport,
  LowStockItem,
  LowStockReportQuery,
  SalesReportQuery,
} from "./types";

export async function listLowStockItems(
  context: AuthContext,
  input: LowStockReportInput,
  repository: ReportsRepository,
): Promise<LowStockItem[]> {
  const storeScope = resolveReportStoreScope(context, input.storeIds);

  return repository.listLowStockItems({
    organizationId: context.organizationId,
    storeScope,
  });
}

export async function getBasicSalesReport(
  context: AuthContext,
  input: SalesReportInput,
  repository: ReportsRepository,
): Promise<BasicSalesReport> {
  if (input.dateFrom.getTime() > input.dateTo.getTime()) {
    throw new InvalidReportInputError(
      "Sales report dateFrom must be before or equal to dateTo",
    );
  }

  const storeScope = resolveReportStoreScope(context, input.storeIds);

  return repository.getBasicSalesReport({
    organizationId: context.organizationId,
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    topSkuLimit: input.topSkuLimit ?? DEFAULT_TOP_SKU_LIMIT,
    storeScope,
  });
}

function resolveReportStoreScope(
  context: AuthContext,
  requestedStoreIds?: string[],
): ReportStoreScope {
  assertActiveMembership(context);

  if (context.role === "STAFF") {
    throw new AuthorizationError("Role cannot view reports");
  }

  const selectedStoreIds = uniqueStoreIds(requestedStoreIds);

  if (requestedStoreIds && selectedStoreIds.length === 0) {
    throw new InvalidReportInputError("Report store filter must not be empty");
  }

  if (context.role === "OWNER") {
    return selectedStoreIds.length > 0
      ? { allStores: false, storeIds: selectedStoreIds }
      : { allStores: true, storeIds: [] };
  }

  const assignedStoreIds = new Set(context.assignedStoreIds);

  if (selectedStoreIds.length === 0) {
    return {
      allStores: false,
      storeIds: [...assignedStoreIds],
    };
  }

  const hasUnassignedStore = selectedStoreIds.some(
    (storeId) => !assignedStoreIds.has(storeId),
  );

  if (hasUnassignedStore) {
    throw new AuthorizationError("Store access denied");
  }

  return {
    allStores: false,
    storeIds: selectedStoreIds,
  };
}

function uniqueStoreIds(storeIds?: string[]) {
  if (!storeIds) {
    return [];
  }

  return [...new Set(storeIds)];
}
