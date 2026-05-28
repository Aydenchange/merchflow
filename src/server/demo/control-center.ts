import {
  loadAuthContextForUser,
  type AuthContextRepository,
} from "../authz/context-loader";
import { getAccessibleStoreScope } from "../authz/policy";
import {
  adjustStock,
  type InventoryRepository,
  type StockAdjustmentResult,
} from "../inventory/service";
import {
  fulfillPaidOrder,
  type OrderLifecycleRepository,
  type OrderLifecycleResult,
} from "../orders/lifecycle-service";
import {
  recordFullRefund,
  type RecordedRefundResult,
  type RefundRepository,
} from "../refunds/service";
import {
  recordReturnRestock,
  type ReturnRestockRepository,
  type ReturnRestockResult,
} from "../returns/service";
import {
  resolveDemoUserId,
  type DemoActionResult,
  type DemoRole,
} from "./workbench";

const DEFAULT_ORDER_LIMIT = 8;

export type ControlCenterStoreScope = {
  allStores: boolean;
  storeIds: string[];
};

export type ControlCenterQuery = {
  organizationId: string;
  storeScope: ControlCenterStoreScope;
  limit?: number;
};

export type ControlCenterOrderStatus =
  | "PENDING_PAYMENT"
  | "PAID"
  | "FULFILLED"
  | "CANCELLED"
  | "PAYMENT_FAILED"
  | "REFUNDED"
  | "PAYMENT_REQUIRES_REVIEW";

export type ControlCenterPaymentStatus =
  | "PENDING"
  | "SUCCEEDED"
  | "FAILED"
  | "REFUNDED"
  | "PARTIALLY_REFUNDED"
  | "REQUIRES_REVIEW";

export type ControlCenterOrder = {
  id: string;
  organizationId: string;
  storeId: string;
  storeName: string;
  storeCode: string;
  status: ControlCenterOrderStatus;
  totalAmount: number;
  currency: string;
  createdAt: Date;
  paidAt: Date | null;
  fulfilledAt: Date | null;
  cancelledAt: Date | null;
  refundedAt: Date | null;
  payment: {
    id: string;
    status: ControlCenterPaymentStatus;
    amount: number;
    currency: string;
  } | null;
};

export type SerializableControlCenterOrder = Omit<
  ControlCenterOrder,
  "createdAt" | "paidAt" | "fulfilledAt" | "cancelledAt" | "refundedAt"
> & {
  createdAt: string;
  paidAt: string | null;
  fulfilledAt: string | null;
  cancelledAt: string | null;
  refundedAt: string | null;
};

export type ControlCenterInventoryOption = {
  organizationId: string;
  storeId: string;
  storeName: string;
  storeCode: string;
  skuId: string;
  skuName: string;
  barcode: string;
  quantityOnHand: number;
  lowStockThreshold: number;
};

export type ControlCenterReturnRestockCandidate = {
  orderId: string;
  organizationId: string;
  storeId: string;
  storeName: string;
  storeCode: string;
  refundedAt: Date | null;
  items: Array<{
    orderItemId: string;
    skuId: string;
    skuName: string;
    barcode: string;
    orderedQuantity: number;
    quantityRestocked: number;
    restockableQuantity: number;
  }>;
};

export type SerializableControlCenterReturnRestockCandidate = Omit<
  ControlCenterReturnRestockCandidate,
  "refundedAt"
> & {
  refundedAt: string | null;
};

export type DemoControlCenter = {
  role: DemoRole;
  orders: SerializableControlCenterOrder[];
  inventoryOptions: ControlCenterInventoryOption[];
  returnRestockCandidates: SerializableControlCenterReturnRestockCandidate[];
};

export type LoadDemoControlCenterInput = {
  role: DemoRole;
  orderLimit?: number;
};

export type FulfillDemoOrderInput = {
  role: DemoRole;
  orderId: string;
};

export type RefundDemoOrderInput = {
  role: DemoRole;
  orderId: string;
  reason: string;
};

export type AdjustDemoStockInput = {
  role: DemoRole;
  storeId: string;
  skuId: string;
  quantityDelta: number;
  note: string;
};

export type RestockDemoReturnInput = {
  role: DemoRole;
  orderId: string;
  items: Array<{
    skuId: string;
    quantity: number;
  }>;
  note: string;
};

export type SerializableOrderLifecycleResult = Omit<
  OrderLifecycleResult,
  "cancelledAt" | "fulfilledAt"
> & {
  cancelledAt: string | null;
  fulfilledAt: string | null;
};

export type SerializableRecordedRefundResult = Omit<
  RecordedRefundResult,
  "refundedAt"
> & {
  refundedAt: string;
};

export type SerializableReturnRestockResult = Omit<
  ReturnRestockResult,
  "restockedAt"
> & {
  restockedAt: string;
};

export type DemoControlCenterRepository = {
  listRecentOrders(input: Required<ControlCenterQuery>): Promise<
    ControlCenterOrder[]
  >;
  listInventoryOptions(
    input: Omit<ControlCenterQuery, "limit">,
  ): Promise<ControlCenterInventoryOption[]>;
  listReturnRestockCandidates(
    input: Omit<ControlCenterQuery, "limit">,
  ): Promise<ControlCenterReturnRestockCandidate[]>;
};

