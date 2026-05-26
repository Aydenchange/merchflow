import type { PrismaClient } from "@prisma/client";
import type { OrderLifecycleRepository } from "./lifecycle-service";
import type { OrderLifecycleResult } from "./lifecycle-types";

type PrismaWithOrderLifecycleAccess = Pick<
  PrismaClient,
  "$transaction" | "order"
>;

const lifecycleOrderSelect = {
  id: true,
  organizationId: true,
  storeId: true,
  status: true,
  cancelledAt: true,
  fulfilledAt: true,
} as const;

export function createPrismaOrderLifecycleRepository(
  db: PrismaWithOrderLifecycleAccess,
): OrderLifecycleRepository {
  return {
    async findOrderForLifecycle(input) {
      return db.order.findFirst({
        where: {
          id: input.orderId,
          organizationId: input.organizationId,
        },
        select: {
          id: true,
          organizationId: true,
          storeId: true,
          status: true,
        },
      });
    },

    async cancelPendingOrder(input) {
      return db.$transaction(async (tx) => {
        const order = await tx.order.update({
          where: {
            id_organizationId: {
              id: input.orderId,
              organizationId: input.organizationId,
            },
          },
          data: {
            status: "CANCELLED",
            cancelledAt: input.transitionedAt,
          },
          select: lifecycleOrderSelect,
        });

        await tx.payment.update({
          where: {
            orderId: input.orderId,
          },
          data: {
            status: "FAILED",
          },
        });

        await tx.auditLog.create({
          data: {
            organizationId: input.organizationId,
            storeId: input.storeId,
            actorMembershipId: input.actorMembershipId,
            action: "order.cancelled",
            entityType: "Order",
            entityId: input.orderId,
            metadata: {
              cancelledAt: input.transitionedAt.toISOString(),
              paymentStatus: "FAILED",
            },
          },
        });

        return mapLifecycleResult(order, "CANCELLED");
      });
    },

    async fulfillPaidOrder(input) {
      return db.$transaction(async (tx) => {
        const order = await tx.order.update({
          where: {
            id_organizationId: {
              id: input.orderId,
              organizationId: input.organizationId,
            },
          },
          data: {
            status: "FULFILLED",
            fulfilledAt: input.transitionedAt,
          },
          select: lifecycleOrderSelect,
        });

        await tx.auditLog.create({
          data: {
            organizationId: input.organizationId,
            storeId: input.storeId,
            actorMembershipId: input.actorMembershipId,
            action: "order.fulfilled",
            entityType: "Order",
            entityId: input.orderId,
            metadata: {
              fulfilledAt: input.transitionedAt.toISOString(),
            },
          },
        });

        return mapLifecycleResult(order, "FULFILLED");
      });
    },
  };
}

function mapLifecycleResult(
  order: {
    id: string;
    organizationId: string;
    storeId: string;
    cancelledAt: Date | null;
    fulfilledAt: Date | null;
  },
  status: OrderLifecycleResult["status"],
): OrderLifecycleResult {
  return {
    orderId: order.id,
    organizationId: order.organizationId,
    storeId: order.storeId,
    status,
    cancelledAt: order.cancelledAt,
    fulfilledAt: order.fulfilledAt,
  };
}
