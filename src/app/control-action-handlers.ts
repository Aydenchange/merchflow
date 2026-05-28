import type { PrismaClient } from "@prisma/client";
import { createPrismaAuthContextRepository } from "../server/authz/prisma-repository";
import {
  adjustDemoStock,
  fulfillDemoOrder,
  loadDemoControlCenter,
  refundDemoOrder,
  restockDemoReturn,
  type AdjustDemoStockInput,
  type FulfillDemoOrderInput,
  type LoadDemoControlCenterInput,
  type RefundDemoOrderInput,
  type RestockDemoReturnInput,
} from "../server/demo/control-center";
import { createPrismaControlCenterRepository } from "../server/demo/control-prisma-repository";
import { createPrismaInventoryRepository } from "../server/inventory/prisma-repository";
import { createPrismaOrderLifecycleRepository } from "../server/orders/lifecycle-prisma-repository";
import { createPrismaRefundRepository } from "../server/refunds/prisma-repository";
import { createPrismaReturnRestockRepository } from "../server/returns/prisma-repository";

type ControlDb = Pick<
  PrismaClient,
  | "$transaction"
  | "auditLog"
  | "inventoryBalance"
  | "order"
  | "organizationMembership"
  | "stockLedger"
>;

export type {
  AdjustDemoStockInput,
  FulfillDemoOrderInput,
  LoadDemoControlCenterInput,
  RefundDemoOrderInput,
  RestockDemoReturnInput,
};

export type ControlWorkbench = {
  loadDemoControlCenter: typeof loadDemoControlCenter;
  fulfillDemoOrder: typeof fulfillDemoOrder;
  refundDemoOrder: typeof refundDemoOrder;
  adjustDemoStock: typeof adjustDemoStock;
  restockDemoReturn: typeof restockDemoReturn;
};

type ControlActionRepositories = ReturnType<
  typeof createControlActionRepositories
>;

type ControlActionHandlerDependencies = {
  getDb: () => unknown;
  revalidatePath: (path: string) => void;
  workbench?: ControlWorkbench;
  createRepositories?: (db: unknown) => ControlActionRepositories;
};

const defaultWorkbench: ControlWorkbench = {
  loadDemoControlCenter,
  fulfillDemoOrder,
  refundDemoOrder,
  adjustDemoStock,
  restockDemoReturn,
};

export function createControlActionHandlers({
  getDb,
  revalidatePath,
  workbench = defaultWorkbench,
  createRepositories = createControlActionRepositories,
}: ControlActionHandlerDependencies) {
  return {
    async loadControlCenterAction(input: LoadDemoControlCenterInput) {
      const repositories = createRepositories(getDb());

      return workbench.loadDemoControlCenter(input, {
        authRepository: repositories.authRepository,
        controlRepository: repositories.controlRepository,
      });
    },

    async fulfillOrderAction(input: FulfillDemoOrderInput) {
      const repositories = createRepositories(getDb());
      const result = await workbench.fulfillDemoOrder(input, {
        authRepository: repositories.authRepository,
        lifecycleRepository: repositories.lifecycleRepository,
      });

      if (result.ok) {
        revalidatePath("/");
      }

      return result;
    },

    async refundOrderAction(input: RefundDemoOrderInput) {
      const repositories = createRepositories(getDb());
      const result = await workbench.refundDemoOrder(input, {
        authRepository: repositories.authRepository,
        refundRepository: repositories.refundRepository,
      });

      if (result.ok) {
        revalidatePath("/");
      }

      return result;
    },

    async adjustStockAction(input: AdjustDemoStockInput) {
      const repositories = createRepositories(getDb());
      const result = await workbench.adjustDemoStock(input, {
        authRepository: repositories.authRepository,
        inventoryRepository: repositories.inventoryRepository,
      });

      if (result.ok) {
        revalidatePath("/");
      }

      return result;
    },

    async restockReturnAction(input: RestockDemoReturnInput) {
      const repositories = createRepositories(getDb());
      const result = await workbench.restockDemoReturn(input, {
        authRepository: repositories.authRepository,
        returnRestockRepository: repositories.returnRestockRepository,
      });

      if (result.ok) {
        revalidatePath("/");
      }

      return result;
    },
  };
}

function createControlActionRepositories(db: unknown) {
  const controlDb = db as ControlDb;

  return {
    authRepository: createPrismaAuthContextRepository(controlDb),
    controlRepository: createPrismaControlCenterRepository(controlDb),
    lifecycleRepository: createPrismaOrderLifecycleRepository(controlDb),
    refundRepository: createPrismaRefundRepository(controlDb),
    inventoryRepository: createPrismaInventoryRepository(controlDb),
    returnRestockRepository: createPrismaReturnRestockRepository(controlDb),
  };
}
