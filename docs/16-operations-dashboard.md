# Operations Dashboard

## Why this phase exists

The POS workbench proves that a staff user can create a counter sale and process a provider-style payment event. A retail SaaS still needs a management surface where owners and managers can see store health after transactions happen.

This phase adds a read-only operations dashboard for:

- low-stock visibility;
- basic sales totals;
- refunded sales totals shown separately;
- top SKU performance;
- role and store-scoped report access.

## Product decision

The dashboard is intentionally small. It is not a broad analytics product. In V1 it answers two operational questions that small multi-store merchants ask every day:

1. Which store/SKU combinations need replenishment?
2. What did we sell in the selected period and store scope?

Manual stock adjustment, refund recording, fulfillment, and audit log browsing remain separate workflows. Mixing those mutations into the first dashboard would make the screen harder to reason about and harder to test.

## Engineering decisions

### Reuse report services

The dashboard uses the existing `reports` service boundary instead of querying Prisma from UI actions. This keeps authorization and store-scope rules in one place:

- owner can view all stores or selected stores;
- manager can view only assigned stores;
- staff cannot view reports.

### Demo operations orchestration

A small demo orchestration layer converts UI-friendly inputs into service calls:

- role key to seed user auth context;
- ISO date strings to `Date`;
- optional store filter to report store scope;
- report results to serializable DTOs.

Expected domain errors are returned to the UI as `{ ok: false, message }`.

### Read-only Server Action

Reports are read-only, but the UI still calls them through a Server Action so the browser never receives Prisma access or authorization internals.

The action does not call `revalidatePath` because it does not mutate data. Users can refresh the dashboard explicitly after they create new paid sales.

## User flow

1. Owner opens the app.
2. Owner switches from POS to Operations.
3. Owner chooses all stores or one visible store.
4. Owner chooses a reporting period.
5. Dashboard loads low-stock rows and sales summary.
6. Manager sees only assigned store options.
7. Staff sees an access-denied state for reports.

## Production issues represented

- Read-only data is still authorization-sensitive.
- Owner and manager report scopes differ.
- Store filters must be enforced server-side, not only hidden in the UI.
- Refunded sales are separated from gross completed sales instead of silently netted out.
- Low-stock reporting reads inventory balance while excluding inactive stores and SKUs.
- Report outputs are serializable DTOs for client rendering.

## V1 non-goals

- charting library integration;
- export to CSV;
- inventory adjustment form;
- refund form;
- fulfillment queue;
- audit log browser;
- real-time report subscriptions.
