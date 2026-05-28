import { describe, expect, it, vi } from "vitest";
import type {
  DemoOperationsDashboard,
  LoadDemoOperationsDashboardInput,
} from "../server/demo/operations";
import type { DemoActionResult } from "../server/demo/workbench";
import {
  createOperationsActionHandlers,
  type OperationsWorkbench,
} from "./operations-action-handlers";

function dashboard(
  overrides: Partial<DemoOperationsDashboard> = {},
): DemoOperationsDashboard {
  return {
    role: "owner",
    dateFrom: "2026-05-01T00:00:00.000Z",
    dateTo: "2026-05-31T23:59:59.999Z",
    lowStockItems: [],
    salesReport: {
      organizationId: "org_merchflow_demo",
      dateFrom: "2026-05-01T00:00:00.000Z",
      dateTo: "2026-05-31T23:59:59.999Z",
      storeScope: {
        allStores: true,
        storeIds: [],
      },
      grossSalesAmount: 0,
      grossOrderCount: 0,
      refundedSalesAmount: 0,
      refundedOrderCount: 0,
      currency: "SGD",
      topSkus: [],
    },
    ...overrides,
  };
}

function ok<T>(data: T): DemoActionResult<T> {
  return {
    ok: true,
    data,
  };
}

describe("createOperationsActionHandlers", () => {
  it("loads operations dashboard through auth and reports dependencies", async () => {
    const input: LoadDemoOperationsDashboardInput = {
      role: "owner",
      storeIds: ["store_orchard"],
      dateFrom: "2026-05-01",
      dateTo: "2026-05-31",
    };
    const workbench = {
      loadDemoOperationsDashboard: vi.fn(async () => ok(dashboard())),
    } satisfies OperationsWorkbench;
    const getDb = vi.fn(() => ({ db: true }));
    const revalidatePath = vi.fn();
    const createRepositories = vi.fn(() => ({
      authRepository: "auth_repo",
      reportsRepository: "reports_repo",
    }));

    const result = await createOperationsActionHandlers({
      getDb,
      revalidatePath,
      workbench,
      createRepositories,
    }).loadOperationsDashboardAction(input);

    expect(result).toEqual(ok(dashboard()));
    expect(getDb).toHaveBeenCalledTimes(1);
    expect(createRepositories).toHaveBeenCalledWith({ db: true });
    expect(workbench.loadDemoOperationsDashboard).toHaveBeenCalledWith(input, {
      authRepository: "auth_repo",
      reportsRepository: "reports_repo",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("returns operation errors without revalidating", async () => {
    const workbench = {
      loadDemoOperationsDashboard: vi.fn(async () => ({
        ok: false,
        message: "Role cannot view reports",
      })),
    } satisfies OperationsWorkbench;
    const revalidatePath = vi.fn();

    const result = await createOperationsActionHandlers({
      getDb: vi.fn(() => ({})),
      revalidatePath,
      workbench,
      createRepositories: vi.fn(() => ({
        authRepository: "auth_repo",
        reportsRepository: "reports_repo",
      })),
    }).loadOperationsDashboardAction({
      role: "staff",
      dateFrom: "2026-05-01",
      dateTo: "2026-05-31",
    });

    expect(result).toEqual({
      ok: false,
      message: "Role cannot view reports",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
