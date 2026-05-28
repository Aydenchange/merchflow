import { describe, expect, it, vi } from "vitest";
import type {
  DemoActionResult,
} from "../server/demo/workbench";
import type {
  DemoControlCenter,
  LoadDemoControlCenterInput,
  SerializableOrderLifecycleResult,
  SerializableRecordedRefundResult,
  SerializableReturnRestockResult,
} from "../server/demo/control-center";
import {
  createControlActionHandlers,
  type ControlWorkbench,
} from "./control-action-handlers";

function ok<T>(data: T): DemoActionResult<T> {
  return {
    ok: true,
    data,
  };
}

function controlCenter(): DemoControlCenter {
  return {
    role: "owner",
    orders: [],
    inventoryOptions: [],
    returnRestockCandidates: [],
  };
}

function fulfilledResult(): SerializableOrderLifecycleResult {
  return {
    orderId: "order_1",
    organizationId: "org_merchflow_demo",
    storeId: "store_orchard",
    status: "FULFILLED",
    cancelledAt: null,
    fulfilledAt: "2026-05-28T09:00:00.000Z",
  };
}

function cancelledResult(): SerializableOrderLifecycleResult {
  return {
    orderId: "order_pending",
    organizationId: "org_merchflow_demo",
    storeId: "store_orchard",
    status: "CANCELLED",
    cancelledAt: "2026-05-28T09:30:00.000Z",
    fulfilledAt: null,
  };
}

function refundResult(): SerializableRecordedRefundResult {
  return {
    orderId: "order_1",
    paymentId: "payment_1",
    organizationId: "org_merchflow_demo",
    storeId: "store_orchard",
    orderStatus: "REFUNDED",
    paymentStatus: "REFUNDED",
    refundAmount: 1299,
    currency: "SGD",
    refundedAt: "2026-05-28T10:00:00.000Z",
  };
}

function returnRestockResult(): SerializableReturnRestockResult {
  return {
    organizationId: "org_merchflow_demo",
    orderId: "order_refunded",
    storeId: "store_orchard",
    restockedAt: "2026-05-28T11:00:00.000Z",
    items: [
      {
        skuId: "sku_tshirt_black_m",
        quantity: 1,
        quantityOnHand: 16,
        ledgerId: "ledger_return_1",
      },
    ],
  };
}

function createWorkbench(overrides: Partial<ControlWorkbench> = {}) {
  return {
    loadDemoControlCenter: vi.fn(async () => ok(controlCenter())),
    fulfillDemoOrder: vi.fn(async () => ok(fulfilledResult())),
    cancelDemoOrder: vi.fn(async () => ok(cancelledResult())),
    refundDemoOrder: vi.fn(async () => ok(refundResult())),
    adjustDemoStock: vi.fn(async () =>
      ok({
        organizationId: "org_merchflow_demo",
        storeId: "store_orchard",
        skuId: "sku_tshirt_black_m",
        quantityDelta: 3,
        quantityOnHand: 27,
        lowStockThreshold: 5,
        reason: "ADJUSTMENT_IN",
        ledgerId: "ledger_1",
      }),
    ),
    restockDemoReturn: vi.fn(async () => ok(returnRestockResult())),
    ...overrides,
  } satisfies ControlWorkbench;
}

function repositories() {
  return {
    authRepository: "auth_repo",
    controlRepository: "control_repo",
    lifecycleRepository: "lifecycle_repo",
    refundRepository: "refund_repo",
    inventoryRepository: "inventory_repo",
    returnRestockRepository: "return_restock_repo",
  };
}

