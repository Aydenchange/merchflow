-- CreateEnum
CREATE TYPE "OrganizationRole" AS ENUM ('OWNER', 'MANAGER', 'STAFF');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'INVITED', 'DISABLED');

-- CreateEnum
CREATE TYPE "StoreStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "CatalogStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING_PAYMENT', 'PAID', 'FULFILLED', 'CANCELLED', 'PAYMENT_FAILED', 'REFUNDED', 'PAYMENT_REQUIRES_REVIEW');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'REQUIRES_REVIEW');

-- CreateEnum
CREATE TYPE "StockLedgerReason" AS ENUM ('SALE', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'RETURN_RESTOCK');

-- CreateEnum
CREATE TYPE "PaymentEventProcessingStatus" AS ENUM ('PROCESSED', 'FAILED_REVIEW');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_memberships" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "OrganizationRole" NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stores" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT,
    "status" "StoreStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_assignments" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "store_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "CatalogStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skus" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "priceAmount" INTEGER NOT NULL,
    "costAmount" INTEGER,
    "status" "CatalogStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_balances" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "quantityOnHand" INTEGER NOT NULL DEFAULT 0,
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_ledgers" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "quantityDelta" INTEGER NOT NULL,
    "reason" "StockLedgerReason" NOT NULL,
    "relatedOrderId" TEXT,
    "actorMembershipId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_ledgers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "customerId" TEXT,
    "createdByMembershipId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "subtotalAmount" INTEGER NOT NULL,
    "taxAmount" INTEGER NOT NULL DEFAULT 0,
    "totalAmount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3),
    "fulfilledAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "skuNameSnapshot" TEXT NOT NULL,
    "barcodeSnapshot" TEXT NOT NULL,
    "unitPriceAmount" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "lineTotalAmount" INTEGER NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerPaymentId" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_events" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3),
    "processingStatus" "PaymentEventProcessingStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "storeId" TEXT,
    "actorMembershipId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "organization_memberships_userId_key" ON "organization_memberships"("userId");

-- CreateIndex
CREATE INDEX "organization_memberships_organizationId_idx" ON "organization_memberships"("organizationId");

