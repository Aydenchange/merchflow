# Auth Context Loading Design

## Purpose

Authorization policy needs a stable `AuthContext`.

Authentication provider code identifies the user. Auth context loading converts that user id into the business authorization shape used by MerchFlow:

- organization id
- membership id
- role
- membership status
- assigned store ids

## Why This Layer Exists

The app should not scatter membership queries across pages, Server Actions, and Route Handlers.

Instead, request handlers should load one `AuthContext` and pass it into policy checks such as:

- `assertCanCreateSale`
- `assertCanAdjustStock`
- `assertCanManageCatalog`
- `getAccessibleStoreScope`

This keeps business authorization independent from the login provider.

## V1 Rules

- A user must have exactly one membership.
- `DISABLED` and `INVITED` memberships can be loaded but are denied by policy.
- Owner store access is implicit, so owner contexts use an empty `assignedStoreIds` array.
- Manager and staff store access comes from `StoreAssignment`.
- The loader throws `AuthContextNotFoundError` when no membership exists for the user.

## Interview Talking Points

- "I separated login identity from business authorization context."
- "I load authorization context once and pass it into policy functions instead of repeating role queries in every action."
- "I keep disabled membership loadable so policy can produce a consistent denial path."
- "Owner access is represented as role-based all-store access, not by inserting store assignment rows for every store."
