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
