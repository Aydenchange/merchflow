import {
  loadAuthContextForUser,
  type AuthContextRepository,
} from "../modules/authz/context-loader";
import {
  loadAuditTrail,
  type AuditRepository,
  type AuditStoreScope,
} from "../modules/audit/service";
import type { AuditEvent, StockMovement } from "../modules/audit/types";
import {
  resolveDemoUserId,
  type DemoActionResult,
  type DemoRole,
} from "./workbench";

export type LoadDemoAuditTrailInput = {
  role: DemoRole;
  storeIds?: string[];
  limit?: number;
};

export type SerializableAuditEvent = Omit<
  AuditEvent,
  "createdAt" | "metadata"
> & {
  createdAt: string;
  metadataText: string | null;
};

export type SerializableStockMovement = Omit<StockMovement, "createdAt"> & {
  createdAt: string;
};

export type DemoAuditTrail = {
  role: DemoRole;
  organizationId: string;
  storeScope: AuditStoreScope;
  limit: number;
  auditEvents: SerializableAuditEvent[];
  stockMovements: SerializableStockMovement[];
};

export async function loadDemoAuditTrail(
  input: LoadDemoAuditTrailInput,
  dependencies: {
    authRepository: AuthContextRepository;
    auditRepository: AuditRepository;
  },
): Promise<DemoActionResult<DemoAuditTrail>> {
  try {
    const context = await loadAuthContextForUser(
      resolveDemoUserId(input.role),
      dependencies.authRepository,
    );
    const auditTrail = await loadAuditTrail(
      context,
      {
        storeIds: input.storeIds,
        limit: input.limit,
      },
      dependencies.auditRepository,
    );

    return {
      ok: true,
      data: {
        role: input.role,
        organizationId: auditTrail.organizationId,
        storeScope: auditTrail.storeScope,
        limit: auditTrail.limit,
        auditEvents: auditTrail.auditEvents.map(serializeAuditEvent),
        stockMovements: auditTrail.stockMovements.map(serializeStockMovement),
      },
    };
  } catch (error) {
    return toActionError(error);
  }
}

function serializeAuditEvent(event: AuditEvent): SerializableAuditEvent {
  const { metadata, createdAt, ...rest } = event;

  return {
    ...rest,
    metadataText: metadata === null ? null : JSON.stringify(metadata),
    createdAt: createdAt.toISOString(),
  };
}

function serializeStockMovement(
  movement: StockMovement,
): SerializableStockMovement {
  return {
    ...movement,
    createdAt: movement.createdAt.toISOString(),
  };
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
    message: "Unexpected audit trail error",
  };
}
