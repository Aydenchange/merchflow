# Local Database Runtime

## Purpose

This document explains how MerchFlow runs PostgreSQL locally and how database migrations are verified.

The project uses Prisma for schema management, but production-critical invariants still need database-level constraints.

## Why Docker Compose

Docker Compose gives each developer the same local PostgreSQL service:

- database: `merchflow`
- user: `postgres`
- password: `postgres`
- port: `5432`

This matches `.env.example`.

## Commands

Start database:

```powershell
npm run db:up
```

Stop database:

```powershell
npm run db:down
```

Run migrations:

```powershell
npm run db:migrate
```

Seed demo data:

```powershell
npm run db:seed
```

Reset local database:

```powershell
npm run db:reset
```

## Database Constraints

Prisma models relationships and indexes, but some invariants are enforced through raw SQL migration constraints:

- inventory balance cannot be negative
- low-stock threshold cannot be negative
- stock ledger quantity delta cannot be zero
- order item quantity must be positive
- money amounts cannot be negative

These constraints protect the system even if a future code path forgets validation.

## Interview Talking Points

- "I did not rely only on application validation for inventory and money invariants."
- "I added database check constraints for values that must never be invalid, such as negative inventory balance."
- "I used Docker Compose so the local database runtime is reproducible."
- "I verified the schema by actually migrating and seeding a local PostgreSQL database."