export async function loadDemoControlCenter(
  input: LoadDemoControlCenterInput,
  dependencies: {
    authRepository: AuthContextRepository;
    controlRepository: DemoControlCenterRepository;
  },
): Promise<DemoActionResult<DemoControlCenter>> {
  try {
    const context = await loadDemoAuthContext(input.role, dependencies);
    const query = {
      organizationId: context.organizationId,
      storeScope: getAccessibleStoreScope(context),
    };
    const [orders, inventoryOptions, returnRestockCandidates] =
      await Promise.all([
      dependencies.controlRepository.listRecentOrders({
        ...query,
        limit: input.orderLimit ?? DEFAULT_ORDER_LIMIT,
      }),
      dependencies.controlRepository.listInventoryOptions(query),
      dependencies.controlRepository.listReturnRestockCandidates(query),
    ]);

    return {
      ok: true,
      data: {
        role: input.role,
        orders: orders.map(serializeControlOrder),
        inventoryOptions,
        returnRestockCandidates: returnRestockCandidates.map(
          serializeReturnRestockCandidate,
        ),
      },
    };
  } catch (error) {
    return toActionError(error);
  }
}

export async function fulfillDemoOrder(
  input: FulfillDemoOrderInput,
  dependencies: {
    authRepository: AuthContextRepository;
    lifecycleRepository: OrderLifecycleRepository;
    now?: () => Date;
  },
): Promise<DemoActionResult<SerializableOrderLifecycleResult>> {
  try {
    const context = await loadDemoAuthContext(input.role, dependencies);
    const result = await fulfillPaidOrder(
      context,
      {
        orderId: input.orderId,
        fulfilledAt: dependencies.now?.() ?? new Date(),
      },
      dependencies.lifecycleRepository,
    );

    return {
      ok: true,
      data: serializeLifecycleResult(result),
    };
  } catch (error) {
    return toActionError(error);
  }
}

export async function refundDemoOrder(
  input: RefundDemoOrderInput,
  dependencies: {
    authRepository: AuthContextRepository;
    refundRepository: RefundRepository;
    now?: () => Date;
  },
): Promise<DemoActionResult<SerializableRecordedRefundResult>> {
  try {
    const context = await loadDemoAuthContext(input.role, dependencies);
    const result = await recordFullRefund(
      context,
      {
        orderId: input.orderId,
        reason: input.reason,
        refundedAt: dependencies.now?.() ?? new Date(),
      },
      dependencies.refundRepository,
    );

    return {
      ok: true,
      data: serializeRefundResult(result),
    };
  } catch (error) {
    return toActionError(error);
  }
}

export async function adjustDemoStock(
  input: AdjustDemoStockInput,
  dependencies: {
    authRepository: AuthContextRepository;
    inventoryRepository: InventoryRepository;
  },
): Promise<DemoActionResult<StockAdjustmentResult>> {
  try {
    const context = await loadDemoAuthContext(input.role, dependencies);
    const result = await adjustStock(
      context,
      {
        storeId: input.storeId,
        skuId: input.skuId,
        quantityDelta: input.quantityDelta,
        note: input.note,
      },
      dependencies.inventoryRepository,
    );

    return {
      ok: true,
      data: result,
    };
  } catch (error) {
    return toActionError(error);
  }
}

export async function restockDemoReturn(
  input: RestockDemoReturnInput,
  dependencies: {
    authRepository: AuthContextRepository;
    returnRestockRepository: ReturnRestockRepository;
    now?: () => Date;
  },
): Promise<DemoActionResult<SerializableReturnRestockResult>> {
  try {
    const context = await loadDemoAuthContext(input.role, dependencies);
    const result = await recordReturnRestock(
      context,
      {
        orderId: input.orderId,
        items: input.items,
        note: input.note,
        restockedAt: dependencies.now?.() ?? new Date(),
      },
      dependencies.returnRestockRepository,
    );

    return {
      ok: true,
      data: serializeReturnRestockResult(result),
    };
  } catch (error) {
    return toActionError(error);
  }
}

async function loadDemoAuthContext(
  role: DemoRole,
  dependencies: {
    authRepository: AuthContextRepository;
  },
) {
  return loadAuthContextForUser(
    resolveDemoUserId(role),
    dependencies.authRepository,
  );
}

function serializeControlOrder(
  order: ControlCenterOrder,
): SerializableControlCenterOrder {
  return {
    ...order,
    createdAt: order.createdAt.toISOString(),
    paidAt: toIsoOrNull(order.paidAt),
    fulfilledAt: toIsoOrNull(order.fulfilledAt),
    cancelledAt: toIsoOrNull(order.cancelledAt),
    refundedAt: toIsoOrNull(order.refundedAt),
  };
}

function serializeReturnRestockCandidate(
  candidate: ControlCenterReturnRestockCandidate,
): SerializableControlCenterReturnRestockCandidate {
  return {
    ...candidate,
    refundedAt: toIsoOrNull(candidate.refundedAt),
  };
}

function serializeLifecycleResult(
  result: OrderLifecycleResult,
): SerializableOrderLifecycleResult {
  return {
    ...result,
    cancelledAt: toIsoOrNull(result.cancelledAt),
    fulfilledAt: toIsoOrNull(result.fulfilledAt),
  };
}

function serializeRefundResult(
  result: RecordedRefundResult,
): SerializableRecordedRefundResult {
  return {
    ...result,
    refundedAt: result.refundedAt.toISOString(),
  };
}

function serializeReturnRestockResult(
  result: ReturnRestockResult,
): SerializableReturnRestockResult {
  return {
    ...result,
    restockedAt: result.restockedAt.toISOString(),
  };
}

function toIsoOrNull(date: Date | null) {
  return date ? date.toISOString() : null;
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
    message: "Unexpected control center error",
  };
}
