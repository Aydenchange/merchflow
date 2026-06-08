import { AuthorizationError } from "../authz/errors";
import { assertActiveMembership } from "../authz/policy";
import type { AuthContext } from "../authz/types";
import { InvalidAuditTrailInputError } from "./errors";
import type {
  AuditEvent,
  AuditStoreScope,
  AuditTrail,
  AuditTrailInput,
  AuditTrailQuery,
  StockMovement,
} from "./types";

const DEFAULT_AUDIT_LIMIT = 20;
const MAX_AUDIT_LIMIT = 50;

export type AuditRepository = {
  listAuditEvents(input: AuditTrailQuery): Promise<AuditEvent[]>;
  listStockMovements(input: AuditTrailQuery): Promise<StockMovement[]>;
};

export type {
  AuditEvent,
  AuditStoreScope,
  AuditTrail,
  AuditTrailQuery,
  StockMovement,
} from "./types";

export { InvalidAuditTrailInputError } from "./errors";

export async function loadAuditTrail(
  context: AuthContext,
  input: AuditTrailInput,
  repository: AuditRepository,
): Promise<AuditTrail> {
  const limit = normalizeLimit(input.limit);
  const storeScope = resolveAuditStoreScope(context, input.storeIds);
  const query = {
    organizationId: context.organizationId,
    storeScope,
    limit,
  };
  const [auditEvents, stockMovements] = await Promise.all([
    repository.listAuditEvents(query),
    repository.listStockMovements(query),
  ]);

  return {
    organizationId: context.organizationId,
    storeScope,
    limit,
    auditEvents,
    stockMovements,
  };
}

function resolveAuditStoreScope(
  context: AuthContext,
  requestedStoreIds?: string[],
): AuditStoreScope {
  assertActiveMembership(context);

  if (context.role === "STAFF") {
    throw new AuthorizationError("Role cannot view audit trail");
  }

  const selectedStoreIds = uniqueStoreIds(requestedStoreIds);

  if (requestedStoreIds && selectedStoreIds.length === 0) {
    throw new InvalidAuditTrailInputError(
      "Audit trail store filter must not be empty",
    );
  }

  if (context.role === "OWNER") {
    return selectedStoreIds.length > 0
      ? { allStores: false, storeIds: selectedStoreIds }
      : { allStores: true, storeIds: [] };
  }

  const assignedStoreIds = new Set(context.assignedStoreIds);

  if (selectedStoreIds.length === 0) {
    return {
      allStores: false,
      storeIds: [...assignedStoreIds],
    };
  }

  const hasUnassignedStore = selectedStoreIds.some(
    (storeId) => !assignedStoreIds.has(storeId),
  );

  if (hasUnassignedStore) {
    throw new AuthorizationError("Store access denied");
  }

  return {
    allStores: false,
    storeIds: selectedStoreIds,
  };
}

function normalizeLimit(limit?: number) {
  if (limit === undefined) {
    return DEFAULT_AUDIT_LIMIT;
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_AUDIT_LIMIT) {
    throw new InvalidAuditTrailInputError(
      `Audit trail limit must be between 1 and ${MAX_AUDIT_LIMIT}`,
    );
  }

  return limit;
}

function uniqueStoreIds(storeIds?: string[]) {
  if (!storeIds) {
    return [];
  }

  return [...new Set(storeIds)];
}
