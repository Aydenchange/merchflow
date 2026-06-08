export type OrganizationRole = "OWNER" | "MANAGER" | "STAFF";

export type MembershipStatus = "ACTIVE" | "INVITED" | "DISABLED";

export type AuthContext = {
  userId: string;
  membershipId: string;
  organizationId: string;
  role: OrganizationRole;
  status: MembershipStatus;
  assignedStoreIds: string[];
};
