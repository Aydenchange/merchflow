# MerchFlow Product Brief

## One-line Summary

MerchFlow is a multi-store POS-style order, inventory, and payment SaaS for small retail merchants in Singapore and Malaysia.

## Target Users

MerchFlow is designed for small retail businesses with 2-5 physical stores. Typical examples include apparel shops, electronics accessory stores, lifestyle goods stores, and specialty retail chains.

The first version focuses on three operational roles:

- Owner: manages the organization, stores, staff, product catalog, inventory, payments, and reports.
- Manager: manages assigned stores, daily sales, stock adjustments, refunds, and basic reports.
- Staff: creates in-store sales, scans item barcodes, accepts payment, and marks orders as fulfilled.

## Problem

Small retail merchants often sell from multiple stores but lack reliable visibility into store-level stock. Sales may happen quickly at the counter, while stock adjustments, refunds, and staff actions need to remain traceable.

The core business problems are:

- Staff need a fast POS-style flow to create sales by scanning SKU barcodes.
- Inventory must be tracked per store and per SKU, not only at product level.
- Payment confirmation must reliably update order and inventory state.
- Repeated or delayed payment events must not double-deduct stock.
- Owners need to know who changed stock, why it changed, and which order caused it.
- Managers need low-stock visibility and simple sales reporting.

## MVP Scope

The MVP focuses on the in-store sale flow and the inventory/payment correctness around it.

Included:

- Organization, store, staff membership, and role-based access control.
- Product and SKU catalog with barcode support.
- Store-level inventory balance and stock ledger.
- POS-style new sale screen with barcode input.
- Cart-like sale builder for scanned SKUs.
- Payment intent and payment webhook simulation.
- Payment-confirmed stock deduction.
- Order lifecycle from pending payment to paid and fulfilled.
- Cancellation for unpaid orders.
- Refund recording for paid orders.
- Explicit stock adjustment for returns or corrections.
- Low-stock alert list.
- Basic sales and stock movement reports.
- Audit logs for sensitive operations.

Excluded from MVP:

- Customer-facing storefront.
- Shopee, Lazada, Shopify, or marketplace sync.
- Hardware POS integration.
- Receipt printer, cash drawer, and offline mode.
- Camera-based barcode scanning.
- Stock reservation before payment.
- Purchase orders and supplier management.
- Membership, loyalty points, and complex promotions.
- Multi-currency settlement and accounting integration.

## Core Workflow

1. A staff member selects or enters the current store context.
2. The staff member scans a SKU barcode or searches for a SKU.
3. The SKU is added to the sale cart.
4. The staff member reviews quantities, customer details, and totals.
5. The system creates an order in `PENDING_PAYMENT`.
6. The system creates a payment record in `PENDING`.
7. A payment success event is received through a webhook or local simulation.
8. The system processes the payment event idempotently.
9. Inside one transaction, the system verifies order state, verifies stock, writes stock ledger entries, updates inventory balances, marks payment as succeeded, marks order as paid, and writes audit logs.
10. The staff member fulfills the order.

## Key Product Decisions

### POS-style Order Creation

The first version uses a POS-style sale screen instead of a generic back-office order form.

Why:

Real retail staff usually scan item barcodes during checkout. Most USB and Bluetooth barcode scanners behave like keyboard input, so a web input field can support the first version without custom hardware integration.

### Deduct Stock on Payment Confirmation

Stock is deducted when payment is confirmed, not when the staff member starts building an order.

Why:

Staff-created sales may remain unpaid while the customer decides, changes items, or completes payment. Deducting stock too early can make available inventory inaccurate.

### No Stock Reservation in V1

The MVP does not reserve stock before payment.

Why:

Reservation introduces expiry jobs, release logic, and more failure modes. V1 keeps the flow focused on payment-confirmed stock correctness while leaving room for future reservation support.

### Refund Does Not Automatically Restock

Refunding an order records a financial event. It does not automatically return items to available stock.

Why:

In retail, a refunded item may not be physically returned, may be damaged, or may require inspection. Restocking is a separate inventory operation and should be explicit and auditable.

## Production Problems This Project Intentionally Covers

- Multi-tenant data boundaries.
- Store-level access control.
- Product versus SKU modeling.
- Payment webhook idempotency.
- Transactional payment and inventory updates.
- Prevention of negative stock.
- Stock ledger auditability.
- Order and payment state separation.
- Manual review for inconsistent payment/inventory outcomes.
- Query patterns for order lists, stock lists, and low-stock reports.

## Interview Positioning

This project should be described as a self-directed production-style SaaS build, not as a clone or tutorial app.

Suggested positioning:

"I built MerchFlow as a production-style multi-store retail SaaS for small merchants in Singapore and Malaysia. I focused on the parts that usually break in real systems: store-level inventory correctness, payment webhook idempotency, order state transitions, role-based access, and auditability. The first version supports a POS-style barcode sale flow because that matches how retail staff actually create orders at the counter."

