import type { Prisma } from "@prisma/client";

export type AuditStoreScope = {
  allStores: boolean;
  storeIds: string[];
};

export type AuditTrailInput = {
  storeIds?: string[];
  limit?: number;
};

export type AuditTrailQuery = {
  organizationId: string;
  storeScope: AuditStoreScope;
  limit: number;
};

export type AuditEvent = {
  id: string;
  organizationId: string;
  storeId: string | null;
  storeName: string | null;
  storeCode: string | null;
  actorMembershipId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
};

export type StockMovementReason =
  | "SALE"
  | "ADJUSTMENT_IN"
  | "ADJUSTMENT_OUT"
  | "RETURN_RESTOCK";

export type StockMovement = {
  id: string;
  organizationId: string;
  storeId: string;
  storeName: string;
  storeCode: string;
  skuId: string;
  skuName: string;
  barcode: string;
  quantityDelta: number;
  reason: StockMovementReason;
  relatedOrderId: string | null;
  actorMembershipId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  note: string | null;
  createdAt: Date;
};

export type AuditTrail = {
  organizationId: string;
  storeScope: AuditStoreScope;
  limit: number;
  auditEvents: AuditEvent[];
  stockMovements: StockMovement[];
};
