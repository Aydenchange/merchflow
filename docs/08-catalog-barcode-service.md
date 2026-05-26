# Catalog Barcode Service Design

## Purpose

This document defines the first catalog service boundary for MerchFlow.

The POS sale flow starts with a barcode. The system must resolve that barcode to an active SKU inside the current organization and selected store context.

## Why This Layer Exists

The UI should not directly query SKU tables.

Instead, the POS flow should call a service that:

- checks whether the actor can create a sale for the selected store
- looks up the SKU by organization and barcode
- rejects archived or missing SKUs
- returns current store inventory for the SKU

Catalog management also goes through a service so owner/manager permissions are enforced before product and SKU records are created.

## V1 Rules

- Barcode is unique within an organization.
- Active SKUs can be used in new sales.
- Archived SKUs remain available for historical records but cannot be scanned into new sales.
- Staff can scan SKUs for assigned stores.
- Staff cannot create or manage catalog records.
- Owner and Manager can create catalog records.

## Interview Talking Points

- "I scoped barcode lookup by organization because different merchants may use the same manufacturer barcode."
- "I made the POS barcode lookup enforce store access on the server, not only in the UI."
- "I kept archived SKUs queryable for history but blocked them from new sales."
- "I returned inventory balance with the barcode lookup because POS needs to warn about stock before payment."
