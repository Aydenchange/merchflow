# MerchFlow Local Database Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the MerchFlow database runnable locally with Docker, Prisma migrations, database-level check constraints, and verified seed data.

**Architecture:** Use Docker Compose to run a local PostgreSQL service that matches the existing `.env.example` connection string. Use Prisma Migrate for schema migration, then harden the generated SQL with explicit PostgreSQL `CHECK` constraints for inventory, quantities, and money amounts that Prisma schema cannot model directly.

**Tech Stack:** Docker Compose, PostgreSQL, Prisma 7, TypeScript, npm scripts.

---

## Scope

Included:

- Local PostgreSQL Docker Compose service.
- Database lifecycle npm scripts.
- Initial Prisma migration.
- Raw SQL check constraints for critical invariants.
- Seed execution against local PostgreSQL.
- Developer documentation for database setup.

Excluded:

- Production database provisioning.
- Cloud database setup.
- CI database service.
- Row-level security.
- Testcontainers.

## File Structure

- `compose.yml`: Local PostgreSQL database service.
- `.env.example`: Documents the local database URL.
- `package.json`: Adds database lifecycle scripts.
- `prisma/migrations/**/migration.sql`: Initial migration and hardening constraints.
- `docs/07-local-database-runtime.md`: Explains local database setup and why constraints exist.

## Task 1: Document Local Database Runtime

**Files:**

- Create: `docs/07-local-database-runtime.md`

- [ ] **Step 1: Create database runtime document**

Create `docs/07-local-database-runtime.md`:

```md
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
```

- [ ] **Step 2: Commit runtime document**

Run:

```powershell
git add docs/07-local-database-runtime.md
git commit -m "docs: define local database runtime"
```

Expected:

- Commit records local database operating model.

## Task 2: Add Docker Compose And Database Scripts

**Files:**

- Create: `compose.yml`
- Modify: `package.json`

- [ ] **Step 1: Create Docker Compose service**

Create `compose.yml`:

```yaml
services:
  postgres:
    image: postgres:18.2
    container_name: merchflow-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: merchflow
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - merchflow-postgres-data:/var/lib/postgresql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d merchflow"]
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  merchflow-postgres-data:
```

- [ ] **Step 2: Add database scripts**

Modify `package.json` scripts:

```json
{
  "db:up": "docker compose up -d postgres",
  "db:down": "docker compose down",
  "db:migrate": "prisma migrate dev",
  "db:reset": "prisma migrate reset --force",
  "db:studio": "prisma studio"
}
```

Keep the existing `db:seed` script.

- [ ] **Step 3: Run lint and package script check**

Run:

```powershell
npm run lint
```

Expected:

- PASS.

- [ ] **Step 4: Commit database runtime scripts**

Run:

```powershell
git add compose.yml package.json package-lock.json
git commit -m "chore: add local postgres runtime"
```

Expected:

- Commit records Docker Compose and scripts.

## Task 3: Generate Initial Migration

**Files:**

- Create: `prisma/migrations/*/migration.sql`

- [ ] **Step 1: Start database**

Run:

```powershell
npm run db:up
```

Expected:

- Docker starts `merchflow-postgres`.

- [ ] **Step 2: Wait for health**

Run:

```powershell
docker inspect --format "{{.State.Health.Status}}" merchflow-postgres
```

Expected:

- Output is `healthy`.

- [ ] **Step 3: Generate migration without applying**

Run:

```powershell
npx prisma migrate dev --name init --create-only
```

Expected:

- Prisma creates an initial migration under `prisma/migrations`.

- [ ] **Step 4: Add check constraints to migration SQL**

Append this SQL to the generated `migration.sql`:

```sql
ALTER TABLE "inventory_balances"
ADD CONSTRAINT "inventory_balances_quantity_on_hand_non_negative"
CHECK ("quantityOnHand" >= 0);

ALTER TABLE "inventory_balances"
ADD CONSTRAINT "inventory_balances_low_stock_threshold_non_negative"
CHECK ("lowStockThreshold" >= 0);

ALTER TABLE "stock_ledgers"
ADD CONSTRAINT "stock_ledgers_quantity_delta_non_zero"
CHECK ("quantityDelta" <> 0);

ALTER TABLE "orders"
ADD CONSTRAINT "orders_subtotal_amount_non_negative"
CHECK ("subtotalAmount" >= 0);

ALTER TABLE "orders"
ADD CONSTRAINT "orders_tax_amount_non_negative"
CHECK ("taxAmount" >= 0);

ALTER TABLE "orders"
ADD CONSTRAINT "orders_total_amount_non_negative"
CHECK ("totalAmount" >= 0);

ALTER TABLE "order_items"
ADD CONSTRAINT "order_items_quantity_positive"
CHECK ("quantity" > 0);

ALTER TABLE "order_items"
ADD CONSTRAINT "order_items_unit_price_amount_non_negative"
CHECK ("unitPriceAmount" >= 0);

ALTER TABLE "order_items"
ADD CONSTRAINT "order_items_line_total_amount_non_negative"
CHECK ("lineTotalAmount" >= 0);

ALTER TABLE "payments"
ADD CONSTRAINT "payments_amount_non_negative"
CHECK ("amount" >= 0);
```

- [ ] **Step 5: Apply migration**

Run:

```powershell
npm run db:migrate
```

Expected:

- Migration applies successfully.

- [ ] **Step 6: Commit migration**

Run:

```powershell
git add prisma/migrations
git commit -m "feat: add initial database migration"
```

Expected:

- Commit records schema migration and hardening constraints.

## Task 4: Seed And Verify Database

**Files:**

- No new files.

- [ ] **Step 1: Run seed**

Run:

```powershell
npm run db:seed
```

Expected:

- Seed script prints `Seeded Merlion Retail Group with owner membership membership_owner`.

- [ ] **Step 2: Verify seeded records through Prisma Studio-safe query**

Run:

```powershell
npx prisma db execute --stdin
```

Then provide:

```sql
SELECT COUNT(*) AS organizations FROM organizations;
SELECT COUNT(*) AS stores FROM stores;
SELECT COUNT(*) AS users FROM users;
SELECT COUNT(*) AS inventory_balances FROM inventory_balances;
```

Expected:

- The command executes successfully and the tables exist.

- [ ] **Step 3: Run app verification**

Run:

```powershell
npm run test
npm run prisma:validate
npm run lint
npm run build
```

Expected:

- All commands pass.

## Self-review

Spec coverage:

- Covers local PostgreSQL runtime.
- Covers migrations against real database.
- Covers seed verification.
- Adds DB-level constraints for inventory, quantity, and money invariants.

Placeholder scan:

- No placeholder markers are used.

Type consistency:

- Database table and column names match the Prisma schema's mapped table names and default quoted column names.
