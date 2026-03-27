# Operations Runbook

## Update an existing deployment

Pull the latest images and restart the stack:

```bash
docker compose pull
docker compose up -d
```

If you run the self-hosted market-data override on ARM hardware, keep `PORTFOLIO_MARKET_DATA_PLATFORM=linux/amd64` unless the upstream images become multi-arch.

## Fresh start from zero

If you want an empty deployment with no previous SQLite data and no previous backup history:

```bash
docker compose down --volumes --remove-orphans
docker compose up -d
```

This removes the named Docker volumes used by the app stack.

## Health checks after deploy

Minimum verification:

```bash
curl -sSf http://127.0.0.1:18082/v1/health
curl -s http://127.0.0.1:18082/v1/readiness
curl -sSf http://127.0.0.1:4174/api/v1/meta
```

When the app uses market-data integrations, degraded or stale readiness is acceptable if the upstreams are reachable but partial coverage exists.

## Backup and restore

- Scheduled JSON backups remain the first recovery path.
- Canonical export/import remains available for portability and migrations.
- `REPLACE` restore/import is destructive and should be treated as a maintenance operation.

For a safer restore workflow:

1. Download or export the current state first.
2. Run the restore/import.
3. Verify `overview`, `holdings`, `accounts`, and `transactions`.

## Market-data behavior

The app now persists last-known-good market-data snapshots for quotes, history, benchmarks, and inflation series.

Operationally this means:

- temporary upstream failures can fall back to cached values
- fallback values are surfaced as `STALE` or degraded coverage, not silently treated as fresh
- read-model cache invalidation also reacts to market-data snapshot updates

## Auth guardrails

If password auth is enabled:

- use a real `PORTFOLIO_AUTH_SESSION_SECRET`
- keep the session secret distinct from the password
- use a valid cookie name with no spaces or separators
- prefer `PORTFOLIO_AUTH_SECURE_COOKIE=true` behind HTTPS
