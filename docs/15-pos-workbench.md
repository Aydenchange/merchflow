# POS Workbench App Shell

## Why this phase exists

The previous phases built the production-critical backend seams for authorization, catalog lookup, POS order creation, payment success processing, stock deduction, refunds, lifecycle transitions, and reporting. A hiring interviewer still needs to see that these services can be operated as one coherent product flow.

This phase adds the first real app surface:

- a demo identity switcher for owner, manager, and staff roles;
- a store-aware POS workspace;
- barcode lookup that mirrors physical retail checkout;
- cart aggregation by repeated scans;
- pending order creation;
- simulated payment success with idempotent replay;
- payment review handling when stock is no longer sufficient.

## Product decision

Small retail stores usually do not expect staff to hand-build orders. A clerk scans a barcode, the system resolves the SKU, shows price and stock context, and increments the cart if the same item is scanned again. The UI should therefore optimize for scanner-like keyboard input rather than catalog browsing.

Manual cart editing is still useful for correcting scan quantity, so the cart supports increment, decrement, and remove actions. Product search and full catalog management are intentionally out of V1 scope.

## Engineering decisions

### Server Component shell

The root page remains a Server Component. It loads the default demo context on the server, then passes serializable data into the interactive client workbench.

This keeps database access and seed-user assumptions out of the browser bundle.

### Client workbench

The POS workbench is a Client Component because it owns barcode input, cart state, pending submit state, selected role, selected store, and payment replay controls.

The component does not talk directly to Prisma. It invokes Server Actions and renders returned domain results.

### Server Actions

Server Actions are thin adapters:

- validate and normalize UI inputs;
- load the selected demo user's auth context;
- call existing domain services;
- return expected errors as serializable values;
- revalidate `/` after mutations.

Every action still performs authorization through the domain services. The demo role switcher is not treated as a security boundary.

### Demo repository

The demo repository owns the seed-facing queries needed by the workbench:

- load demo users by stable seed IDs;
- load active stores visible to a context;
- fetch the current payment and order status after a simulated event.

This prevents UI code from knowing the Prisma schema.

## User flow

1. The user opens `/`.
2. The shell loads the owner demo context and visible stores.
3. The user chooses a role and store.
4. The clerk scans barcode `9555000000012`.
5. The app loads SKU, price, and stock for the selected store.
6. Re-scanning the same barcode increments quantity.
7. The clerk creates a pending order.
8. The app displays order ID, payment ID, amount, and stock warnings.
9. The clerk simulates payment success.
10. The app displays processed, duplicate, ignored, or requires-review result.

## Production issues represented

- Store-scoped authorization: staff can sell only from assigned stores.
- Scanner-first workflow: barcode is the operational input, not product browsing.
- Cart aggregation: repeated scans must not duplicate SKU rows incorrectly.
- Read-your-own-write UX: order/payment actions refresh the visible state.
- Stock race awareness: order creation can warn, payment success is the final stock-deduction gate.
- Idempotent webhooks: replaying the same provider event produces a duplicate result.
- Review state: paid attempts with insufficient stock move to manual review instead of silently overselling.

## V1 non-goals

- real authentication provider;
- real payment provider webhook endpoint;
- catalog CRUD UI;
- inventory adjustment UI;
- refund UI;
- reporting UI;
- receipt printing;
- multi-currency tax rules.
