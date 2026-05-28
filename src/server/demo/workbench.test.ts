import { describe, expect, it } from "vitest";
import type { AuthContextRepository, MembershipRecord } from "../authz/context-loader";
import { AuthorizationError } from "../authz/errors";
import type { AuthContext } from "../authz/types";
import { SkuNotFoundError } from "../catalog/errors";
import type { CatalogRepository, SkuLookupRecord } from "../catalog/service";
import type {
  CreatedPendingOrder,
  CreatePendingOrderInput,
  OrderCreationContext,
  OrderRepository,
} from "../orders/service";
import type { NormalizedPaymentSuccessInput, PaymentRepository } from "../payments/service";
import {
  createDemoPosOrder,
  loadDemoContext,
  lookupBarcodeForCart,
  resolveDemoUserId,
  simulateDemoPaymentSuccess,
  type DemoRepository,
} from "./workbench";

function membershipRecord(
  overrides: Partial<MembershipRecord> = {},
): MembershipRecord {
  return {
    userId: "user_staff",
    membershipId: "membership_staff",
    organizationId: "org_merchflow_demo",
    role: "STAFF",
    status: "ACTIVE",
    storeAssignments: [{ storeId: "store_orchard" }],
    ...overrides,
  };
}

function authContext(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    userId: "user_staff",
    membershipId: "membership_staff",
    organizationId: "org_merchflow_demo",
    role: "STAFF",
    status: "ACTIVE",
    assignedStoreIds: ["store_orchard"],
    ...overrides,
  };
}

function authRepository(
  record: MembershipRecord = membershipRecord(),
): AuthContextRepository {
  return {
    async findMembershipByUserId() {
      return record;
    },
  };
}

function demoRepository(overrides: Partial<DemoRepository> = {}): DemoRepository {
  return {
    async findUserProfileById(userId) {
      return {
        id: userId,
        email: `${userId}@merlion.example`,
        name: "Siti Staff",
      };
    },
    async findOrganizationById(organizationId) {
      return {
        id: organizationId,
        name: "Merlion Retail Group",
        country: "SG",
        currency: "SGD",
      };
    },
    async findVisibleStores() {
      return [
        {
          id: "store_orchard",
          name: "Orchard Central",
          code: "ORCHARD",
          address: "181 Orchard Road, Singapore",
        },
      ];
    },
    async findPaymentSnapshot(paymentId) {
      return {
        paymentId,
        paymentStatus: "SUCCEEDED",
        orderId: "order_1",
        orderStatus: "PAID",
        totalAmount: 1299,
        currency: "SGD",
      };
    },
    ...overrides,
  };
}

function skuLookupRecord(
  overrides: Partial<SkuLookupRecord> = {},
): SkuLookupRecord {
  return {
    id: "sku_tshirt_black_m",
    organizationId: "org_merchflow_demo",
    productId: "product_tshirt",
    name: "Classic T-Shirt / Black / M",
    barcode: "9555000000012",
    priceAmount: 1299,
    status: "ACTIVE",
    inventoryBalance: {
      storeId: "store_orchard",
      quantityOnHand: 4,
      lowStockThreshold: 5,
    },
    ...overrides,
  };
}

function catalogRepository(
  overrides: Partial<CatalogRepository> = {},
): CatalogRepository {
  return {
    async createProductWithSku() {
      throw new Error("Not used by demo workbench tests");
    },
    async findSkuByBarcodeForStore() {
      return skuLookupRecord();
    },
    ...overrides,
  };
}

function orderCreationContext(): OrderCreationContext {
  return {
    currency: "SGD",
    skus: [
      {
        id: "sku_tshirt_black_m",
        name: "Classic T-Shirt / Black / M",
        barcode: "9555000000012",
        priceAmount: 1299,
        status: "ACTIVE",
        inventoryBalance: {
          quantityOnHand: 8,
        },
      },
    ],
  };
}

function createdPendingOrder(input: CreatePendingOrderInput): CreatedPendingOrder {
  return {
    orderId: "order_1",
    paymentId: "payment_1",
    organizationId: input.organizationId,
    storeId: input.storeId,
    status: "PENDING_PAYMENT",
    paymentStatus: "PENDING",
    subtotalAmount: input.subtotalAmount,
    taxAmount: input.taxAmount,
    totalAmount: input.totalAmount,
    currency: input.currency,
    items: input.items.map((item, index) => ({
      id: `order_item_${index + 1}`,
      ...item,
    })),
  };
}

function orderRepository(overrides: Partial<OrderRepository> = {}): OrderRepository {
  return {
    async getOrderCreationContext() {
      return orderCreationContext();
    },
    async createPendingOrder(input) {
      return createdPendingOrder(input);
    },
    ...overrides,
  };
}

function paymentRepository(
  overrides: Partial<PaymentRepository> = {},
): PaymentRepository {
  return {
    async processPaymentSuccess(input) {
      return {
        status: "processed",
        providerEventId: input.providerEventId,
        paymentId: input.paymentId,
        orderId: "order_1",
        stockLedgerIds: ["ledger_1"],
      };
    },
    ...overrides,
  };
}

describe("resolveDemoUserId", () => {
  it("maps demo roles to stable seed users", () => {
    expect(resolveDemoUserId("owner")).toBe("user_owner");
    expect(resolveDemoUserId("manager")).toBe("user_manager");
    expect(resolveDemoUserId("staff")).toBe("user_staff");
  });
});

