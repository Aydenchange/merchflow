import { describe, expect, it } from "vitest";
import type {
  AuthContextRepository,
  MembershipRecord,
} from "../authz/context-loader";
import type {
  InventoryRepository,
  StockAdjustmentResult,
} from "../inventory/service";
import type {
  OrderLifecycleRecord,
  OrderLifecycleRepository,
  OrderLifecycleResult,
  OrderLifecycleTransitionInput,
} from "../orders/lifecycle-service";
import type {
  RefundableOrderRecord,
  RefundRepository,
} from "../refunds/service";
import {
  adjustDemoStock,
  fulfillDemoOrder,
  loadDemoControlCenter,
  refundDemoOrder,
  type ControlCenterInventoryOption,
  type ControlCenterOrder,
  type ControlCenterQuery,
  type DemoControlCenterRepository,
} from "./control-center";

function membershipRecord(
  overrides: Partial<MembershipRecord> = {},
): MembershipRecord {
  return {
    userId: "user_owner",
    membershipId: "membership_owner",
    organizationId: "org_merchflow_demo",
    role: "OWNER",
    status: "ACTIVE",
    storeAssignments: [],
    ...overrides,
  };
}

function authRepository(record: MembershipRecord): AuthContextRepository {
  return {
    async findMembershipByUserId() {
      return record;
    },
  };
}

function controlOrder(overrides: Partial<ControlCenterOrder> = {}) {
  return {
    id: "order_1",
    organizationId: "org_merchflow_demo",
    storeId: "store_orchard",
    storeName: "Orchard Central",
    storeCode: "ORCHARD",
    status: "PAID",
    totalAmount: 1299,
    currency: "SGD",
    createdAt: new Date("2026-05-28T08:00:00.000Z"),
    paidAt: new Date("2026-05-28T08:01:00.000Z"),
    fulfilledAt: null,
    cancelledAt: null,
    refundedAt: null,
    payment: {
      id: "payment_1",
      status: "SUCCEEDED",
      amount: 1299,
      currency: "SGD",
    },
    ...overrides,
  } satisfies ControlCenterOrder;
}

function inventoryOption(
  overrides: Partial<ControlCenterInventoryOption> = {},
): ControlCenterInventoryOption {
  return {
    organizationId: "org_merchflow_demo",
    storeId: "store_orchard",
    storeName: "Orchard Central",
    storeCode: "ORCHARD",
    skuId: "sku_tshirt_black_m",
    skuName: "Classic T-Shirt / Black / M",
    barcode: "9555000000012",
    quantityOnHand: 24,
    lowStockThreshold: 5,
    ...overrides,
  };
}

function controlRepository(calls: {
  recentOrders: ControlCenterQuery[];
  inventoryOptions: ControlCenterQuery[];
}): DemoControlCenterRepository {
  return {
    async listRecentOrders(input) {
      calls.recentOrders.push(input);
      return [controlOrder()];
    },
    async listInventoryOptions(input) {
      calls.inventoryOptions.push(input);
      return [inventoryOption()];
    },
  };
}

function lifecycleRepository(
  calls: OrderLifecycleTransitionInput[],
): OrderLifecycleRepository {
  return {
    async findOrderForLifecycle() {
      return {
        id: "order_1",
        organizationId: "org_merchflow_demo",
        storeId: "store_orchard",
        status: "PAID",
      } satisfies OrderLifecycleRecord;
    },
    async cancelPendingOrder() {
      throw new Error("Not used by this test");
    },
    async fulfillPaidOrder(input) {
      calls.push(input);
      return {
        orderId: input.orderId,
        organizationId: input.organizationId,
        storeId: input.storeId,
        status: "FULFILLED",
        cancelledAt: null,
        fulfilledAt: input.transitionedAt,
      } satisfies OrderLifecycleResult;
    },
  };
}

function refundRepository(
  order: RefundableOrderRecord = {
    id: "order_1",
    organizationId: "org_merchflow_demo",
    storeId: "store_orchard",
    status: "PAID",
    payment: {
      id: "payment_1",
      status: "SUCCEEDED",
      amount: 1299,
      currency: "SGD",
    },
  },
): RefundRepository {
  return {
    async findOrderForRefund() {
      return order;
    },
    async recordFullRefund(input) {
      return {
        orderId: input.orderId,
        paymentId: input.paymentId,
        organizationId: input.organizationId,
        storeId: input.storeId,
        orderStatus: "REFUNDED",
        paymentStatus: "REFUNDED",
        refundAmount: input.refundAmount,
        currency: input.currency,
        refundedAt: input.refundedAt,
      };
    },
  };
}

function inventoryRepository(
  calls: Parameters<InventoryRepository["applyStockAdjustment"]>[0][],
): InventoryRepository {
  return {
    async applyStockAdjustment(input) {
      calls.push(input);
      return {
        organizationId: input.organizationId,
        storeId: input.storeId,
        skuId: input.skuId,
        quantityDelta: input.quantityDelta,
        quantityOnHand: 31,
        lowStockThreshold: 5,
        reason: input.reason,
        ledgerId: "ledger_1",
      } satisfies StockAdjustmentResult;
    },
  };
}

