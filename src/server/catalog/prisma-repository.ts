import type { PrismaClient } from "@prisma/client";
import type { CatalogRepository } from "./service";

type PrismaWithCatalogAccess = Pick<PrismaClient, "product" | "sku">;

export function createPrismaCatalogRepository(
  db: PrismaWithCatalogAccess,
): CatalogRepository {
  return {
    async createProductWithSku(input) {
      const product = await db.product.create({
        data: {
          organizationId: input.organizationId,
          name: input.productName,
          skus: {
            create: {
              organizationId: input.organizationId,
              name: input.skuName,
              barcode: input.barcode,
              priceAmount: input.priceAmount,
              costAmount: input.costAmount,
            },
          },
        },
        include: {
          skus: {
            where: {
              barcode: input.barcode,
            },
            take: 1,
          },
        },
      });

      const sku = product.skus[0];

      if (!sku) {
        throw new Error("SKU creation failed");
      }

      return {
        productId: product.id,
        skuId: sku.id,
        organizationId: product.organizationId,
        skuBarcode: sku.barcode,
      };
    },

    async findSkuByBarcodeForStore(input) {
      const sku = await db.sku.findUnique({
        where: {
          organizationId_barcode: {
            organizationId: input.organizationId,
            barcode: input.barcode,
          },
        },
        select: {
          id: true,
          organizationId: true,
          productId: true,
          name: true,
          barcode: true,
          priceAmount: true,
          status: true,
          inventoryBalances: {
            where: {
              organizationId: input.organizationId,
              storeId: input.storeId,
            },
            select: {
              storeId: true,
              quantityOnHand: true,
              lowStockThreshold: true,
            },
            take: 1,
          },
        },
      });

      if (!sku) {
        return null;
      }

      return {
        id: sku.id,
        organizationId: sku.organizationId,
        productId: sku.productId,
        name: sku.name,
        barcode: sku.barcode,
        priceAmount: sku.priceAmount,
        status: sku.status,
        inventoryBalance: sku.inventoryBalances[0] ?? null,
      };
    },
  };
}
