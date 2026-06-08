import { describe, expect, it } from "vitest";
import type { AuthContext } from "@/server/modules/authz/types";
import { ArchivedSkuError, SkuNotFoundError } from "../errors";
import {
  createProductWithSku,
  lookupSkuForSaleByBarcode,
  type CatalogRepository,
  type SkuLookupRecord,
} from "../service";

function authContext(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    userId: "user_1",
    membershipId: "membership_1",
    organizationId: "org_1",
    role: "STAFF",
    status: "ACTIVE",
    assignedStoreIds: ["store_1"],
    ...overrides,
  };
}

function skuRecord(overrides: Partial<SkuLookupRecord> = {}): SkuLookupRecord {
  return {
    id: "sku_1",
    organizationId: "org_1",
    productId: "product_1",
    name: "Classic T-Shirt / Black / M",
    barcode: "9555000000012",
    priceAmount: 1299,
    status: "ACTIVE",
    inventoryBalance: {
      storeId: "store_1",
      quantityOnHand: 24,
      lowStockThreshold: 5,
    },
    ...overrides,
  };
}

function repository(
  overrides: Partial<CatalogRepository> = {},
): CatalogRepository {
  return {
    async createProductWithSku(input) {
      return {
        productId: "product_created",
        skuId: "sku_created",
        organizationId: input.organizationId,
        skuBarcode: input.barcode,
      };
    },
    async findSkuByBarcodeForStore() {
      return skuRecord();
    },
    ...overrides,
  };
}

describe("catalog service", () => {
  it("allows manager to create product with sku", async () => {
    await expect(
      createProductWithSku(
        authContext({ role: "MANAGER" }),
        {
          productName: "Classic T-Shirt",
          skuName: "Classic T-Shirt / Black / M",
          barcode: "9555000000012",
          priceAmount: 1299,
          costAmount: 600,
        },
        repository(),
      ),
    ).resolves.toEqual({
      productId: "product_created",
      skuId: "sku_created",
      organizationId: "org_1",
      skuBarcode: "9555000000012",
    });
  });

  it("denies staff catalog creation", async () => {
    await expect(
      createProductWithSku(
        authContext({ role: "STAFF" }),
        {
          productName: "Classic T-Shirt",
          skuName: "Classic T-Shirt / Black / M",
          barcode: "9555000000012",
          priceAmount: 1299,
        },
        repository(),
      ),
    ).rejects.toThrow("Role cannot manage catalog");
  });

  it("looks up active sku by barcode for assigned store", async () => {
    await expect(
      lookupSkuForSaleByBarcode(
        authContext({ role: "STAFF", assignedStoreIds: ["store_1"] }),
        { storeId: "store_1", barcode: "9555000000012" },
        repository(),
      ),
    ).resolves.toEqual({
      skuId: "sku_1",
      productId: "product_1",
      name: "Classic T-Shirt / Black / M",
      barcode: "9555000000012",
      priceAmount: 1299,
      quantityOnHand: 24,
      lowStockThreshold: 5,
    });
  });

  it("denies barcode lookup for unassigned store", async () => {
    await expect(
      lookupSkuForSaleByBarcode(
        authContext({ role: "STAFF", assignedStoreIds: ["store_1"] }),
        { storeId: "store_2", barcode: "9555000000012" },
        repository(),
      ),
    ).rejects.toThrow("Store access denied");
  });

  it("throws when sku barcode does not exist", async () => {
    await expect(
      lookupSkuForSaleByBarcode(
        authContext({ role: "STAFF", assignedStoreIds: ["store_1"] }),
        { storeId: "store_1", barcode: "missing" },
        repository({
          async findSkuByBarcodeForStore() {
            return null;
          },
        }),
      ),
    ).rejects.toThrow(SkuNotFoundError);
  });

  it("throws when sku is archived", async () => {
    await expect(
      lookupSkuForSaleByBarcode(
        authContext({ role: "STAFF", assignedStoreIds: ["store_1"] }),
        { storeId: "store_1", barcode: "9555000000012" },
        repository({
          async findSkuByBarcodeForStore() {
            return skuRecord({ status: "ARCHIVED" });
          },
        }),
      ),
    ).rejects.toThrow(ArchivedSkuError);
  });
});
