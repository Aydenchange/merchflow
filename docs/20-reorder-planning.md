# Reorder Planning

This slice adds a read-only reorder plan to the Operations dashboard.

The goal is not to build purchase orders in V1. Purchase orders introduce supplier catalogs, approvals, receiving, partial shipments, and accounting workflows. MerchFlow V1 only needs to help an owner or manager decide which store-SKU rows need attention today.

## V1 Rules

- Owners can view reorder suggestions across all stores or selected stores.
- Managers can view reorder suggestions only for assigned stores.
- Staff cannot view reorder suggestions.
- Inactive stores and inactive SKUs are excluded.
- Rows are generated from active inventory balances where `quantityOnHand <= lowStockThreshold`.
- Target quantity is `lowStockThreshold * 2`.
- Suggested reorder quantity is `targetQuantity - quantityOnHand`.
- Urgency is derived from current stock:
  - `OUT_OF_STOCK` when quantity is zero.
  - `CRITICAL` when quantity is at or below half of the threshold.
  - `LOW` for the remaining low-stock rows.

## Why This Is Production-shaped

Low-stock reporting tells the operator what is wrong. Reorder planning turns that signal into a suggested action while still keeping the workflow auditable and simple.

The calculation intentionally stays deterministic and explainable. A manager can look at the threshold, current stock, target stock, and suggested reorder quantity and understand the result without trusting a black-box forecast.

## Interview Talking Points

- "I kept reorder planning read-only in V1 because purchase orders are a separate operational workflow with supplier and receiving state."
- "I reused report authorization so managers cannot infer stock needs for stores they do not run."
- "I made the target stock policy explicit instead of hiding it in UI copy, which keeps it testable."
