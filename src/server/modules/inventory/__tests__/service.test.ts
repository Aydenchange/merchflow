import { describe, expect, it } from "vitest";
import type { AuthContext } from "@/server/modules/authz/types";
import { InsufficientStockError, InvalidStockAdjustmentError } from "../errors";
import {
  adjustStock,
  type ApplyStockAdjustmentInput,
  type InventoryRepository,
  type StockAdjustmentResult,
} from "../service";

function authContext(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    userId: "user_1",
    membershipId: "membership_1",
    organizationId: "org_1",
    role: "MANAGER",
    status: "ACTIVE",
    assignedStoreIds: ["store_1"],
    ...overrides,
  };
}

function adjustmentResult(
  overrides: Partial<StockAdjustmentResult> = {},
): StockAdjustmentResult {
  return {
    organizationId: "org_1",
    storeId: "store_1",
    skuId: "sku_1",
    quantityDelta: 5,
    quantityOnHand: 17,
    lowStockThreshold: 3,
    reason: "ADJUSTMENT_IN",
    ledgerId: "ledger_1",
    ...overrides,
  };
}

function repository(
  overrides: Partial<InventoryRepository> = {},
): InventoryRepository {
  return {
    async applyStockAdjustment(input) {
      return adjustmentResult({
        organizationId: input.organizationId,
        storeId: input.storeId,
        skuId: input.skuId,
        quantityDelta: input.quantityDelta,
        reason: input.reason,
      });
    },
    ...overrides,
  };
}

describe("inventory service", () => {
  it("allows manager to increase stock in an assigned store", async () => {
    const calls: ApplyStockAdjustmentInput[] = [];

    const result = await adjustStock(
      authContext({ role: "MANAGER", assignedStoreIds: ["store_1"] }),
      {
        storeId: "store_1",
        skuId: "sku_1",
        quantityDelta: 5,
        note: " Received supplier delivery ",
      },
      repository({
        async applyStockAdjustment(input) {
          calls.push(input);
          return adjustmentResult({
            quantityDelta: input.quantityDelta,
            reason: input.reason,
          });
        },
      }),
    );

    expect(calls).toEqual([
      {
        organizationId: "org_1",
        storeId: "store_1",
        skuId: "sku_1",
        quantityDelta: 5,
        reason: "ADJUSTMENT_IN",
        actorMembershipId: "membership_1",
        note: "Received supplier delivery",
      },
    ]);
    expect(result).toEqual(
      adjustmentResult({
        quantityDelta: 5,
        reason: "ADJUSTMENT_IN",
      }),
    );
  });

  it("derives outbound reason for negative stock adjustment", async () => {
    const calls: ApplyStockAdjustmentInput[] = [];

    await adjustStock(
      authContext({ role: "OWNER", assignedStoreIds: [] }),
      {
        storeId: "store_2",
        skuId: "sku_1",
        quantityDelta: -2,
        note: "Damaged items removed",
      },
      repository({
        async applyStockAdjustment(input) {
          calls.push(input);
          return adjustmentResult({
            storeId: input.storeId,
            quantityDelta: input.quantityDelta,
            reason: input.reason,
          });
        },
      }),
    );

    expect(calls[0]).toMatchObject({
      organizationId: "org_1",
      storeId: "store_2",
      skuId: "sku_1",
      quantityDelta: -2,
      reason: "ADJUSTMENT_OUT",
      actorMembershipId: "membership_1",
      note: "Damaged items removed",
    });
  });

  it("rejects zero quantity adjustment", async () => {
    await expect(
      adjustStock(
        authContext(),
        {
          storeId: "store_1",
          skuId: "sku_1",
          quantityDelta: 0,
          note: "No movement",
        },
        repository(),
      ),
    ).rejects.toThrow(InvalidStockAdjustmentError);
  });

  it("rejects fractional quantity adjustment", async () => {
    await expect(
      adjustStock(
        authContext(),
        {
          storeId: "store_1",
          skuId: "sku_1",
          quantityDelta: 1.5,
          note: "Fractional stock",
        },
        repository(),
      ),
    ).rejects.toThrow(InvalidStockAdjustmentError);
  });

  it("rejects blank adjustment note", async () => {
    await expect(
      adjustStock(
        authContext(),
        {
          storeId: "store_1",
          skuId: "sku_1",
          quantityDelta: 1,
          note: "   ",
        },
        repository(),
      ),
    ).rejects.toThrow(InvalidStockAdjustmentError);
  });

  it("denies staff stock adjustment", async () => {
    await expect(
      adjustStock(
        authContext({ role: "STAFF" }),
        {
          storeId: "store_1",
          skuId: "sku_1",
          quantityDelta: 1,
          note: "Correction",
        },
        repository(),
      ),
    ).rejects.toThrow("Role cannot adjust stock");
  });

  it("denies manager stock adjustment outside assigned stores", async () => {
    await expect(
      adjustStock(
        authContext({ role: "MANAGER", assignedStoreIds: ["store_1"] }),
        {
          storeId: "store_2",
          skuId: "sku_1",
          quantityDelta: 1,
          note: "Correction",
        },
        repository(),
      ),
    ).rejects.toThrow("Store access denied");
  });

  it("propagates insufficient stock from repository", async () => {
    await expect(
      adjustStock(
        authContext({ role: "OWNER", assignedStoreIds: [] }),
        {
          storeId: "store_1",
          skuId: "sku_1",
          quantityDelta: -8,
          note: "Shrinkage correction",
        },
        repository({
          async applyStockAdjustment() {
            throw new InsufficientStockError({
              storeId: "store_1",
              skuId: "sku_1",
              quantityOnHand: 3,
              quantityRequested: 8,
            });
          },
        }),
      ),
    ).rejects.toThrow(InsufficientStockError);
  });
});
