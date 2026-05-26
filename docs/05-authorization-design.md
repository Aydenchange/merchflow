# Authorization Design

## Purpose

This document defines MerchFlow V1 authorization rules.

Authentication answers: "Who is this user?"

Authorization answers: "What is this user allowed to do?"

V1 implements authorization policy before integrating a specific auth provider so that business permissions are testable without UI, cookies, or external services.

## V1 Assumptions

- A user belongs to exactly one organization.
- A user has one organization membership.
- Membership has role and status.
- Owners can access all stores in their organization.
- Managers and staff can access only assigned stores.
- Server-side authorization is required even when the UI hides controls.

## Roles

### Owner

Can:

- Operate all stores.
- Manage catalog.
- Adjust stock in all stores.
- Create sales in all stores.
- View organization-level reports.
- Manage staff.

### Manager

Can:

- Operate assigned stores.
- Manage catalog in V1.
- Adjust stock in assigned stores.
- Create sales in assigned stores.
- View assigned-store reports.

### Staff

Can:

- Create sales in assigned stores.
- View assigned-store orders needed for counter work.
- Fulfill paid orders in assigned stores.

Cannot:

- Adjust stock manually.
- Manage catalog.
- View organization-wide reports.
- Manage staff.

## Membership Status

Only `ACTIVE` membership can perform actions.

`INVITED` and `DISABLED` memberships are denied by default.

## Store Access

Owner store access is implicit.

Manager and staff store access is explicit through assigned store ids.

This matches the retail model:

- A store manager may manage two branches.
- A counter staff member may work in one branch.
- The owner can see and operate the whole merchant organization.

## Why Not Middleware-only Authorization

Middleware or proxy checks can protect routes, but they must not be the only authorization layer.

Sensitive actions such as creating orders, adjusting stock, refunding payments, and updating catalog records must verify authorization in the server-side action or service that performs the mutation.

## Interview Talking Points

- "I separated authentication from authorization so provider choice does not leak into business policy."
- "I used explicit store assignments for managers and staff because role alone does not tell which branch they can operate."
- "I made inactive memberships deny by default."
- "I do not rely on hidden UI controls as an authorization boundary."
