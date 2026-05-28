# 18. Audit History

## Why

After adding fulfillment, refunds, and manual stock adjustments, the next production question is: "Who changed this, when, and why?"

This is not only for debugging. In retail systems, auditability helps with:

- Explaining stock discrepancies after cycle counts.
- Investigating suspicious refunds or repeated manual corrections.
- Separating system events from human operations.
- Giving managers confidence before they trust automation.

## What

This phase adds a read-only Audit tab with two timelines:

- Audit log: order fulfillment, refund recording, and other high-risk domain events.
- Stock movements: sales, manual adjustments, and future return-restock movements.

Each row includes store, actor, action/reason, entity, timestamp, and metadata or note.

## How

The implementation uses a dedicated audit read service:

- `src/server/audit/service.ts` resolves role and store scope.
- `src/server/audit/prisma-repository.ts` queries `AuditLog` and `StockLedger`.
- `src/server/demo/audit.ts` serializes the read model for the UI.
- `src/app/audit-trail.tsx` renders the top-level Audit tab.

Staff users are denied audit access. Owners can see all stores by default. Managers are scoped to assigned stores, with explicit store filters validated server-side.

## Interview Talking Points

- I added auditability after high-risk mutations because production systems need explainability, not only successful state changes.
- Audit logs and stock ledgers answer different questions: audit logs explain business actions; stock ledgers explain inventory quantity changes.
- The service layer owns role and store-scope rules, so a UI bug cannot expand audit visibility.
- The repository always filters by `organizationId` first to preserve tenant isolation.
- The UI is read-only and does not revalidate the route because it does not mutate state.

