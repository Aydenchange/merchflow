import {
  loadAuthContextForUser,
  type AuthContextRepository,
} from "../authz/context-loader";
import type { AuthContext, OrganizationRole } from "../authz/types";
import {
  lookupSkuForSaleByBarcode,
  type CatalogRepository,
} from "../catalog/service";
import {
  createPendingPosOrder,
  type OrderRepository,
} from "../orders/service";
import {
  processPaymentSuccess,
  type PaymentRepository,
  type PaymentSuccessResult,
} from "../payments/service";

const DEMO_BARCODE = "9555000000012";
const DEMO_PAYMENT_PROVIDER = "simulated_pos";

const DEMO_USER_IDS = {
  owner: "user_owner",
  manager: "user_manager",
  staff: "user_staff",
} as const;

export type DemoRole = keyof typeof DEMO_USER_IDS;

export type DemoActionResult<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      message: string;
    };

export type DemoUserProfile = {
  id: string;
  email: string;
  name: string | null;
};

export type DemoOrganization = {
  id: string;
  name: string;
  country: string;
  currency: string;
};

export type DemoStoreOption = {
  id: string;
  name: string;
  code: string;
  address: string | null;
};

export type DemoPaymentSnapshot = {
  paymentId: string;
  paymentStatus:
    | "PENDING"
    | "SUCCEEDED"
    | "FAILED"
    | "REFUNDED"
    | "PARTIALLY_REFUNDED"
    | "REQUIRES_REVIEW";
  orderId: string;
  orderStatus:
    | "PENDING_PAYMENT"
    | "PAID"
    | "FULFILLED"
    | "CANCELLED"
    | "PAYMENT_FAILED"
    | "REFUNDED"
    | "PAYMENT_REQUIRES_REVIEW";
  totalAmount: number;
  currency: string;
};

export type DemoRepository = {
  findUserProfileById(userId: string): Promise<DemoUserProfile | null>;
  findOrganizationById(
    organizationId: string,
  ): Promise<DemoOrganization | null>;
  findVisibleStores(context: AuthContext): Promise<DemoStoreOption[]>;
  findPaymentSnapshot(paymentId: string): Promise<DemoPaymentSnapshot | null>;
};

export type DemoContextView = {
  role: DemoRole;
  demoBarcode: string;
  user: DemoUserProfile & {
    organizationRole: OrganizationRole;
  };
  organization: DemoOrganization;
  auth: {
    membershipId: string;
    organizationId: string;
    organizationRole: OrganizationRole;
    assignedStoreIds: string[];
  };
  stores: DemoStoreOption[];
  selectedStoreId?: string;
};

export type DemoCartSku = {
  skuId: string;
  productId: string;
  name: string;
  barcode: string;
  priceAmount: number;
  quantityOnHand: number;
  lowStockThreshold: number;
  isLowStock: boolean;
};

export type DemoPosOrderView = Awaited<
  ReturnType<typeof createPendingPosOrder>
>;

export type DemoPaymentSuccessView = {
  result: PaymentSuccessResult;
  payment: DemoPaymentSnapshot | null;
};

export function resolveDemoUserId(role: DemoRole) {
  return DEMO_USER_IDS[role];
}

export async function loadDemoContext(
  input: { role: DemoRole },
  dependencies: {
    authRepository: AuthContextRepository;
    demoRepository: DemoRepository;
  },
): Promise<DemoActionResult<DemoContextView>> {
  try {
    const userId = resolveDemoUserId(input.role);
    const context = await loadAuthContextForUser(
      userId,
      dependencies.authRepository,
    );
    const [user, organization, stores] = await Promise.all([
      dependencies.demoRepository.findUserProfileById(userId),
      dependencies.demoRepository.findOrganizationById(context.organizationId),
      dependencies.demoRepository.findVisibleStores(context),
    ]);

    if (!user) {
      return {
        ok: false,
        message: `Demo user profile ${userId} was not found`,
      };
    }

    if (!organization) {
      return {
        ok: false,
        message: `Demo organization ${context.organizationId} was not found`,
      };
    }

    return {
      ok: true,
      data: {
        role: input.role,
        demoBarcode: DEMO_BARCODE,
        user: {
          ...user,
          organizationRole: context.role,
        },
        organization,
        auth: {
          membershipId: context.membershipId,
          organizationId: context.organizationId,
          organizationRole: context.role,
          assignedStoreIds: context.assignedStoreIds,
        },
        stores,
        selectedStoreId: stores[0]?.id,
      },
    };
  } catch (error) {
    return toActionError(error);
  }
}

export async function lookupBarcodeForCart(
  input: {
    role: DemoRole;
    storeId: string;
    barcode: string;
  },
  dependencies: {
    authRepository: AuthContextRepository;
    catalogRepository: CatalogRepository;
  },
): Promise<DemoActionResult<DemoCartSku>> {
  try {
    const barcode = input.barcode.trim();

    if (!barcode) {
      return {
        ok: false,
        message: "Barcode is required",
      };
    }

    const context = await loadDemoAuthContext(input.role, dependencies);
    const sku = await lookupSkuForSaleByBarcode(
      context,
      {
        storeId: input.storeId,
        barcode,
      },
      dependencies.catalogRepository,
    );

    return {
      ok: true,
      data: {
        ...sku,
        isLowStock:
          sku.lowStockThreshold > 0 &&
          sku.quantityOnHand <= sku.lowStockThreshold,
      },
    };
  } catch (error) {
    return toActionError(error);
  }
}

export async function createDemoPosOrder(
  input: {
    role: DemoRole;
    storeId: string;
    items: Array<{
      skuId: string;
      quantity: number;
    }>;
  },
  dependencies: {
    authRepository: AuthContextRepository;
    orderRepository: OrderRepository;
  },
): Promise<DemoActionResult<DemoPosOrderView>> {
  try {
    const context = await loadDemoAuthContext(input.role, dependencies);
    const order = await createPendingPosOrder(
      context,
      {
        storeId: input.storeId,
        items: input.items,
      },
      dependencies.orderRepository,
    );

    return {
      ok: true,
      data: order,
    };
  } catch (error) {
    return toActionError(error);
  }
}

export async function simulateDemoPaymentSuccess(
  input: {
    paymentId: string;
    providerEventId?: string;
    providerPaymentId?: string;
  },
  dependencies: {
    demoRepository: Pick<DemoRepository, "findPaymentSnapshot">;
    paymentRepository: PaymentRepository;
    now?: () => Date;
  },
): Promise<DemoActionResult<DemoPaymentSuccessView>> {
  try {
    const processedAt = dependencies.now?.() ?? new Date();
    const providerEventId =
      input.providerEventId?.trim() ||
      `evt_demo_${input.paymentId}_${processedAt.getTime()}`;
    const providerPaymentId = input.providerPaymentId?.trim() || undefined;
    const result = await processPaymentSuccess(
      {
        provider: DEMO_PAYMENT_PROVIDER,
        providerEventId,
        paymentId: input.paymentId,
        providerPaymentId,
        payload: {
          source: "demo-pos-workbench",
        },
        processedAt,
      },
      dependencies.paymentRepository,
    );
    const payment = await dependencies.demoRepository.findPaymentSnapshot(
      input.paymentId,
    );

    return {
      ok: true,
      data: {
        result,
        payment,
      },
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

function toActionError(error: unknown): DemoActionResult<never> {
  if (error instanceof Error) {
    return {
      ok: false,
      message: error.message,
    };
  }

  return {
    ok: false,
    message: "Unexpected demo workbench error",
  };
}