-- CreateIndex
CREATE INDEX "organization_memberships_organizationId_role_idx" ON "organization_memberships"("organizationId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "organization_memberships_organizationId_userId_key" ON "organization_memberships"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "stores_organizationId_status_idx" ON "stores"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "stores_organizationId_code_key" ON "stores"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "stores_id_organizationId_key" ON "stores"("id", "organizationId");

-- CreateIndex
CREATE INDEX "store_assignments_organizationId_membershipId_idx" ON "store_assignments"("organizationId", "membershipId");

-- CreateIndex
CREATE INDEX "store_assignments_organizationId_storeId_idx" ON "store_assignments"("organizationId", "storeId");

-- CreateIndex
CREATE UNIQUE INDEX "store_assignments_membershipId_storeId_key" ON "store_assignments"("membershipId", "storeId");

-- CreateIndex
CREATE INDEX "products_organizationId_status_idx" ON "products"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "products_id_organizationId_key" ON "products"("id", "organizationId");

-- CreateIndex
CREATE INDEX "skus_organizationId_productId_idx" ON "skus"("organizationId", "productId");

-- CreateIndex
CREATE INDEX "skus_organizationId_status_idx" ON "skus"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "skus_organizationId_barcode_key" ON "skus"("organizationId", "barcode");

-- CreateIndex
CREATE UNIQUE INDEX "skus_id_organizationId_key" ON "skus"("id", "organizationId");

-- CreateIndex
CREATE INDEX "inventory_balances_organizationId_storeId_idx" ON "inventory_balances"("organizationId", "storeId");

-- CreateIndex
CREATE INDEX "inventory_balances_organizationId_skuId_idx" ON "inventory_balances"("organizationId", "skuId");

-- CreateIndex
CREATE INDEX "inventory_balances_organizationId_storeId_quantityOnHand_idx" ON "inventory_balances"("organizationId", "storeId", "quantityOnHand");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_balances_organizationId_storeId_skuId_key" ON "inventory_balances"("organizationId", "storeId", "skuId");

-- CreateIndex
CREATE INDEX "stock_ledgers_organizationId_storeId_skuId_createdAt_idx" ON "stock_ledgers"("organizationId", "storeId", "skuId", "createdAt");

-- CreateIndex
CREATE INDEX "stock_ledgers_organizationId_relatedOrderId_idx" ON "stock_ledgers"("organizationId", "relatedOrderId");

-- CreateIndex
CREATE INDEX "stock_ledgers_organizationId_actorMembershipId_idx" ON "stock_ledgers"("organizationId", "actorMembershipId");

-- CreateIndex
CREATE INDEX "customers_organizationId_phone_idx" ON "customers"("organizationId", "phone");

-- CreateIndex
CREATE INDEX "customers_organizationId_email_idx" ON "customers"("organizationId", "email");

-- CreateIndex
CREATE INDEX "orders_organizationId_storeId_createdAt_idx" ON "orders"("organizationId", "storeId", "createdAt");

-- CreateIndex
CREATE INDEX "orders_organizationId_status_createdAt_idx" ON "orders"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "orders_organizationId_createdByMembershipId_createdAt_idx" ON "orders"("organizationId", "createdByMembershipId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "orders_id_organizationId_key" ON "orders"("id", "organizationId");

-- CreateIndex
CREATE INDEX "order_items_organizationId_orderId_idx" ON "order_items"("organizationId", "orderId");

-- CreateIndex
CREATE INDEX "order_items_organizationId_skuId_idx" ON "order_items"("organizationId", "skuId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_orderId_key" ON "payments"("orderId");

-- CreateIndex
CREATE INDEX "payments_organizationId_status_createdAt_idx" ON "payments"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "payments_organizationId_provider_providerPaymentId_idx" ON "payments"("organizationId", "provider", "providerPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_provider_providerPaymentId_key" ON "payments"("provider", "providerPaymentId");

-- CreateIndex
CREATE INDEX "payment_events_organizationId_paymentId_createdAt_idx" ON "payment_events"("organizationId", "paymentId", "createdAt");

-- CreateIndex
CREATE INDEX "payment_events_organizationId_processingStatus_createdAt_idx" ON "payment_events"("organizationId", "processingStatus", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "payment_events_provider_providerEventId_key" ON "payment_events"("provider", "providerEventId");

-- CreateIndex
CREATE INDEX "audit_logs_organizationId_createdAt_idx" ON "audit_logs"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_organizationId_storeId_createdAt_idx" ON "audit_logs"("organizationId", "storeId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_organizationId_actorMembershipId_createdAt_idx" ON "audit_logs"("organizationId", "actorMembershipId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_organizationId_entityType_entityId_idx" ON "audit_logs"("organizationId", "entityType", "entityId");

-- AddForeignKey
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stores" ADD CONSTRAINT "stores_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_assignments" ADD CONSTRAINT "store_assignments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_assignments" ADD CONSTRAINT "store_assignments_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "organization_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_assignments" ADD CONSTRAINT "store_assignments_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skus" ADD CONSTRAINT "skus_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skus" ADD CONSTRAINT "skus_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "skus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_ledgers" ADD CONSTRAINT "stock_ledgers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_ledgers" ADD CONSTRAINT "stock_ledgers_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_ledgers" ADD CONSTRAINT "stock_ledgers_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "skus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_ledgers" ADD CONSTRAINT "stock_ledgers_relatedOrderId_fkey" FOREIGN KEY ("relatedOrderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_ledgers" ADD CONSTRAINT "stock_ledgers_actorMembershipId_fkey" FOREIGN KEY ("actorMembershipId") REFERENCES "organization_memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_createdByMembershipId_fkey" FOREIGN KEY ("createdByMembershipId") REFERENCES "organization_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "skus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorMembershipId_fkey" FOREIGN KEY ("actorMembershipId") REFERENCES "organization_memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CheckConstraint
ALTER TABLE "inventory_balances"
ADD CONSTRAINT "inventory_balances_quantity_on_hand_non_negative"
CHECK ("quantityOnHand" >= 0);

-- CheckConstraint
ALTER TABLE "inventory_balances"
ADD CONSTRAINT "inventory_balances_low_stock_threshold_non_negative"
CHECK ("lowStockThreshold" >= 0);

-- CheckConstraint
ALTER TABLE "stock_ledgers"
ADD CONSTRAINT "stock_ledgers_quantity_delta_non_zero"
CHECK ("quantityDelta" <> 0);

-- CheckConstraint
ALTER TABLE "orders"
ADD CONSTRAINT "orders_subtotal_amount_non_negative"
CHECK ("subtotalAmount" >= 0);

-- CheckConstraint
ALTER TABLE "orders"
ADD CONSTRAINT "orders_tax_amount_non_negative"
CHECK ("taxAmount" >= 0);

-- CheckConstraint
ALTER TABLE "orders"
ADD CONSTRAINT "orders_total_amount_non_negative"
CHECK ("totalAmount" >= 0);

-- CheckConstraint
ALTER TABLE "order_items"
ADD CONSTRAINT "order_items_quantity_positive"
CHECK ("quantity" > 0);

-- CheckConstraint
ALTER TABLE "order_items"
ADD CONSTRAINT "order_items_unit_price_amount_non_negative"
CHECK ("unitPriceAmount" >= 0);

-- CheckConstraint
ALTER TABLE "order_items"
ADD CONSTRAINT "order_items_line_total_amount_non_negative"
CHECK ("lineTotalAmount" >= 0);

-- CheckConstraint
ALTER TABLE "payments"
ADD CONSTRAINT "payments_amount_non_negative"
CHECK ("amount" >= 0);
