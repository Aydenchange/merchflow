import { AuthorizationError } from "./errors";
import type { AuthContext } from "./types";

export function assertActiveMembership(context: AuthContext) {
  if (context.status !== "ACTIVE") {
    throw new AuthorizationError("Membership is not active");
  }
}