describe("loadDemoContext", () => {
  it("loads serializable identity, organization, and visible stores", async () => {
    const result = await loadDemoContext(
      { role: "staff" },
      {
        authRepository: authRepository(),
        demoRepository: demoRepository(),
      },
    );

    expect(result).toEqual({
      ok: true,
      data: {
        role: "staff",
        demoBarcode: "9555000000012",
        user: {
          id: "user_staff",
          email: "user_staff@merlion.example",
          name: "Siti Staff",
          organizationRole: "STAFF",
        },
        organization: {
          id: "org_merchflow_demo",
          name: "Merlion Retail Group",
          country: "SG",
          currency: "SGD",
        },
        auth: {
          membershipId: "membership_staff",
          organizationId: "org_merchflow_demo",
          organizationRole: "STAFF",
          assignedStoreIds: ["store_orchard"],
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
      },
    });
  });

  it("passes the loaded auth context to visible store lookup", async () => {
    const contexts: AuthContext[] = [];

    await loadDemoContext(
      { role: "manager" },
      {
        authRepository: authRepository(
          membershipRecord({
            userId: "user_manager",
            membershipId: "membership_manager",
            role: "MANAGER",
          }),
        ),
        demoRepository: demoRepository({
          async findVisibleStores(context) {
            contexts.push(context);
            return [];
          },
        }),
      },
    );

    expect(contexts).toEqual([
      authContext({
        userId: "user_manager",
        membershipId: "membership_manager",
        role: "MANAGER",
      }),
    ]);
  });
});

describe("lookupBarcodeForCart", () => {
  it("trims scanned barcode input and returns stock metadata for the cart", async () => {
    const calls: Array<{ organizationId: string; storeId: string; barcode: string }> =
      [];

    const result = await lookupBarcodeForCart(
      {
        role: "staff",
        storeId: "store_orchard",
        barcode: " 9555000000012 ",
      },
      {
        authRepository: authRepository(),
        catalogRepository: catalogRepository({
          async findSkuByBarcodeForStore(input) {
            calls.push(input);
            return skuLookupRecord();
          },
        }),
      },
    );

    expect(calls).toEqual([
      {
        organizationId: "org_merchflow_demo",
        storeId: "store_orchard",
        barcode: "9555000000012",
      },
    ]);
    expect(result).toEqual({
      ok: true,
      data: {
        skuId: "sku_tshirt_black_m",
        productId: "product_tshirt",
        name: "Classic T-Shirt / Black / M",
        barcode: "9555000000012",
        priceAmount: 1299,
        quantityOnHand: 4,
        lowStockThreshold: 5,
        isLowStock: true,
      },
    });
  });

  it("returns expected lookup failures as UI-safe errors", async () => {
    const result = await lookupBarcodeForCart(
      {
        role: "staff",
        storeId: "store_orchard",
        barcode: "missing",
      },
      {
        authRepository: authRepository(),
        catalogRepository: catalogRepository({
          async findSkuByBarcodeForStore() {
            throw new SkuNotFoundError("missing");
          },
        }),
      },
    );

    expect(result).toEqual({
      ok: false,
      message: "SKU not found for barcode missing",
    });
  });

  it("returns authorization failures as UI-safe errors", async () => {
    const result = await lookupBarcodeForCart(
      {
        role: "staff",
        storeId: "store_klcc",
        barcode: "9555000000012",
      },
      {
        authRepository: authRepository(),
        catalogRepository: catalogRepository({
          async findSkuByBarcodeForStore() {
            throw new AuthorizationError("Store access denied");
          },
        }),
      },
    );

    expect(result).toEqual({
      ok: false,
      message: "Store access denied",
    });
  });
});

describe("createDemoPosOrder", () => {
  it("creates a pending POS order from cart items", async () => {
    const calls: CreatePendingOrderInput[] = [];

    const result = await createDemoPosOrder(
      {
        role: "staff",
        storeId: "store_orchard",
        items: [{ skuId: "sku_tshirt_black_m", quantity: 2 }],
      },
      {
        authRepository: authRepository(),
        orderRepository: orderRepository({
          async createPendingOrder(input) {
            calls.push(input);
            return createdPendingOrder(input);
          },
        }),
      },
    );

    expect(calls[0]).toMatchObject({
      organizationId: "org_merchflow_demo",
      storeId: "store_orchard",
      createdByMembershipId: "membership_staff",
      totalAmount: 2598,
      paymentProvider: "simulated_pos",
    });
    expect(result).toMatchObject({
      ok: true,
      data: {
        orderId: "order_1",
        paymentId: "payment_1",
        status: "PENDING_PAYMENT",
        paymentStatus: "PENDING",
        totalAmount: 2598,
        currency: "SGD",
        stockWarnings: [],
      },
    });
  });
});

describe("simulateDemoPaymentSuccess", () => {
  it("uses the supplied provider event id so duplicate replay can be demonstrated", async () => {
    const calls: NormalizedPaymentSuccessInput[] = [];
    const processedAt = new Date("2026-05-28T02:00:00.000Z");

    const result = await simulateDemoPaymentSuccess(
      {
        paymentId: "payment_1",
        providerEventId: "evt_demo_replay",
      },
      {
        demoRepository: demoRepository(),
        paymentRepository: paymentRepository({
          async processPaymentSuccess(input) {
            calls.push(input);
            return {
              status: "processed",
              providerEventId: input.providerEventId,
              paymentId: input.paymentId,
              orderId: "order_1",
              stockLedgerIds: ["ledger_1"],
            };
          },
        }),
        now: () => processedAt,
      },
    );

    expect(calls).toEqual([
      {
        provider: "simulated_pos",
        providerEventId: "evt_demo_replay",
        paymentId: "payment_1",
        eventType: "payment.succeeded",
        payload: {
          source: "demo-pos-workbench",
        },
        processedAt,
      },
    ]);
    expect(result).toEqual({
      ok: true,
      data: {
        result: {
          status: "processed",
          providerEventId: "evt_demo_replay",
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
      },
    });
  });
});
