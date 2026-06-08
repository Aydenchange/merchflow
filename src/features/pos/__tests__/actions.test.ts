import { describe, expect, it, vi } from "vitest";
import type {
  DemoActionResult,
  DemoCartSku,
  DemoContextView,
  DemoPaymentSuccessView,
  DemoPosOrderView,
} from "@/server/demo/workbench";
import { createPosActionHandlers, type WorkbenchOperations } from "../actions/handlers";

function successfulContext(role: "owner" | "manager" | "staff"): DemoContextView {
  return {
    role,
    demoBarcode: "9555000000012",
    user: {
      id: `user_${role}`,
      email: `${role}@merlion.example`,
      name: "Demo User",
      organizationRole:
        role === "owner" ? "OWNER" : role === "manager" ? "MANAGER" : "STAFF",
    },
    organization: {
      id: "org_merchflow_demo",
      name: "Merlion Retail Group",
      country: "SG",
      currency: "SGD",
    },
    auth: {
      membershipId: `membership_${role}`,
      organizationId: "org_merchflow_demo",
      organizationRole:
        role === "owner" ? "OWNER" : role === "manager" ? "MANAGER" : "STAFF",
      assignedStoreIds: role === "owner" ? [] : ["store_orchard"],
    },
    stores: [
      {
        id: "store_orchard",
        name: "Orchard Central",
        code: "ORCHARD",
        address: "181 Orchard Road, Singapore",
      },
    ],
    selectedStoreId: "store_orchard",
  };
}

function successfulSku(): DemoCartSku {
  return {
    skuId: "sku_tshirt_black_m",
    productId: "product_tshirt",
    name: "Classic T-Shirt / Black / M",
    barcode: "9555000000012",
    priceAmount: 1299,
    quantityOnHand: 24,
    lowStockThreshold: 5,
    isLowStock: false,
  };
}

function successfulOrder(): DemoPosOrderView {
  return {
    orderId: "order_1",
    paymentId: "payment_1",
    organizationId: "org_merchflow_demo",
    storeId: "store_orchard",
    status: "PENDING_PAYMENT",
    paymentStatus: "PENDING",
    subtotalAmount: 1299,
    taxAmount: 0,
    totalAmount: 1299,
    currency: "SGD",
    items: [
      {
        id: "order_item_1",
        skuId: "sku_tshirt_black_m",
        skuNameSnapshot: "Classic T-Shirt / Black / M",
        barcodeSnapshot: "9555000000012",
        unitPriceAmount: 1299,
        quantity: 1,
        lineTotalAmount: 1299,
      },
    ],
    stockWarnings: [],
  };
}

function successfulPayment(): DemoPaymentSuccessView {
  return {
    result: {
      status: "processed",
      providerEventId: "evt_demo_1",
      paymentId: "payment_1",
      orderId: "order_1",
      stockLedgerIds: ["ledger_1"],
    },
    payment: {
      paymentId: "payment_1",
      paymentStatus: "SUCCEEDED",
      orderId: "order_1",
      orderStatus: "PAID",
      totalAmount: 1299,
      currency: "SGD",
    },
  };
}

function ok<T>(data: T): DemoActionResult<T> {
  return {
    ok: true,
    data,
  };
}

function createWorkbench(overrides: Partial<WorkbenchOperations> = {}) {
  return {
    loadDemoContext: vi.fn(async ({ role }) => ok(successfulContext(role))),
    lookupBarcodeForCart: vi.fn(async () => ok(successfulSku())),
    createDemoPosOrder: vi.fn(async () => ok(successfulOrder())),
    simulateDemoPaymentSuccess: vi.fn(async () => ok(successfulPayment())),
    ...overrides,
  } satisfies WorkbenchOperations;
}

describe("createPosActionHandlers", () => {
  it("loads demo context without revalidating the app route", async () => {
    const workbench = createWorkbench();
    const getDb = vi.fn(() => ({ db: true }));
    const revalidatePath = vi.fn();
    const createRepositories = vi.fn(() => ({
      authRepository: "auth_repo",
      demoRepository: "demo_repo",
      catalogRepository: "catalog_repo",
      orderRepository: "order_repo",
      paymentRepository: "payment_repo",
    }));

    const result = await createPosActionHandlers({
      getDb,
      revalidatePath,
      workbench,
      createRepositories,
    }).loadDemoContextAction("manager");

    expect(result).toEqual(ok(successfulContext("manager")));
    expect(getDb).toHaveBeenCalledTimes(1);
    expect(createRepositories).toHaveBeenCalledWith({ db: true });
    expect(workbench.loadDemoContext).toHaveBeenCalledWith(
      { role: "manager" },
      {
        authRepository: "auth_repo",
        demoRepository: "demo_repo",
      },
    );
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("looks up scanned barcode through catalog dependencies", async () => {
    const workbench = createWorkbench();

    await createPosActionHandlers({
      getDb: vi.fn(() => ({})),
      revalidatePath: vi.fn(),
      workbench,
      createRepositories: vi.fn(() => ({
        authRepository: "auth_repo",
        demoRepository: "demo_repo",
        catalogRepository: "catalog_repo",
        orderRepository: "order_repo",
        paymentRepository: "payment_repo",
      })),
    }).lookupSkuAction({
      role: "staff",
      storeId: "store_orchard",
      barcode: "9555000000012",
    });

    expect(workbench.lookupBarcodeForCart).toHaveBeenCalledWith(
      {
        role: "staff",
        storeId: "store_orchard",
        barcode: "9555000000012",
      },
      {
        authRepository: "auth_repo",
        catalogRepository: "catalog_repo",
      },
    );
  });

  it("revalidates the app route after creating an order", async () => {
    const workbench = createWorkbench();
    const revalidatePath = vi.fn();

    const result = await createPosActionHandlers({
      getDb: vi.fn(() => ({})),
      revalidatePath,
      workbench,
      createRepositories: vi.fn(() => ({
        authRepository: "auth_repo",
        demoRepository: "demo_repo",
        catalogRepository: "catalog_repo",
        orderRepository: "order_repo",
        paymentRepository: "payment_repo",
      })),
    }).createPosOrderAction({
      role: "staff",
      storeId: "store_orchard",
      items: [{ skuId: "sku_tshirt_black_m", quantity: 1 }],
    });

    expect(result).toEqual(ok(successfulOrder()));
    expect(workbench.createDemoPosOrder).toHaveBeenCalledWith(
      {
        role: "staff",
        storeId: "store_orchard",
        items: [{ skuId: "sku_tshirt_black_m", quantity: 1 }],
      },
      {
        authRepository: "auth_repo",
        orderRepository: "order_repo",
      },
    );
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("revalidates the app route after simulating payment success", async () => {
    const workbench = createWorkbench();
    const revalidatePath = vi.fn();

    const result = await createPosActionHandlers({
      getDb: vi.fn(() => ({})),
      revalidatePath,
      workbench,
      createRepositories: vi.fn(() => ({
        authRepository: "auth_repo",
        demoRepository: "demo_repo",
        catalogRepository: "catalog_repo",
        orderRepository: "order_repo",
        paymentRepository: "payment_repo",
      })),
    }).simulatePaymentSuccessAction({
      paymentId: "payment_1",
      providerEventId: "evt_demo_1",
    });

    expect(result).toEqual(ok(successfulPayment()));
    expect(workbench.simulateDemoPaymentSuccess).toHaveBeenCalledWith(
      {
        paymentId: "payment_1",
        providerEventId: "evt_demo_1",
      },
      {
        demoRepository: "demo_repo",
        paymentRepository: "payment_repo",
      },
    );
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });
});
