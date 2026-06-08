export type CatalogStatus = "ACTIVE" | "ARCHIVED";

export type CreateProductWithSkuInput = {
  productName: string;
  skuName: string;
  barcode: string;
  priceAmount: number;
  costAmount?: number;
};

export type CreatedProductWithSku = {
  productId: string;
  skuId: string;
  organizationId: string;
  skuBarcode: string;
};

export type SkuLookupRecord = {
  id: string;
  organizationId: string;
  productId: string;
  name: string;
  barcode: string;
  priceAmount: number;
  status: CatalogStatus;
  inventoryBalance: {
    storeId: string;
    quantityOnHand: number;
    lowStockThreshold: number;
  } | null;
};

export type PosSkuLookupResult = {
  skuId: string;
  productId: string;
  name: string;
  barcode: string;
  priceAmount: number;
  quantityOnHand: number;
  lowStockThreshold: number;
};
