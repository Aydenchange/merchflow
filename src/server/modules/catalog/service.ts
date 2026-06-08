import {
  assertCanCreateSale,
  assertCanManageCatalog,
} from "../authz/policy";
import type { AuthContext } from "../authz/types";
import { ArchivedSkuError, SkuNotFoundError } from "./errors";
import type {
  CreatedProductWithSku,
  CreateProductWithSkuInput,
  PosSkuLookupResult,
  SkuLookupRecord,
} from "./types";

export type CatalogRepository = {
  createProductWithSku(
    input: CreateProductWithSkuInput & { organizationId: string },
  ): Promise<CreatedProductWithSku>;
  findSkuByBarcodeForStore(input: {
    organizationId: string;
    storeId: string;
    barcode: string;
  }): Promise<SkuLookupRecord | null>;
};

export type { SkuLookupRecord } from "./types";

export async function createProductWithSku(
  context: AuthContext,
  input: CreateProductWithSkuInput,
  repository: CatalogRepository,
) {
  assertCanManageCatalog(context);

  return repository.createProductWithSku({
    ...input,
    organizationId: context.organizationId,
  });
}

export async function lookupSkuForSaleByBarcode(
  context: AuthContext,
  input: { storeId: string; barcode: string },
  repository: CatalogRepository,
): Promise<PosSkuLookupResult> {
  assertCanCreateSale(context, input.storeId);

  const sku = await repository.findSkuByBarcodeForStore({
    organizationId: context.organizationId,
    storeId: input.storeId,
    barcode: input.barcode,
  });

  if (!sku) {
    throw new SkuNotFoundError(input.barcode);
  }

  if (sku.status !== "ACTIVE") {
    throw new ArchivedSkuError(input.barcode);
  }

  return {
    skuId: sku.id,
    productId: sku.productId,
    name: sku.name,
    barcode: sku.barcode,
    priceAmount: sku.priceAmount,
    quantityOnHand: sku.inventoryBalance?.quantityOnHand ?? 0,
    lowStockThreshold: sku.inventoryBalance?.lowStockThreshold ?? 0,
  };
}
