import type { PrismaClient } from "@prisma/client";
import type { RefundRepository } from "./service";

type PrismaWithRefundAccess = Pick<PrismaClient, "$transaction" | "order">;

export function createPrismaRefundRepository(
  db: PrismaWithRefundAccess,
): RefundRepository {
  return {
    async findOrderForRefund(input) {
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
          payment: {
            select: {
              id: true,
              status: true,
              amount: true,
              currency: true,
            },
          },
        },
      });
    },

    async recordFullRefund(input) {
      return db.$transaction(async (tx) => {
        const order = await tx.order.update({
          where: {
            id_organizationId: {
              id: input.orderId,
              organizationId: input.organizationId,
            },
          },
          data: {
            status: "REFUNDED",
            refundedAt: input.refundedAt,
          },
          select: {
            id: true,
            organizationId: true,
            storeId: true,
            status: true,
            refundedAt: true,
          },
        });

        await tx.payment.update({
          where: {
            id: input.paymentId,
          },
          data: {
            status: "REFUNDED",
          },
          select: {
            id: true,
            status: true,
          },
        });

        await tx.auditLog.create({
          data: {
            organizationId: input.organizationId,
            storeId: input.storeId,
            actorMembershipId: input.actorMembershipId,
            action: "refund.recorded",
            entityType: "Order",
            entityId: input.orderId,
            metadata: {
              paymentId: input.paymentId,
              refundAmount: input.refundAmount,
              currency: input.currency,
              reason: input.reason,
              refundedAt: input.refundedAt.toISOString(),
              restocked: false,
            },
          },
        });

        return {
          orderId: order.id,
          paymentId: input.paymentId,
          organizationId: order.organizationId,
          storeId: order.storeId,
          orderStatus: "REFUNDED",
          paymentStatus: "REFUNDED",
          refundAmount: input.refundAmount,
          currency: input.currency,
          refundedAt: order.refundedAt ?? input.refundedAt,
        };
      });
    },
  };
}