describe("createControlActionHandlers", () => {
  it("loads the control center through auth and read-model repositories without revalidating", async () => {
    const input: LoadDemoControlCenterInput = {
      role: "manager",
      orderLimit: 5,
    };
    const workbench = createWorkbench();
    const getDb = vi.fn(() => ({ db: true }));
    const revalidatePath = vi.fn();
    const createRepositories = vi.fn(repositories);

    const result = await createControlActionHandlers({
      getDb,
      revalidatePath,
      workbench,
      createRepositories,
    }).loadControlCenterAction(input);

    expect(result).toEqual(ok(controlCenter()));
    expect(getDb).toHaveBeenCalledTimes(1);
    expect(createRepositories).toHaveBeenCalledWith({ db: true });
    expect(workbench.loadDemoControlCenter).toHaveBeenCalledWith(input, {
      authRepository: "auth_repo",
      controlRepository: "control_repo",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("revalidates the app route after successful order fulfillment", async () => {
    const workbench = createWorkbench();
    const revalidatePath = vi.fn();

    const result = await createControlActionHandlers({
      getDb: vi.fn(() => ({})),
      revalidatePath,
      workbench,
      createRepositories: vi.fn(repositories),
    }).fulfillOrderAction({
      role: "staff",
      orderId: "order_1",
    });

    expect(result).toEqual(ok(fulfilledResult()));
    expect(workbench.fulfillDemoOrder).toHaveBeenCalledWith(
      {
        role: "staff",
        orderId: "order_1",
      },
      {
        authRepository: "auth_repo",
        lifecycleRepository: "lifecycle_repo",
      },
    );
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("revalidates the app route after successful order cancellation", async () => {
    const workbench = createWorkbench();
    const revalidatePath = vi.fn();

    const result = await createControlActionHandlers({
      getDb: vi.fn(() => ({})),
      revalidatePath,
      workbench,
      createRepositories: vi.fn(repositories),
    }).cancelOrderAction({
      role: "staff",
      orderId: "order_pending",
      reason: "Customer walked away",
    });

    expect(result).toEqual(ok(cancelledResult()));
    expect(workbench.cancelDemoOrder).toHaveBeenCalledWith(
      {
        role: "staff",
        orderId: "order_pending",
        reason: "Customer walked away",
      },
      {
        authRepository: "auth_repo",
        lifecycleRepository: "lifecycle_repo",
      },
    );
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("does not revalidate when refund is rejected", async () => {
    const workbench = createWorkbench({
      refundDemoOrder: vi.fn(async () => ({
        ok: false,
        message: "Role cannot record refund",
      })),
    });
    const revalidatePath = vi.fn();

    const result = await createControlActionHandlers({
      getDb: vi.fn(() => ({})),
      revalidatePath,
      workbench,
      createRepositories: vi.fn(repositories),
    }).refundOrderAction({
      role: "staff",
      orderId: "order_1",
      reason: "Customer request",
    });

    expect(result).toEqual({
      ok: false,
      message: "Role cannot record refund",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("revalidates the app route after successful stock adjustment", async () => {
    const workbench = createWorkbench();
    const revalidatePath = vi.fn();

    const result = await createControlActionHandlers({
      getDb: vi.fn(() => ({})),
      revalidatePath,
      workbench,
      createRepositories: vi.fn(repositories),
    }).adjustStockAction({
      role: "manager",
      storeId: "store_orchard",
      skuId: "sku_tshirt_black_m",
      quantityDelta: 3,
      note: "Supplier delivery",
    });

    expect(result.ok).toBe(true);
    expect(workbench.adjustDemoStock).toHaveBeenCalledWith(
      {
        role: "manager",
        storeId: "store_orchard",
        skuId: "sku_tshirt_black_m",
        quantityDelta: 3,
        note: "Supplier delivery",
      },
      {
        authRepository: "auth_repo",
        inventoryRepository: "inventory_repo",
      },
    );
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("revalidates the app route after successful return restock", async () => {
    const workbench = createWorkbench();
    const revalidatePath = vi.fn();

    const result = await createControlActionHandlers({
      getDb: vi.fn(() => ({})),
      revalidatePath,
      workbench,
      createRepositories: vi.fn(repositories),
    }).restockReturnAction({
      role: "manager",
      orderId: "order_refunded",
      items: [{ skuId: "sku_tshirt_black_m", quantity: 1 }],
      note: "Item inspected",
    });

    expect(result).toEqual(ok(returnRestockResult()));
    expect(workbench.restockDemoReturn).toHaveBeenCalledWith(
      {
        role: "manager",
        orderId: "order_refunded",
        items: [{ skuId: "sku_tshirt_black_m", quantity: 1 }],
        note: "Item inspected",
      },
      {
        authRepository: "auth_repo",
        returnRestockRepository: "return_restock_repo",
      },
    );
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });
});
