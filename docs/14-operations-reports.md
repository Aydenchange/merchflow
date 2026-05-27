# Operations Reports Design

## Purpose

This document defines the first read-only operations reporting boundary for MerchFlow.

The transaction flows now create orders, payments, stock ledgers, refunds, and lifecycle events. This reporting slice helps owner and manager users answer two store operations questions:

- Which active SKUs are at or below their configured low-stock threshold?
- How much paid sales volume happened in a date range, and which SKUs sold most?

## Why This Layer Exists

Reports should not bypass authorization just because they are read-only.

The service must:

- deny inactive memberships
- deny staff access to reports
- scope managers to assigned stores
- allow owners to query all stores or selected stores
- validate sales report date ranges
- exclude archived SKUs from the low-stock list
- keep refunded orders visible separately from gross completed sales

## V1 Rules

- Owner can view all-store reports or selected-store reports.
- Manager can view only assigned-store reports.
- Staff cannot view reports in V1.
- Low-stock means `lowStockThreshold > 0` and `quantityOnHand <= lowStockThreshold`.
- Low-stock results exclude inactive stores and archived SKUs.
- Sales report date range filters by `paidAt`.
- Gross sales include `PAID` and `FULFILLED` orders.
- Refunded orders are reported separately and are not hidden inside gross sales.
- Top SKUs are calculated from non-refunded completed sales.

## Production Problems This Design Handles

- Prevents a manager from reporting on another branch.
- Avoids treating default threshold `0` as a configured low-stock alert.
- Keeps refunds visible rather than silently subtracting them from completed sales.
- Uses scoped query inputs so repository code cannot accidentally query outside the tenant.

## Interview Talking Points

- "I treated reports as authorization-sensitive even though they are read-only."
- "I separated refunded totals from gross completed sales because hiding reversals makes store performance hard to audit."
- "I used paidAt for sales report date ranges because payment success is the point where the sale is committed."
- "I made low-stock threshold zero mean no alert, which avoids noisy default data."
