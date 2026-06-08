import type { Prisma, PrismaClient } from "@prisma/client";
import type { AuditRepository } from "./service";
import type { AuditEvent, AuditTrailQuery, StockMovement } from "./types";

type PrismaWithAuditAccess = Pick<PrismaClient, "auditLog" | "stockLedger">;

const auditEventSelect = {
  id: true,
  organizationId: true,
  storeId: true,
  actorMembershipId: true,
  action: true,
  entityType: true,
  entityId: true,
  metadata: true,
  createdAt: true,
  store: {
    select: {
      name: true,
      code: true,
    },
  },
  actor: {
    select: {
      user: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  },
} satisfies Prisma.AuditLogSelect;

const stockMovementSelect = {
  id: true,
  organizationId: true,
  storeId: true,
  skuId: true,
  quantityDelta: true,
  reason: true,
  relatedOrderId: true,
  actorMembershipId: true,
  note: true,
  createdAt: true,
  store: {
    select: {
      name: true,
      code: true,
    },
  },
  sku: {
    select: {
      name: true,
      barcode: true,
    },
  },
  actor: {
    select: {
      user: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  },
} satisfies Prisma.StockLedgerSelect;

type AuditEventRow = Prisma.AuditLogGetPayload<{
  select: typeof auditEventSelect;
}>;
type StockMovementRow = Prisma.StockLedgerGetPayload<{
  select: typeof stockMovementSelect;
}>;

export function createPrismaAuditRepository(
  db: PrismaWithAuditAccess,
): AuditRepository {
  return {
    async listAuditEvents(input) {
      const where = scopedWhere(input);

      if (!where) {
        return [];
      }

      const events = await db.auditLog.findMany({
        where,
        select: auditEventSelect,
        orderBy: {
          createdAt: "desc",
        },
        take: input.limit,
      });

      return events.map(mapAuditEventRow);
    },

    async listStockMovements(input) {
      const where = scopedWhere(input);

      if (!where) {
        return [];
      }

      const movements = await db.stockLedger.findMany({
        where,
        select: stockMovementSelect,
        orderBy: {
          createdAt: "desc",
        },
        take: input.limit,
      });

      return movements.map(mapStockMovementRow);
    },
  };
}

function scopedWhere(input: AuditTrailQuery) {
  if (!input.storeScope.allStores && input.storeScope.storeIds.length === 0) {
    return null;
  }

  return {
    organizationId: input.organizationId,
    ...(input.storeScope.allStores
      ? {}
      : {
          storeId: {
            in: input.storeScope.storeIds,
          },
        }),
  };
}

function mapAuditEventRow(row: AuditEventRow): AuditEvent {
  return {
    id: row.id,
    organizationId: row.organizationId,
    storeId: row.storeId,
    storeName: row.store?.name ?? null,
    storeCode: row.store?.code ?? null,
    actorMembershipId: row.actorMembershipId,
    actorName: row.actor?.user.name ?? null,
    actorEmail: row.actor?.user.email ?? null,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    metadata: row.metadata,
    createdAt: row.createdAt,
  };
}

function mapStockMovementRow(row: StockMovementRow): StockMovement {
  return {
    id: row.id,
    organizationId: row.organizationId,
    storeId: row.storeId,
    storeName: row.store.name,
    storeCode: row.store.code,
    skuId: row.skuId,
    skuName: row.sku.name,
    barcode: row.sku.barcode,
    quantityDelta: row.quantityDelta,
    reason: row.reason,
    relatedOrderId: row.relatedOrderId,
    actorMembershipId: row.actorMembershipId,
    actorName: row.actor?.user.name ?? null,
    actorEmail: row.actor?.user.email ?? null,
    note: row.note,
    createdAt: row.createdAt,
  };
}
