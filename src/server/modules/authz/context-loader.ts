import type { AuthContext, MembershipStatus, OrganizationRole } from "./types";

export class AuthContextNotFoundError extends Error {
  constructor(userId: string) {
    super(`Auth context not found for user ${userId}`);
    this.name = "AuthContextNotFoundError";
  }
}

export type MembershipRecord = {
  userId: string;
  membershipId: string;
  organizationId: string;
  role: OrganizationRole;
  status: MembershipStatus;
  storeAssignments: Array<{ storeId: string }>;
};

export type AuthContextRepository = {
  findMembershipByUserId(userId: string): Promise<MembershipRecord | null>;
};

export async function loadAuthContextForUser(
  userId: string,
  repository: AuthContextRepository,
): Promise<AuthContext> {
  const membership = await repository.findMembershipByUserId(userId);

  if (!membership) {
    throw new AuthContextNotFoundError(userId);
  }

  return {
    userId: membership.userId,
    membershipId: membership.membershipId,
    organizationId: membership.organizationId,
    role: membership.role,
    status: membership.status,
    assignedStoreIds:
      membership.role === "OWNER"
        ? []
        : membership.storeAssignments.map((assignment) => assignment.storeId),
  };
}
