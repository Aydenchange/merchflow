import type { PrismaClient } from "@prisma/client";
import { createPrismaAuthContextRepository } from "../server/authz/prisma-repository";
import {
  loadDemoOperationsDashboard,
  type LoadDemoOperationsDashboardInput,
} from "../server/demo/operations";
import { createPrismaReportsRepository } from "../server/reports/prisma-repository";

type OperationsDb = Pick<
  PrismaClient,
  "inventoryBalance" | "order" | "orderItem" | "organization" | "organizationMembership"
>;

export type OperationsWorkbench = {
  loadDemoOperationsDashboard: typeof loadDemoOperationsDashboard;
};

type OperationsActionRepositories = ReturnType<
  typeof createOperationsActionRepositories
>;

type OperationsActionHandlerDependencies = {
  getDb: () => unknown;
  revalidatePath: (path: string) => void;
  workbench?: OperationsWorkbench;
  createRepositories?: (db: unknown) => OperationsActionRepositories;
};

const defaultWorkbench: OperationsWorkbench = {
  loadDemoOperationsDashboard,
};

export function createOperationsActionHandlers({
  getDb,
  revalidatePath: _revalidatePath,
  workbench = defaultWorkbench,
  createRepositories = createOperationsActionRepositories,
}: OperationsActionHandlerDependencies) {
  return {
    async loadOperationsDashboardAction(
      input: LoadDemoOperationsDashboardInput,
    ) {
      const repositories = createRepositories(getDb());

      return workbench.loadDemoOperationsDashboard(input, {
        authRepository: repositories.authRepository,
        reportsRepository: repositories.reportsRepository,
      });
    },
  };
}

function createOperationsActionRepositories(db: unknown) {
  const operationsDb = db as OperationsDb;

  return {
    authRepository: createPrismaAuthContextRepository(operationsDb),
    reportsRepository: createPrismaReportsRepository(operationsDb),
  };
}
