export type ReportStoreScope = {
  allStores: boolean;
  storeIds: string[];
};

export type ReportStoreFilterInput = {
  storeIds?: string[];
};

export type LowStockReportInput = ReportStoreFilterInput;

export type LowStockReportQuery = {
  organizationId: string;
  storeScope: ReportStoreScope;
};

export type LowStockItem = {
  organizationId: string;
  storeId: string;
  storeName: string;
  storeCode: string;
  skuId: string;
  skuName: string;
  barcode: string;
  quantityOnHand: number;
  lowStockThreshold: number;
};

export type SalesReportInput = ReportStoreFilterInput & {
  dateFrom: Date;
  dateTo: Date;
  topSkuLimit?: number;
};

export type SalesReportQuery = {
  organizationId: string;
  storeScope: ReportStoreScope;
  dateFrom: Date;
  dateTo: Date;
  topSkuLimit: number;
};

export type TopSkuSales = {
  skuId: string;
  skuName: string;
  barcode: string;
  quantitySold: number;
  salesAmount: number;
};

export type BasicSalesReport = {
  organizationId: string;
  dateFrom: Date;
  dateTo: Date;
  storeScope: ReportStoreScope;
  grossSalesAmount: number;
  grossOrderCount: number;
  refundedSalesAmount: number;
  refundedOrderCount: number;
  currency: string | null;
  topSkus: TopSkuSales[];
};
