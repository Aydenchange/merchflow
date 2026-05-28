import {
  loadAuthContextForUser,
  type AuthContextRepository,
} from "../authz/context-loader";
import {
  getBasicSalesReport,
  listLowStockItems,
  type BasicSalesReport,
  type LowStockItem,
  type ReportsRepository,
} from "../reports/service";
import { resolveDemoUserId, type DemoActionResult, type DemoRole } from "./workbench";

export type LoadDemoOperationsDashboardInput = {
  role: DemoRole;
  storeIds?: string[];
  dateFrom: string;
  dateTo: string;
  topSkuLimit?: number;
};

export type SerializableBasicSalesReport = Omit<
  BasicSalesReport,
  "dateFrom" | "dateTo"
> & {
  dateFrom: string;
  dateTo: string;
};

export type DemoOperationsDashboard = {
  role: DemoRole;
  dateFrom: string;
  dateTo: string;
  lowStockItems: LowStockItem[];
  salesReport: SerializableBasicSalesReport;
};

export async function loadDemoOperationsDashboard(
  input: LoadDemoOperationsDashboardInput,
  dependencies: {
    authRepository: AuthContextRepository;
    reportsRepository: ReportsRepository;
  },
): Promise<DemoActionResult<DemoOperationsDashboard>> {
  try {
    const dateFrom = parseStartOfDay(input.dateFrom);
    const dateTo = parseEndOfDay(input.dateTo);
    const context = await loadAuthContextForUser(
      resolveDemoUserId(input.role),
      dependencies.authRepository,
    );
    const reportInput = {
      storeIds: input.storeIds,
    };
    const [lowStockItems, salesReport] = await Promise.all([
      listLowStockItems(context, reportInput, dependencies.reportsRepository),
      getBasicSalesReport(
        context,
        {
          ...reportInput,
          dateFrom,
          dateTo,
          topSkuLimit: input.topSkuLimit,
        },
        dependencies.reportsRepository,
      ),
    ]);

    return {
      ok: true,
      data: {
        role: input.role,
        dateFrom: dateFrom.toISOString(),
        dateTo: dateTo.toISOString(),
        lowStockItems,
        salesReport: {
          ...salesReport,
          dateFrom: salesReport.dateFrom.toISOString(),
          dateTo: salesReport.dateTo.toISOString(),
        },
      },
    };
  } catch (error) {
    return toActionError(error);
  }
}

function parseStartOfDay(value: string) {
  return parseDate(value, "T00:00:00.000Z");
}

function parseEndOfDay(value: string) {
  return parseDate(value, "T23:59:59.999Z");
}

function parseDate(value: string, suffix: string) {
  const trimmedValue = value.trim();
  const isoValue = /^\d{4}-\d{2}-\d{2}$/.test(trimmedValue)
    ? `${trimmedValue}${suffix}`
    : trimmedValue;
  const date = new Date(isoValue);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Report date must be a valid ISO date");
  }

  return date;
}

function toActionError(error: unknown): DemoActionResult<never> {
  if (error instanceof Error) {
    return {
      ok: false,
      message: error.message,
    };
  }

  return {
    ok: false,
    message: "Unexpected operations dashboard error",
  };
}
