import type { PrismaClient } from "@prisma/client";
import { createPrismaAuthContextRepository } from "@/server/modules/authz/prisma-repository";
import { createPrismaCatalogRepository } from "@/server/modules/catalog/prisma-repository";
import { createPrismaDemoRepository } from "@/server/demo/prisma-repository";
import {
  createDemoPosOrder,
  loadDemoContext,
  lookupBarcodeForCart,
  simulateDemoPaymentSuccess,
  type DemoRole,
} from "@/server/demo/workbench";
import { createPrismaOrderRepository } from "@/server/modules/orders/prisma-repository";
import { createPrismaPaymentRepository } from "@/server/modules/payments/prisma-repository";

type DemoDb = Pick<
  PrismaClient,
  | "$transaction"
  | "organization"
  | "organizationMembership"
  | "payment"
  | "product"
  | "sku"
  | "store"
  | "user"
>;

export type PosOrderActionInput = {
  role: DemoRole;
  storeId: string;
  items: Array<{
    skuId: string;
    quantity: number;
  }>;
};

export type LookupSkuActionInput = {
  role: DemoRole;
  storeId: string;
  barcode: string;
};

export type SimulatePaymentSuccessActionInput = {
  paymentId: string;
  providerEventId?: string;
};

export type WorkbenchOperations = {
  loadDemoContext: typeof loadDemoContext;
  lookupBarcodeForCart: typeof lookupBarcodeForCart;
  createDemoPosOrder: typeof createDemoPosOrder;
  simulateDemoPaymentSuccess: typeof simulateDemoPaymentSuccess;
};

type ActionRepositories = ReturnType<typeof createActionRepositories>;

type PosActionHandlerDependencies = {
  getDb: () => unknown;
  revalidatePath: (path: string) => void;
  workbench?: WorkbenchOperations;
  createRepositories?: (db: unknown) => ActionRepositories;
};

const defaultWorkbench: WorkbenchOperations = {
  loadDemoContext,
  lookupBarcodeForCart,
  createDemoPosOrder,
  simulateDemoPaymentSuccess,
};

export function createPosActionHandlers({
  getDb,
  revalidatePath,
  workbench = defaultWorkbench,
  createRepositories = createActionRepositories,
}: PosActionHandlerDependencies) {
  return {
    async loadDemoContextAction(role: DemoRole) {
      const repositories = createRepositories(getDb());

      return workbench.loadDemoContext(
        { role },
        {
          authRepository: repositories.authRepository,
          demoRepository: repositories.demoRepository,
        },
      );
    },

    async lookupSkuAction(input: LookupSkuActionInput) {
      const repositories = createRepositories(getDb());

      return workbench.lookupBarcodeForCart(input, {
        authRepository: repositories.authRepository,
        catalogRepository: repositories.catalogRepository,
      });
    },

    async createPosOrderAction(input: PosOrderActionInput) {
      const repositories = createRepositories(getDb());
      const result = await workbench.createDemoPosOrder(input, {
        authRepository: repositories.authRepository,
        orderRepository: repositories.orderRepository,
      });

      if (result.ok) {
        revalidatePath("/");
      }

      return result;
    },

    async simulatePaymentSuccessAction(
      input: SimulatePaymentSuccessActionInput,
    ) {
      const repositories = createRepositories(getDb());
      const result = await workbench.simulateDemoPaymentSuccess(input, {
        demoRepository: repositories.demoRepository,
        paymentRepository: repositories.paymentRepository,
      });

      if (result.ok) {
        revalidatePath("/");
      }

      return result;
    },
  };
}

function createActionRepositories(db: unknown) {
  const demoDb = db as DemoDb;

  return {
    authRepository: createPrismaAuthContextRepository(demoDb),
    demoRepository: createPrismaDemoRepository(demoDb),
    catalogRepository: createPrismaCatalogRepository(demoDb),
    orderRepository: createPrismaOrderRepository(demoDb),
    paymentRepository: createPrismaPaymentRepository(demoDb),
  };
}
