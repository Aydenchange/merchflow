import type { PrismaClient } from "@prisma/client";
import { getAccessibleStoreScope } from "../authz/policy";
import type { DemoRepository } from "./workbench";

type PrismaWithDemoAccess = Pick<
  PrismaClient,
  "organization" | "payment" | "store" | "user"
>;

export function createPrismaDemoRepository(
  db: PrismaWithDemoAccess,
): DemoRepository {
  return {
    async findUserProfileById(userId) {
      return db.user.findUnique({
        where: {
          id: userId,
        },
        select: {
          id: true,
          email: true,
          name: true,
        },
      });
    },

    async findOrganizationById(organizationId) {
      return db.organization.findUnique({
        where: {
          id: organizationId,
        },
        select: {
          id: true,
          name: true,
          country: true,
          currency: true,
        },
      });
    },

    async findVisibleStores(context) {
      const storeScope = getAccessibleStoreScope(context);

      if (!storeScope.allStores && storeScope.storeIds.length === 0) {
        return [];
      }

      return db.store.findMany({
        where: {
          organizationId: context.organizationId,
          status: "ACTIVE",
          ...(storeScope.allStores
            ? {}
            : {
                id: {
                  in: storeScope.storeIds,
                },
              }),
        },
        select: {
          id: true,
          name: true,
          code: true,
          address: true,
        },
        orderBy: {
          code: "asc",
        },
      });
    },

    async findPaymentSnapshot(paymentId) {
      const payment = await db.payment.findUnique({
        where: {
          id: paymentId,
        },
        select: {
          id: true,
          status: true,
          amount: true,
          currency: true,
          order: {
            select: {
              id: true,
              status: true,
            },
          },
        },
      });

      if (!payment) {
        return null;
      }

      return {
        paymentId: payment.id,
        paymentStatus: payment.status,
        orderId: payment.order.id,
        orderStatus: payment.order.status,
        totalAmount: payment.amount,
        currency: payment.currency,
      };
    },
  };
}
