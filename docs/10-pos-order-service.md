# POS Order Service Design

## Purpose

This document defines the first sales/order service boundary for MerchFlow.

The POS workflow starts with barcode-scanned SKUs in a cart. Submitting the cart creates an order in `PENDING_PAYMENT`, creates a payment in `PENDING`, snapshots order item data, and writes an audit log. It does not deduct inventory.

## Why This Layer Exists

Order creation is not a generic form save. It is the bridge between catalog, inventory, payment, and audit.

The service must:

- enforce store access on the server
- aggregate repeated scans of the same SKU into one order line
- reject empty carts and invalid quantities
- snapshot SKU name, barcode, and unit price at order creation time
- compute totals on the server
- warn when requested quantity exceeds current stock
- avoid stock mutation until payment succeeds

## V1 Rules

- Staff, manager, and owner can create sales in stores they can access.
- Order creation requires at least one item.
- Item quantity must be a positive integer.
- Duplicate SKU scans are aggregated before persistence.
- Archived SKUs cannot be added to new orders.
- Missing SKUs fail order creation.
- Creating an order creates a `PENDING_PAYMENT` order and a `PENDING` payment.
- Creating an order writes an audit log.
- Creating an order does not write stock ledger entries and does not update inventory balances.
- Tax is `0` in V1 until we add region-specific tax rules.

## Production Problems This Design Handles

- Historical orders stay stable when SKU names or prices change later.
- Staff cannot create an order for a store hidden by the UI but rejected by server policy.
- Repeated barcode scans behave like real counter workflows instead of creating duplicate lines.
- Current inventory can be stale, so insufficient stock at order creation is a warning, not the final enforcement point.
- Payment and audit rows are created in the same transaction as the order so partial order creation cannot leak.

## Interview Talking Points

- "I made order creation snapshot SKU fields because orders are financial records and cannot depend on mutable catalog data."
- "I aggregate duplicate scans server-side because barcode scanners often behave like keyboard input and repeated scans should increment quantity."
- "I return stock warnings but do not deduct or hard-block at order creation, because payment confirmation is the commitment point."
- "I create the payment and audit log in the same transaction as the order to avoid orphaned or unaudited sales."
