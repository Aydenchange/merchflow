# Inventory Service Design

## Purpose

This document defines the first inventory service boundary for MerchFlow.

Small retail stores usually discover inventory changes through receiving stock, cycle counts, damaged goods, shrinkage, and paid sales. This slice covers manual stock adjustments. Paid-sale stock deduction will be wired into the order/payment flow later.

## Why This Layer Exists

Inventory is a production risk area because a simple CRUD update can create incorrect stock.

The service must:

- enforce that only owner/manager users can adjust stock
- restrict managers to assigned stores
- reject ambiguous adjustments such as zero quantity or blank notes
- derive ledger reason from quantity direction instead of trusting the client
- require the repository to update balance and ledger in one transaction
- prevent negative stock at the database write boundary

## V1 Rules

- Staff cannot adjust stock.
- Owner can adjust stock in any store.
- Manager can adjust stock only in assigned stores.
- Manual stock adjustment quantity must be a non-zero integer.
- Manual stock adjustment requires a human-readable note.
- Positive adjustment creates `ADJUSTMENT_IN`.
- Negative adjustment creates `ADJUSTMENT_OUT`.
- Stock balance must never go below zero.
- Every successful adjustment creates a `StockLedger` row.

## Production Problems This Design Handles

- Concurrent adjustments must not let stock drop below zero.
- The UI must not decide ledger reason because client input can be inconsistent.
- Stock changes need an audit trail for store operations and dispute resolution.
- Service tests cover authorization and validation without depending on Prisma.
- Prisma repository owns the transaction because only the adapter can make balance and ledger writes atomic.

## Interview Talking Points

- "I separated business authorization from the Prisma adapter, but kept the concurrency guard inside the transaction because service-level checks alone are stale under concurrent requests."
- "I derived stock ledger reason from the signed quantity delta so the client cannot send a negative adjustment with an inbound reason."
- "I required notes for manual adjustments because inventory changes need operational accountability."
- "I treated stock ledger as an append-only audit trail and inventory balance as the current read model."
