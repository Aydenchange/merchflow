import { assertCanAdjustStock } from "../authz/policy";
import type { AuthContext } from "../authz/types";
import { InvalidStockAdjustmentError } from "./errors";
import type {
  ApplyStockAdjustmentInput,
  StockAdjustmentInput,
  StockAdjustmentReason,
  StockAdjustmentResult,
} from "./types";

export type InventoryRepository = {
  applyStockAdjustment(
    input: ApplyStockAdjustmentInput,
  ): Promise<StockAdjustmentResult>;
};

export type { ApplyStockAdjustmentInput, StockAdjustmentResult } from "./types";

function adjustmentReasonForDelta(
  quantityDelta: number,
): StockAdjustmentReason {
  return quantityDelta > 0 ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT";
}

export async function adjustStock(
  context: AuthContext,
  input: StockAdjustmentInput,
  repository: InventoryRepository,
): Promise<StockAdjustmentResult> {
  assertCanAdjustStock(context, input.storeId);

  if (!Number.isInteger(input.quantityDelta) || input.quantityDelta === 0) {
    throw new InvalidStockAdjustmentError(
      "Stock adjustment quantity must be a non-zero integer",
    );
  }

  const note = input.note.trim();

  if (note.length === 0) {
    throw new InvalidStockAdjustmentError(
      "Stock adjustment note must not be blank",
    );
  }

  return repository.applyStockAdjustment({
    organizationId: context.organizationId,
    storeId: input.storeId,
    skuId: input.skuId,
    quantityDelta: input.quantityDelta,
    reason: adjustmentReasonForDelta(input.quantityDelta),
    actorMembershipId: context.membershipId,
    note,
  });
}
