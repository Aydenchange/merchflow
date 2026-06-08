import { describe, expect, it } from "vitest";
import type {
  AuthContextRepository,
  MembershipRecord,
} from "@/server/modules/authz/context-loader";
import type { AuditRepository, AuditTrailQuery } from "@/server/modules/audit/service";
import { loadDemoAuditTrail } from "../audit";

function membershipRecord(
  overrides: Partial<MembershipRecord> = {},
): MembershipRecord {
  return {
    userId: "user_owner",
    membershipId: "membership_owner",
    organizationId: "org_merchflow_demo",
    role: "OWNER",
    status: "ACTIVE",
    storeAssignments: [],
    ...overrides,
  };
}

function authRepository(record: MembershipRecord): AuthContextRepository {
  return {
    async findMembershipByUserId() {
      return record;
    },
  };
}

function auditRepository(calls: {
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
          storeId: "store_orchard",
          storeName: "Orchard Central",
          storeCode: "ORCHARD",
          actorMembershipId: "membership_owner",
          actorName: "Owner User",
          actorEmail: "owner@merlion.example",
          action: "order.fulfilled",
          entityType: "Order",
          entityId: "order_1",
          metadata: { fulfilledAt: "2026-05-28T08:00:00.000Z" },
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
          storeId: "store_orchard",
          storeName: "Orchard Central",
          storeCode: "ORCHARD",
          skuId: "sku_1",
          skuName: "Classic T-Shirt / Black / M",
          barcode: "9555000000012",
          quantityDelta: -1,
          reason: "SALE",
          relatedOrderId: "order_1",
          actorMembershipId: "membership_staff",
          actorName: "Staff User",
          actorEmail: "staff@merlion.example",
          note: null,
          createdAt: new Date("2026-05-28T08:01:00.000Z"),
        },
      ];
    },
  };
}

describe("loadDemoAuditTrail", () => {
  it("loads manager audit history and serializes dates plus metadata", async () => {
    const calls = {
      audit: [] as AuditTrailQuery[],
      stock: [] as AuditTrailQuery[],
    };

    const result = await loadDemoAuditTrail(
      {
        role: "manager",
        storeIds: ["store_orchard"],
        limit: 10,
      },
      {
        authRepository: authRepository(
          membershipRecord({
            userId: "user_manager",
            membershipId: "membership_manager",
            role: "MANAGER",
            storeAssignments: [{ storeId: "store_orchard" }],
          }),
        ),
        auditRepository: auditRepository(calls),
      },
    );

    expect(calls.audit[0]).toEqual({
      organizationId: "org_merchflow_demo",
      storeScope: {
        allStores: false,
        storeIds: ["store_orchard"],
      },
      limit: 10,
    });
    expect(result).toEqual({
      ok: true,
      data: {
        role: "manager",
        organizationId: "org_merchflow_demo",
        storeScope: {
          allStores: false,
          storeIds: ["store_orchard"],
        },
        limit: 10,
        auditEvents: [
          {
            id: "audit_1",
            organizationId: "org_merchflow_demo",
            storeId: "store_orchard",
            storeName: "Orchard Central",
            storeCode: "ORCHARD",
            actorMembershipId: "membership_owner",
            actorName: "Owner User",
            actorEmail: "owner@merlion.example",
            action: "order.fulfilled",
            entityType: "Order",
            entityId: "order_1",
            metadataText: "{\"fulfilledAt\":\"2026-05-28T08:00:00.000Z\"}",
            createdAt: "2026-05-28T08:00:00.000Z",
          },
        ],
        stockMovements: [
          {
            id: "ledger_1",
            organizationId: "org_merchflow_demo",
            storeId: "store_orchard",
            storeName: "Orchard Central",
            storeCode: "ORCHARD",
            skuId: "sku_1",
            skuName: "Classic T-Shirt / Black / M",
            barcode: "9555000000012",
            quantityDelta: -1,
            reason: "SALE",
            relatedOrderId: "order_1",
            actorMembershipId: "membership_staff",
            actorName: "Staff User",
            actorEmail: "staff@merlion.example",
            note: null,
            createdAt: "2026-05-28T08:01:00.000Z",
          },
        ],
      },
    });
  });

  it("returns staff denial as a UI-safe error", async () => {
    const result = await loadDemoAuditTrail(
      {
        role: "staff",
      },
      {
        authRepository: authRepository(
          membershipRecord({
            userId: "user_staff",
            membershipId: "membership_staff",
            role: "STAFF",
            storeAssignments: [{ storeId: "store_orchard" }],
          }),
        ),
        auditRepository: auditRepository({ audit: [], stock: [] }),
      },
    );

    expect(result).toEqual({
      ok: false,
      message: "Role cannot view audit trail",
    });
  });
});
