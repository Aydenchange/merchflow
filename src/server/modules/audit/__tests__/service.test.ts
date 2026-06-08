import { describe, expect, it } from "vitest";
import type { AuthContext } from "@/server/modules/authz/types";
import {
  InvalidAuditTrailInputError,
  loadAuditTrail,
  type AuditRepository,
  type AuditTrailQuery,
} from "../service";

function authContext(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    userId: "user_1",
    membershipId: "membership_1",
    organizationId: "org_1",
    role: "OWNER",
    status: "ACTIVE",
    assignedStoreIds: [],
    ...overrides,
  };
}

function repository(calls: {
  audit: AuditTrailQuery[];
  stock: AuditTrailQuery[];
}): AuditRepository {
  return {
    async listAuditEvents(input) {
      calls.audit.push(input);
      return [
        {
          id: "audit_1",
          organizationId: input.organizationId,
          storeId: "store_1",
          storeName: "Orchard Central",
          storeCode: "ORCHARD",
          actorMembershipId: "membership_1",
          actorName: "Owner User",
          actorEmail: "owner@merlion.example",
          action: "refund.recorded",
          entityType: "Order",
          entityId: "order_1",
          metadata: { reason: "Customer return" },
          createdAt: new Date("2026-05-28T08:00:00.000Z"),
        },
      ];
    },
    async listStockMovements(input) {
      calls.stock.push(input);
      return [
        {
          id: "ledger_1",
          organizationId: input.organizationId,
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
          createdAt: new Date("2026-05-28T08:01:00.000Z"),
        },
      ];
    },
  };
}

describe("audit service", () => {
  it("loads owner all-store audit and stock movement history", async () => {
    const calls = {
      audit: [] as AuditTrailQuery[],
      stock: [] as AuditTrailQuery[],
    };

    const result = await loadAuditTrail(
      authContext({ role: "OWNER", assignedStoreIds: [] }),
      {
        limit: 10,
      },
      repository(calls),
    );

    expect(calls.audit).toEqual([
      {
        organizationId: "org_1",
        storeScope: {
          allStores: true,
          storeIds: [],
        },
        limit: 10,
      },
    ]);
    expect(calls.stock).toEqual(calls.audit);
    expect(result.auditEvents).toHaveLength(1);
    expect(result.stockMovements).toHaveLength(1);
  });

  it("loads manager history scoped to assigned stores by default", async () => {
    const calls = {
      audit: [] as AuditTrailQuery[],
      stock: [] as AuditTrailQuery[],
    };

    await loadAuditTrail(
      authContext({
        role: "MANAGER",
        assignedStoreIds: ["store_1"],
      }),
      {},
      repository(calls),
    );

    expect(calls.audit[0]).toMatchObject({
      storeScope: {
        allStores: false,
        storeIds: ["store_1"],
      },
      limit: 20,
    });
  });

  it("passes explicit owner store filter to repository", async () => {
    const calls = {
      audit: [] as AuditTrailQuery[],
      stock: [] as AuditTrailQuery[],
    };

    await loadAuditTrail(
      authContext({ role: "OWNER" }),
      {
        storeIds: ["store_2"],
      },
      repository(calls),
    );

    expect(calls.audit[0].storeScope).toEqual({
      allStores: false,
      storeIds: ["store_2"],
    });
  });

  it("denies staff audit history access", async () => {
    await expect(
      loadAuditTrail(
        authContext({
          role: "STAFF",
          assignedStoreIds: ["store_1"],
        }),
        {},
        repository({ audit: [], stock: [] }),
      ),
    ).rejects.toThrow("Role cannot view audit trail");
  });

  it("rejects manager store filter outside assigned stores", async () => {
    await expect(
      loadAuditTrail(
        authContext({
          role: "MANAGER",
          assignedStoreIds: ["store_1"],
        }),
        {
          storeIds: ["store_2"],
        },
        repository({ audit: [], stock: [] }),
      ),
    ).rejects.toThrow("Store access denied");
  });

  it("rejects invalid history limit", async () => {
    await expect(
      loadAuditTrail(
        authContext(),
        {
          limit: 0,
        },
        repository({ audit: [], stock: [] }),
      ),
    ).rejects.toThrow(InvalidAuditTrailInputError);
  });
});
