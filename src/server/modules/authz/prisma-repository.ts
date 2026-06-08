import type { PrismaClient } from "@prisma/client";
import type { AuthContextRepository, MembershipRecord } from "./context-loader";

type PrismaWithMembershipLookup = Pick<PrismaClient, "organizationMembership">;

export function createPrismaAuthContextRepository(
  db: PrismaWithMembershipLookup,
): AuthContextRepository {
  return {
    async findMembershipByUserId(
      userId: string,
    ): Promise<MembershipRecord | null> {
      const membership = await db.organizationMembership.findUnique({
        where: { userId },
        select: {
          id: true,
          organizationId: true,
          userId: true,
          role: true,
          status: true,
          storeAssignments: {
            select: {
              storeId: true,
            },
            orderBy: {
              storeId: "asc",
            },
          },
        },
      });

      if (!membership) {
        return null;
      }

      return {
        userId: membership.userId,
        membershipId: membership.id,
        organizationId: membership.organizationId,
        role: membership.role,
        status: membership.status,
        storeAssignments: membership.storeAssignments,
      };
    },
  };
}
