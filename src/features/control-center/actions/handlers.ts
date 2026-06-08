import type { PrismaClient } from "@prisma/client";
import { createPrismaAuthContextRepository } from "@/server/modules/authz/prisma-repository";
import {
  adjustDemoStock,
  cancelDemoOrder,
  fulfillDemoOrder,
  loadDemoControlCenter,
  refundDemoOrder,
  restockDemoReturn,
  type AdjustDemoStockInput,
  type CancelDemoOrderInput,
  type FulfillDemoOrderInput,
  type LoadDemoControlCenterInput,
  type RefundDemoOrderInput,
  type RestockDemoReturnInput,
} from "@/server/demo/control-center";
import { createPrismaControlCenterRepository } from "@/server/demo/control-prisma-repository";
import { createPrismaInventoryRepository } from "@/server/modules/inventory/prisma-repository";
import { createPrismaOrderLifecycleRepository } from "@/server/modules/orders/lifecycle-prisma-repository";
import { createPrismaRefundRepository } from "@/server/modules/refunds/prisma-repository";
import { createPrismaReturnRestockRepository } from "@/server/modules/returns/prisma-repository";

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
  CancelDemoOrderInput,
  FulfillDemoOrderInput,
  LoadDemoControlCenterInput,
  RefundDemoOrderInput,
  RestockDemoReturnInput,
};

export type ControlWorkbench = {
  loadDemoControlCenter: typeof loadDemoControlCenter;
  fulfillDemoOrder: typeof fulfillDemoOrder;
  cancelDemoOrder: typeof cancelDemoOrder;
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
  cancelDemoOrder,
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

    async cancelOrderAction(input: CancelDemoOrderInput) {
      const repositories = createRepositories(getDb());
      const result = await workbench.cancelDemoOrder(input, {
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
