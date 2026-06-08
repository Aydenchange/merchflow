import { describe, expect, it, vi } from "vitest";
import type {
  DemoAuditTrail,
  LoadDemoAuditTrailInput,
} from "@/server/demo/audit";
import type { DemoActionResult } from "@/server/demo/workbench";
import {
  createAuditActionHandlers,
  type AuditWorkbench,
} from "../actions/handlers";

function ok<T>(data: T): DemoActionResult<T> {
  return {
    ok: true,
    data,
  };
}

function auditTrail(): DemoAuditTrail {
  return {
    role: "owner",
    organizationId: "org_merchflow_demo",
    storeScope: {
      allStores: true,
      storeIds: [],
    },
    limit: 20,
    auditEvents: [],
    stockMovements: [],
  };
}

describe("createAuditActionHandlers", () => {
  it("loads audit trail through auth and audit repositories without revalidating", async () => {
    const input: LoadDemoAuditTrailInput = {
      role: "owner",
      storeIds: ["store_orchard"],
      limit: 10,
    };
    const workbench = {
      loadDemoAuditTrail: vi.fn(async () => ok(auditTrail())),
    } satisfies AuditWorkbench;
    const getDb = vi.fn(() => ({ db: true }));
    const revalidatePath = vi.fn();
    const createRepositories = vi.fn(() => ({
      authRepository: "auth_repo",
      auditRepository: "audit_repo",
    }));

    const result = await createAuditActionHandlers({
      getDb,
      revalidatePath,
      workbench,
      createRepositories,
    }).loadAuditTrailAction(input);

    expect(result).toEqual(ok(auditTrail()));
    expect(getDb).toHaveBeenCalledTimes(1);
    expect(createRepositories).toHaveBeenCalledWith({ db: true });
    expect(workbench.loadDemoAuditTrail).toHaveBeenCalledWith(input, {
      authRepository: "auth_repo",
      auditRepository: "audit_repo",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("returns staff denial without revalidating", async () => {
    const workbench = {
      loadDemoAuditTrail: vi.fn(async () => ({
        ok: false,
        message: "Role cannot view audit trail",
      })),
    } satisfies AuditWorkbench;
    const revalidatePath = vi.fn();

    const result = await createAuditActionHandlers({
      getDb: vi.fn(() => ({})),
      revalidatePath,
      workbench,
      createRepositories: vi.fn(() => ({
        authRepository: "auth_repo",
        auditRepository: "audit_repo",
      })),
    }).loadAuditTrailAction({
      role: "staff",
    });

    expect(result).toEqual({
      ok: false,
      message: "Role cannot view audit trail",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