describe("demo control center", () => {
  it("loads manager recent orders and inventory options with assigned-store scope", async () => {
    const calls = {
      recentOrders: [] as ControlCenterQuery[],
      inventoryOptions: [] as ControlCenterQuery[],
    };

    const result = await loadDemoControlCenter(
      {
        role: "manager",
        orderLimit: 6,
      },
      {
        authRepository: authRepository(
          membershipRecord({
            userId: "user_manager",
            membershipId: "membership_manager",
            role: "MANAGER",
            storeAssignments: [{ storeId: "store_orchard" }],
          }),
        ),
        controlRepository: controlRepository(calls),
      },
    );

    expect(calls.recentOrders).toEqual([
      {
        organizationId: "org_merchflow_demo",
        storeScope: {
          allStores: false,
          storeIds: ["store_orchard"],
        },
        limit: 6,
      },
    ]);
    expect(calls.inventoryOptions[0]).toEqual({
      organizationId: "org_merchflow_demo",
      storeScope: {
        allStores: false,
        storeIds: ["store_orchard"],
      },
    });
    expect(result).toEqual({
      ok: true,
      data: {
        role: "manager",
        orders: [
          {
            ...controlOrder(),
            createdAt: "2026-05-28T08:00:00.000Z",
            paidAt: "2026-05-28T08:01:00.000Z",
            fulfilledAt: null,
            cancelledAt: null,
            refundedAt: null,
          },
        ],
        inventoryOptions: [inventoryOption()],
      },
    });
  });

  it("allows staff to fulfill a paid order in an assigned store", async () => {
    const calls: OrderLifecycleTransitionInput[] = [];

    const result = await fulfillDemoOrder(
      {
        role: "staff",
        orderId: "order_1",
      },
      {
        authRepository: authRepository(
          membershipRecord({
            userId: "user_staff",
            membershipId: "membership_staff",
            role: "STAFF",
            storeAssignments: [{ storeId: "store_orchard" }],
          }),
        ),
        lifecycleRepository: lifecycleRepository(calls),
        now: () => new Date("2026-05-28T09:00:00.000Z"),
      },
    );

    expect(calls).toEqual([
      {
        organizationId: "org_merchflow_demo",
        orderId: "order_1",
        storeId: "store_orchard",
        actorMembershipId: "membership_staff",
        transitionedAt: new Date("2026-05-28T09:00:00.000Z"),
      },
    ]);
    expect(result).toEqual({
      ok: true,
      data: {
        orderId: "order_1",
        organizationId: "org_merchflow_demo",
        storeId: "store_orchard",
        status: "FULFILLED",
        cancelledAt: null,
        fulfilledAt: "2026-05-28T09:00:00.000Z",
      },
    });
  });

  it("returns staff refund denial as a UI-safe error", async () => {
    const result = await refundDemoOrder(
      {
        role: "staff",
        orderId: "order_1",
        reason: "Customer changed mind",
      },
      {
        authRepository: authRepository(
          membershipRecord({
            userId: "user_staff",
            membershipId: "membership_staff",
            role: "STAFF",
            storeAssignments: [{ storeId: "store_orchard" }],
          }),
        ),
        refundRepository: refundRepository(),
      },
    );

    expect(result).toEqual({
      ok: false,
      message: "Role cannot record refund",
    });
  });

  it("allows manager stock adjustment in an assigned store", async () => {
    const calls: Parameters<InventoryRepository["applyStockAdjustment"]>[0][] =
      [];

    const result = await adjustDemoStock(
      {
        role: "manager",
        storeId: "store_orchard",
        skuId: "sku_tshirt_black_m",
        quantityDelta: 7,
        note: " Supplier delivery ",
      },
      {
        authRepository: authRepository(
          membershipRecord({
            userId: "user_manager",
            membershipId: "membership_manager",
            role: "MANAGER",
            storeAssignments: [{ storeId: "store_orchard" }],
          }),
        ),
        inventoryRepository: inventoryRepository(calls),
      },
    );

    expect(calls).toEqual([
      {
        organizationId: "org_merchflow_demo",
        storeId: "store_orchard",
        skuId: "sku_tshirt_black_m",
        quantityDelta: 7,
        reason: "ADJUSTMENT_IN",
        actorMembershipId: "membership_manager",
        note: "Supplier delivery",
      },
    ]);
    expect(result).toEqual({
      ok: true,
      data: {
        organizationId: "org_merchflow_demo",
        storeId: "store_orchard",
        skuId: "sku_tshirt_black_m",
        quantityDelta: 7,
        quantityOnHand: 31,
        lowStockThreshold: 5,
        reason: "ADJUSTMENT_IN",
        ledgerId: "ledger_1",
      },
    });
  });
});
