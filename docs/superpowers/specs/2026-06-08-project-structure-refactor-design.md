# Project Structure Refactor Design

## Goal

Restructure MerchFlow so the codebase is easier to explain, navigate, test, and maintain without changing business behavior.

## Chosen Approach

Use a feature-first frontend and module-first backend:

- `src/app` remains the Next.js route shell.
- `src/features` owns frontend feature UI, hooks, action adapters, local models, and frontend-facing tests.
- `src/server/modules` owns backend business modules such as payments, orders, inventory, refunds, returns, reports, audit, authz, and catalog.
- `src/server/demo` stays as the portfolio/application orchestration layer.
- `src/domain` keeps framework-independent calculations.

This is intentionally lighter than strict Clean Architecture. It keeps the interview story clear while avoiding unnecessary ceremony.

## Refactor Rules

- Do not change Prisma schema.
- Do not change business rules.
- Do not rename exported Server Actions from `src/app/actions.ts`.
- Preserve existing dirty user changes.
- Move tests with the module or feature they validate.
- Split large components only where it removes meaningful state/rendering complexity.

## Target Frontend Shape

```text
src/features/
  pos/
    components/
    actions/
    model/
    __tests__/
  control-center/
    components/
    actions/
    __tests__/
  operations/
    components/
    actions/
    model/
    __tests__/
  audit/
    components/
    actions/
    __tests__/
  shared/
    components/
    formatters/
```

## Target Backend Shape

```text
src/server/
  modules/
    audit/
    authz/
    catalog/
    inventory/
    orders/
    payments/
    refunds/
    reports/
    returns/
  demo/
```

## Validation

Run unit tests, Prisma validation, lint, build, and browser smoke tests after migration.
