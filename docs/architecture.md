# Architecture

## System outline

```text
React SPA
  -> Portfolio API
       -> PostgreSQL
       -> stock-analyst
       -> edo-calculator
```

## Source of truth

Transactions are canonical. Daily snapshots are cacheable read models that can be rebuilt from:

- transactions
- historical prices
- historical FX rates
- historical EDO valuations

## Initial stack decisions

### Frontend

- React 19
- TypeScript
- Vite
- Custom CSS with design tokens for now
- Vitest + Testing Library

### Backend

- Kotlin 2.3
- Ktor 3
- Koin
- kotlinx.serialization
- JUnit 6

### Persistence

- PostgreSQL planned for production data
- relational schema already drafted in SQL migrations
- current write-model implementation uses in-memory repositories until PostgreSQL wiring is added

## First delivery slices

1. Tooling and runnable skeleton
2. Health endpoints and application shell
3. Domain model and schema
4. CRUD for accounts, instruments, and transactions
5. Portfolio overview and history reconstruction
