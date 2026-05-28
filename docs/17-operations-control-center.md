# 17. Operations Control Center

## Why

Small retail teams do not only need a POS screen. After a sale is paid, the store still needs back-office operations:

- Mark paid orders as fulfilled after pickup or handoff.
- Record refunds without accidentally refunding unpaid or already refunded orders.
- Adjust stock for supplier delivery, damaged goods, shrinkage, or manual stock count correction.

These are production-sensitive workflows because they mutate money, order status, and inventory. If they are implemented as simple UI buttons without server-side rules, a staff account could refund orders, an order could move from the wrong status, or stock could become negative without an audit trail.

## What

This phase adds an Operations Control Center with three workflows:

- Recent orders read model: scoped by organization and accessible stores.
- Order lifecycle action: `PAID -> FULFILLED`.
- Refund action: full refund for `PAID` or `FULFILLED` orders with a required reason.
- Stock adjustment action: positive and negative quantity deltas with required notes and stock ledger entries.

The UI is intentionally thin. It renders recent orders and inventory rows, submits commands through Server Actions, and reloads the read model after successful mutations.

## How

### Read Model

`src/server/demo/control-prisma-repository.ts` builds a read model for the control center.

The repository always applies:

- `organizationId` tenant isolation.
- Store scope from the authenticated membership.
- Active store and active SKU filters for stock adjustment options.
- Newest-first order sorting with a fixed limit.

### Write Model

The control center does not update Prisma models directly. It delegates to existing services:

- `fulfillPaidOrder` validates order status and store access.
- `recordFullRefund` validates role, order state, payment state, and refund reason.
- `adjustStock` validates role, store access, integer delta, note, and negative-stock safety.

This separation is the important production decision: the UI and Server Actions are not trusted authorization boundaries.

### Auditability

Existing repositories write audit logs or stock ledgers:

- Fulfillment writes an `order.fulfilled` audit log.
- Refund writes a `refund.recorded` audit log with reason and `restocked: false`.
- Stock adjustment writes a `StockLedger` row with actor, reason, note, and delta.

That gives the project a credible answer to "how do you debug or explain a suspicious inventory/payment change?"

## Interview Talking Points

- I separated read models from write models because the control center needs a fast, UI-shaped query, but mutations must go through domain services.
- I treated Server Actions as transport, not business logic. They only wire dependencies, revalidate after success, and return UI-safe results.
- Fulfillment is allowed for staff because it mirrors store operations. Refunds and stock adjustments are restricted to manager or owner roles.
- Refund does not automatically restock inventory in V1. In real retail systems, refund and return-restock are related but separate events because a refunded item may be damaged, missing, or not physically returned yet.
- Stock adjustment requires a note and writes a ledger entry so manual corrections are traceable.
- Tests cover role scope, tenant scope, Prisma query shape, Server Action revalidation behavior, and UI-safe error handling.

