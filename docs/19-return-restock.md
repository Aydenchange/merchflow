# 19. Return Restock Workflow

## Why

Refunding a customer is not the same as putting an item back on the shelf.

In a real retail workflow, a refunded item may be:

- Returned unopened and ready to sell.
- Damaged and removed from sellable stock.
- Missing because the refund was goodwill or remote customer support handled it.
- Returned later than the refund event.

So V1 intentionally keeps refund recording and return restock as separate operations.

## What

This phase adds a Return restock workflow in the Control Center:

- Only refunded orders are eligible.
- Each SKU shows the original sold quantity, already restocked quantity, and remaining restockable quantity.
- Manager/owner users can restock returned items after inspection.
- Staff users are denied by the server because restock changes inventory.
- Each restock creates `RETURN_RESTOCK` stock ledger rows and a `return.restocked` audit log.

## How

The domain service is `src/server/returns/service.ts`.

It enforces:

- Active membership.
- Manager/owner stock permission through the same policy as stock adjustment.
- Refunded order status.
- Non-empty inspection note.
- Positive integer item quantities.
- No SKU outside the original order.
- No over-restocking beyond the original sold quantity minus previous return-restock ledgers.

The Prisma repository updates inventory and writes stock ledgers in one transaction. This is important because a restock without a ledger would be unexplained inventory, and a ledger without a balance update would be operationally misleading.

## Interview Talking Points

- I modeled refund and restock as two separate events because money movement and physical inventory movement happen at different times and have different failure modes.
- I calculate restockable quantity from original order items minus existing `RETURN_RESTOCK` ledgers, so repeated clicks or partial returns cannot inflate inventory.
- I reuse stock-adjustment authorization because return restock changes sellable stock.
- The stock ledger is the source of truth for why inventory changed; the audit log explains the business action that triggered it.
- The UI only displays candidates and submits commands. The server still validates every quantity and permission.

