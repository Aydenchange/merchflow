import type { PrismaClient } from "@prisma/client";
import { createPrismaAuditRepository } from "@/server/modules/audit/prisma-repository";
import { createPrismaAuthContextRepository } from "@/server/modules/authz/prisma-repository";
import {
  loadDemoAuditTrail,
  type LoadDemoAuditTrailInput,
} from "@/server/demo/audit";

type AuditDb = Pick<
  PrismaClient,
  "auditLog" | "organizationMembership" | "stockLedger"
>;

export type { LoadDemoAuditTrailInput };

export type AuditWorkbench = {
  loadDemoAuditTrail: typeof loadDemoAuditTrail;
};

type AuditActionRepositories = ReturnType<typeof createAuditActionRepositories>;

type AuditActionHandlerDependencies = {
  getDb: () => unknown;
  revalidatePath: (path: string) => void;
  workbench?: AuditWorkbench;
  createRepositories?: (db: unknown) => AuditActionRepositories;
};

const defaultWorkbench: AuditWorkbench = {
  loadDemoAuditTrail,
};

export function createAuditActionHandlers({
  getDb,
  workbench = defaultWorkbench,
  createRepositories = createAuditActionRepositories,
}: AuditActionHandlerDependencies) {
  return {
    async loadAuditTrailAction(input: LoadDemoAuditTrailInput) {
      const repositories = createRepositories(getDb());

      return workbench.loadDemoAuditTrail(input, {
        authRepository: repositories.authRepository,
        auditRepository: repositories.auditRepository,
      });
    },
  };
}

function createAuditActionRepositories(db: unknown) {
  const auditDb = db as AuditDb;

  return {
    authRepository: createPrismaAuthContextRepository(auditDb),
    auditRepository: createPrismaAuditRepository(auditDb),
  };
}
