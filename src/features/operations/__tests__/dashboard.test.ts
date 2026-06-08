import { describe, expect, it } from "vitest";
import type { DemoContextView } from "@/server/demo/workbench";
import {
  buildOperationsStoreIds,
  getDefaultReportRange,
  getReportRangeForPreset,
  type StoreScopeSelection,
} from "../model/dashboard";

function context(role: DemoContextView["role"]): DemoContextView {
  return {
    role,
    demoBarcode: "9555000000012",
    user: {
      id: `user_${role}`,
      email: `${role}@merlion.example`,
      name: "Demo User",
      organizationRole:
        role === "owner" ? "OWNER" : role === "manager" ? "MANAGER" : "STAFF",
    },
    organization: {
      id: "org_merchflow_demo",
      name: "Merlion Retail Group",
      country: "SG",
      currency: "SGD",
    },
    auth: {
      membershipId: `membership_${role}`,
      organizationId: "org_merchflow_demo",
      organizationRole:
        role === "owner" ? "OWNER" : role === "manager" ? "MANAGER" : "STAFF",
      assignedStoreIds: role === "owner" ? [] : ["store_orchard"],
    },
    stores: [
      {
        id: "store_klcc",
        name: "KLCC Pop-up",
        code: "KLCC",
        address: "Kuala Lumpur City Centre, Malaysia",
      },
      {
        id: "store_orchard",
        name: "Orchard Central",
        code: "ORCHARD",
        address: "181 Orchard Road, Singapore",
      },
    ],
    selectedStoreId: "store_klcc",
  };
}

describe("operations dashboard model", () => {
  it("defaults to the last 30 days ending on the supplied day", () => {
    expect(getDefaultReportRange(new Date("2026-05-28T12:00:00.000Z"))).toEqual({
      dateFrom: "2026-04-29",
      dateTo: "2026-05-28",
    });
  });

  it("calculates last 7 day report range", () => {
    expect(
      getReportRangeForPreset("7d", new Date("2026-05-28T12:00:00.000Z")),
    ).toEqual({
      dateFrom: "2026-05-22",
      dateTo: "2026-05-28",
    });
  });

  it("omits storeIds for owner all-store reports", () => {
    const selection: StoreScopeSelection = {
      kind: "all",
    };

    expect(buildOperationsStoreIds(context("owner"), selection)).toBeUndefined();
  });

  it("uses selected store id for single-store reports", () => {
    const selection: StoreScopeSelection = {
      kind: "store",
      storeId: "store_orchard",
    };

    expect(buildOperationsStoreIds(context("owner"), selection)).toEqual([
      "store_orchard",
    ]);
  });

  it("falls back to visible store ids when non-owner selects all", () => {
    const selection: StoreScopeSelection = {
      kind: "all",
    };

    expect(buildOperationsStoreIds(context("manager"), selection)).toEqual([
      "store_klcc",
      "store_orchard",
    ]);
  });
});
