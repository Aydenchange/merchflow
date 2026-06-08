import { describe, expect, it, vi } from "vitest";
import { createPrismaAuditRepository } from "../prisma-repository";

function createDb(overrides: {
  auditLogFindMany?: ReturnType<typeof vi.fn>;
  stockLedgerFindMany?: ReturnType<typeof vi.fn>;
} = {}) {
  return {
    auditLog: {
      findMany: overrides.auditLogFindMany ?? vi.fn(),
    },
    stockLedger: {
      findMany: overrides.stockLedgerFindMany ?? vi.fn(),
    },
  } as unknown as Parameters<typeof createPrismaAuditRepository>[0];
}

describe("prisma audit repository", () => {
  it("queries audit logs with tenant, assigned-store scope, actor, store, and newest-first limit", async () => {
    const createdAt = new Date("2026-05-28T08:00:00.000Z");
    const auditLogFindMany = vi.fn().mockResolvedValue([
      {
        id: "audit_1",
        organizationId: "org_1",
        storeId: "store_1",
        actorMembershipId: "membership_1",
        action: "refund.recorded",
        entityType: "Order",
        entityId: "order_1",
        metadata: { reason: "Customer return" },
        createdAt,
        store: {
          name: "Orchard Central",
          code: "ORCHARD",
        },
        actor: {
          user: {
            name: "Manager User",
            email: "manager@merlion.example",
          },
        },
      },
    ]);

    const result = await createPrismaAuditRepository(
      createDb({ auditLogFindMany }),
    ).listAuditEvents({
      organizationId: "org_1",
      storeScope: {
        allStores: false,
        storeIds: ["store_1"],
      },
      limit: 10,
    });

    expect(auditLogFindMany).toHaveBeenCalledWith({
      where: {
        organizationId: "org_1",
        storeId: {
          in: ["store_1"],
        },
      },
      select: {
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
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 10,
    });
    expect(result).toEqual([
      {
        id: "audit_1",
        organizationId: "org_1",
        storeId: "store_1",
        storeName: "Orchard Central",
        storeCode: "ORCHARD",
        actorMembershipId: "membership_1",
        actorName: "Manager User",
        actorEmail: "manager@merlion.example",
        action: "refund.recorded",
        entityType: "Order",
        entityId: "order_1",
        metadata: { reason: "Customer return" },
        createdAt,
      },
    ]);
  });

  it("omits store id filter for owner all-store audit logs", async () => {
    const auditLogFindMany = vi.fn().mockResolvedValue([]);

    await createPrismaAuditRepository(createDb({ auditLogFindMany })).listAuditEvents({
      organizationId: "org_1",
      storeScope: {
        allStores: true,
        storeIds: [],
      },
      limit: 20,
    });

    expect(auditLogFindMany.mock.calls[0][0].where).not.toHaveProperty(
      "storeId",
    );
  });

  it("does not query stock movements when scoped role has no stores", async () => {
    const stockLedgerFindMany = vi.fn();

    const result = await createPrismaAuditRepository(
      createDb({ stockLedgerFindMany }),
    ).listStockMovements({
      organizationId: "org_1",
      storeScope: {
        allStores: false,
        storeIds: [],
      },
      limit: 20,
    });

    expect(result).toEqual([]);
    expect(stockLedgerFindMany).not.toHaveBeenCalled();
  });

  it("queries stock movements with tenant, store scope, sku, actor, and newest-first limit", async () => {
    const createdAt = new Date("2026-05-28T08:01:00.000Z");
    const stockLedgerFindMany = vi.fn().mockResolvedValue([
      {
        id: "ledger_1",
        organizationId: "org_1",
        storeId: "store_1",
        skuId: "sku_1",
        quantityDelta: -1,
        reason: "SALE",
        relatedOrderId: "order_1",
        actorMembershipId: "membership_1",
        note: null,
        createdAt,
        store: {
          name: "Orchard Central",
          code: "ORCHARD",
        },
        sku: {
          name: "Classic T-Shirt / Black / M",
          barcode: "9555000000012",
        },
        actor: {
          user: {
            name: "Staff User",
            email: "staff@merlion.example",
          },
        },
      },
    ]);

    const result = await createPrismaAuditRepository(
      createDb({ stockLedgerFindMany }),
    ).listStockMovements({
      organizationId: "org_1",
      storeScope: {
        allStores: false,
        storeIds: ["store_1"],
      },
      limit: 10,
    });

    expect(stockLedgerFindMany).toHaveBeenCalledWith({
      where: {
        organizationId: "org_1",
        storeId: {
          in: ["store_1"],
        },
      },
      select: {
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
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 10,
    });
    expect(result).toEqual([
      {
        id: "ledger_1",
        organizationId: "org_1",
        storeId: "store_1",
        storeName: "Orchard Central",
        storeCode: "ORCHARD",
        skuId: "sku_1",
        skuName: "Classic T-Shirt / Black / M",
        barcode: "9555000000012",
        quantityDelta: -1,
        reason: "SALE",
        relatedOrderId: "order_1",
        actorMembershipId: "membership_1",
        actorName: "Staff User",
        actorEmail: "staff@merlion.example",
        note: null,
        createdAt,
      },
    ]);
  });
});
