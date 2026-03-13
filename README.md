# Portfolio

Portfolio is a self-hosted portfolio tracker for long-term investors.

## Chosen stack

- Frontend: React 19, TypeScript, Vite, Vitest
- Backend: Kotlin 2.3, Ktor 3, Koin, JUnit
- Database target: PostgreSQL
- Deployment target: Docker Compose

## Why this stack

- React is the pragmatic choice for a web-first product with dense tables and charts.
- Kotlin/Ktor fits the existing ecosystem around `stock-analyst` and `edo-calculator`.
- PostgreSQL is a good fit for transaction history, snapshots, and analytical queries.

## Project structure

```text
portfolio/
├── AGENTS.md
├── docs/
├── apps/
│   ├── api/
│   └── web/
└── README.md
```

## Planned product scope

- accounts, instruments, and transactions
- holdings and allocation views
- performance metrics including MWRR and real return
- daily history rebuilt from transactions and market data
- ETF pricing via `stock-analyst`
- EDO valuation and inflation via `edo-calculator`

See [docs/architecture.md](/Users/bob/stock/portfolio/docs/architecture.md) for the current architecture sketch.
