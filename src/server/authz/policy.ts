import { AuthorizationError } from "./errors";
import type { AuthContext } from "./types";

export function assertActiveMembership(context: AuthContext) {
  if (context.status !== "ACTIVE") {
    throw new AuthorizationError("Membership is not active");
  }
}

export function canAccessStore(context: AuthContext, storeId: string) {
  if (context.status !== "ACTIVE") {
    return false;
  }

  if (context.role === "OWNER") {
    return true;
  }

  return context.assignedStoreIds.includes(storeId);
}

export function assertCanCreateSale(context: AuthContext, storeId: string) {
  assertActiveMembership(context);

  if (!canAccessStore(context, storeId)) {
    throw new AuthorizationError("Store access denied");
  }
}

export function assertCanAdjustStock(context: AuthContext, storeId: string) {
  assertActiveMembership(context);

  if (context.role === "STAFF") {
    throw new AuthorizationError("Role cannot adjust stock");
  }

  if (!canAccessStore(context, storeId)) {
    throw new AuthorizationError("Store access denied");
  }
}

export function assertCanManageCatalog(context: AuthContext) {
  assertActiveMembership(context);

  if (context.role === "STAFF") {
    throw new AuthorizationError("Role cannot manage catalog");
  }
}

export function getAccessibleStoreScope(context: AuthContext) {
  if (context.status !== "ACTIVE") {
    return { allStores: false, storeIds: [] };
  }

  if (context.role === "OWNER") {
    return { allStores: true, storeIds: [] };
  }

  return { allStores: false, storeIds: [...context.assignedStoreIds] };
}
