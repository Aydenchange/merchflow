import type { Prisma, PrismaClient } from "@prisma/client";
import { InvalidOrderTransitionError } from "./errors";
import type { OrderLifecycleRepository } from "./lifecycle-service";
import type {
  OrderLifecycleResult,
  OrderLifecycleTransitionInput,
} from "./lifecycle-types";

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

type LifecycleOrderRow = Prisma.OrderGetPayload<{
  select: typeof lifecycleOrderSelect;
}>;

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
        const order = await transitionOrderOrThrow(tx, input, {
          expectedStatus: "PENDING_PAYMENT",
          targetStatus: "CANCELLED",
          timestampField: "cancelledAt",
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
              ...(input.reason ? { reason: input.reason } : {}),
            },
          },
        });

        return mapLifecycleResult(order, "CANCELLED");
      });
    },

    async fulfillPaidOrder(input) {
      return db.$transaction(async (tx) => {
        const order = await transitionOrderOrThrow(tx, input, {
          expectedStatus: "PAID",
          targetStatus: "FULFILLED",
          timestampField: "fulfilledAt",
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

async function transitionOrderOrThrow(
  tx: Prisma.TransactionClient,
  input: OrderLifecycleTransitionInput,
  transition: {
    expectedStatus: "PENDING_PAYMENT" | "PAID";
    targetStatus: "CANCELLED" | "FULFILLED";
    timestampField: "cancelledAt" | "fulfilledAt";
  },
): Promise<LifecycleOrderRow> {
  const updateResult = await tx.order.updateMany({
    where: {
      id: input.orderId,
      organizationId: input.organizationId,
      status: transition.expectedStatus,
    },
    data: {
      status: transition.targetStatus,
      [transition.timestampField]: input.transitionedAt,
    },
  });

  if (updateResult.count !== 1) {
    throw new InvalidOrderTransitionError({
      orderId: input.orderId,
      currentStatus: "UNKNOWN",
      expectedStatus: transition.expectedStatus,
      targetStatus: transition.targetStatus,
    });
  }

  return tx.order.findUniqueOrThrow({
    where: {
      id_organizationId: {
        id: input.orderId,
        organizationId: input.organizationId,
      },
    },
    select: lifecycleOrderSelect,
  });
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
