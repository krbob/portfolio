# Operations runbook

This runbook covers both the repository's single full-stack Compose project and installations where
Stock Analyst UI, Stock Analyst, Portfolio and EDO Calculator are four independent Compose projects.
The stages and gates are the same; only orchestration differs.

## Before every rollout

1. Select one reviewed compatibility set with immutable digests for all six images.
2. Record the currently deployed digest set for rollback.
3. Confirm a recent canonical JSON backup and a separate copy outside the container volumes.
4. Render every Compose project with `docker compose config` and check for empty secrets, moving
   tags and unexpected public routes.
5. Read release notes for contract, persistence and configuration changes.

Never invent a digest, replace one with zeros or substitute `main`/`latest` in a production stack.
The candidate manifest in this repository deliberately contains null digests and is not a release.

## Repository full-stack rollout

Export all six variables listed in [Deployment compatibility](deployment-compatibility.md), then:

```bash
python3 scripts/validate-compatibility-manifest.py
scripts/rollout-full-stack.sh
```

The script pulls first, then applies these stages in one fail-closed process:

1. Stock Analyst yfinance backend.
2. Stock Analyst API and EDO Calculator.
3. Provider readiness and the required Stock Analyst `/v1` OpenAPI paths.
4. Portfolio API and its health gate.
5. Portfolio web and Stock Analyst UI.

Do not replace it with a single `docker compose up -d` during an update. Compose dependency startup
order does not protect already-running services from a mixed-version rollout.

## Four independent Compose projects

Cross-project `depends_on` has no effect. Apply the same sequence explicitly:

1. Pull and recreate `stock-analyst-backend-yfinance`; wait for its health check.
2. Pull and recreate `stock-analyst` and `edo-calculator`.
3. Require HTTP 200 from both `/readyz` endpoints.
4. Fetch Stock Analyst `/openapi/v1.json` and require `/v1/quote/{stock}` plus
   `/v1/history/{stock}`.
5. Pull and recreate `portfolio-api`; wait for `/v1/health`, then inspect `/v1/readiness`.
6. Verify overview, holdings, market-data quality and returns before recreating the two frontends.
7. Recreate `portfolio-web` and `stock-analyst-ui`, then run browser smoke.

If any gate fails, stop before the next consumer is replaced. Keep the previous compatible provider
running or restore its recorded digest; do not continue in the hope that browser refresh will repair
a contract mismatch.

## One-time volume ownership migration

Deployments created before Portfolio API switched to UID/GID `10001:10001` may require:

```bash
sh scripts/fix-volume-ownership.sh
```

Run it only for the named Portfolio data and backup volumes after reviewing the script. It is not a
general permission-repair command.

## Minimum post-deploy verification

Local reference stack:

```bash
curl -fsS http://127.0.0.1:18082/v1/health
curl -fsS http://127.0.0.1:18082/v1/readiness
curl -fsS http://127.0.0.1:4174/api/v1/meta
```

Then verify read-only product state:

- authentication still works when enabled;
- overview reports the expected account, position and valued-holding counts;
- the largest holding quantity and approximate value are plausible;
- valuation state is not silently partial and missing-FX counts are understood;
- `Portfolio -> Holdings` and `Portfolio -> Accounts` render;
- `Performance` shows expected PLN/USD/gold availability and TWR;
- changing the performance unit preserves scroll and focus;
- `Data -> Backups` shows recent completed backups;
- `System -> Diagnostics` and `System -> Market data` explain any degraded state;
- Stock Analyst handoff uses the expected theme/locale behavior.

A health check proves process availability, not financial correctness. Do not declare the rollout
complete from green container states alone.

## Import and restore workflow

For any non-trivial state change:

1. Export current canonical state or verify a recent server backup.
2. Run preview first.
3. Read blocking issues and warnings, not only the summary badge.
4. For `REPLACE`, confirm that the safety backup was created.
5. After import, verify overview, holdings, transactions, targets and import profiles.

Important semantics:

- in `MERGE`, omitted `targets` preserve current targets;
- present `targets` replace the target allocation as one set;
- omitted `importProfiles` preserve current profiles;
- present `importProfiles` merge by id and final names must remain unique;
- market-data snapshots and active alert-dispatch state are excluded from transfer JSON and survive
  both modes;
- preview and real import enforce the same business validation.

## Backup and recovery posture

- Scheduled JSON backups are the first server-side recovery path.
- Canonical export/import is the portability path between installations.
- A listed `.json` backup has been fully written and atomically published; abandoned temporary files
  are not candidates.
- Restore does not roll market-data cache or active alert-delivery state backward.

Preferred recovery sequence:

1. Preserve or export the current state if possible.
2. Copy the selected backup outside the backup volume.
3. Preview the incoming snapshot.
4. Restore/import.
5. Validate core user-facing views and data quality.
6. Check audit events for backup and restore operations.

## Permanent reset

> **Destructive operation:** the following removes both the SQLite data volume and the server-backup
> volume. It cannot be undone from those volumes.

Only after verifying an external recovery copy:

```bash
docker compose down --volumes --remove-orphans
docker compose --profile app up -d
```

This is a fresh installation procedure, not troubleshooting or a normal update.

## Market-data incidents

The application can serve healthy live data, explicit stale fallback or partial/unavailable data.
`STALE` is acceptable temporarily when its upstream cause is understood. Persistent stale or
partial state requires investigation.

Use this order:

1. `System -> Diagnostics` for readiness and recent failures.
2. `System -> Market data` for dataset provenance and coverage.
3. Dashboard data quality for user impact.
4. Audit events and provider logs for correlated request IDs.

Bounded transaction-FX history remains in diagnostics but must not by itself make the live header
stale. See [Troubleshooting](troubleshooting.md) for common symptoms.

## Authentication guardrails

If password authentication is enabled:

- use a strong `PORTFOLIO_AUTH_SESSION_SECRET` distinct from the password;
- prefer `_FILE` secret inputs;
- require `PORTFOLIO_AUTH_SECURE_COOKIE=true` behind HTTPS;
- do not expose OpenAPI UI unless intentional;
- protect detailed readiness and metrics at the reverse proxy where appropriate.

This auth model is for a single-user self-hosted instance, not a general identity system.

## Rollback

Rollback uses the previously recorded compatible digest set, not an arbitrary older image. Reverse
the consumer order: frontends, Portfolio API, providers, then the market backend, applying the same
readiness and contract gates after each stage. If a database migration or canonical state change is
not backward compatible, stop and use the release-specific recovery procedure instead of starting
an older API against newer state.
