# Operations Runbook

## Update an existing deployment

```bash
scripts/rollout-full-stack.sh
```

Before these commands, export all digest variables listed in `docs/deployment-compatibility.md`. Never copy a moving
tag into the production file or invent a digest for an image that has not been published.

The staged order is a correctness requirement. The rollout script exits before touching Portfolio API unless both
providers pass bounded readiness polling and the versioned Stock Analyst routes pass the OpenAPI gate. Dependency
startup order alone does not protect a rolling update of already-running containers. The script intentionally uses
the Stock Analyst container as the network probe for EDO, so it does not require diagnostic tooling in the EDO image.

If this deployment was created before the API image switched to UID/GID `10001:10001`, repair existing SQLite and backup volume ownership once before starting the updated API:

```bash
sh scripts/fix-volume-ownership.sh
```

If you use the self-hosted market-data override on ARM hardware, keep `PORTFOLIO_MARKET_DATA_PLATFORM=linux/amd64` unless the upstream images publish multi-arch images.

## Fresh start from zero

```bash
docker compose down --volumes --remove-orphans
docker compose up -d
```

This removes the named volumes used for SQLite data and server backups.

## Minimum post-deploy verification

```bash
curl -sSf http://127.0.0.1:18082/v1/health
curl -s http://127.0.0.1:18082/v1/readiness
curl -sSf http://127.0.0.1:4174/api/v1/meta
```

Then confirm in the UI:

- login still works if auth is enabled
- `Portfolio -> Holdings` and `Portfolio -> Accounts` both render
- `Strategy -> Instruments` shows the instrument catalog
- `Strategy -> Targets` still shows current target history
- `Data -> Import` preview still opens
- `Data -> Backups` is readable
- `System -> Diagnostics` and `System -> Market data` are readable

## Import and restore workflow

For any non-trivial state change:

1. Export the current canonical state or confirm that a recent server backup exists.
2. Run preview first.
3. Read blocking issues and warnings, not just the summary badge.
4. For `REPLACE`, confirm the safety backup was created.
5. After the operation, verify:
   - overview
   - holdings
   - transactions
   - targets
   - import profiles

Important semantics:

- in `MERGE`, missing `targets` means preserve current targets
- in `MERGE`, present `targets` replace the allocation set
- in `MERGE`, missing `importProfiles` means preserve current profiles
- market-data snapshots and active alert-dispatch state are excluded from transfer JSON and survive both import modes
- `appPreferenceCount` and preference diffs describe user settings only
- preview and real import should agree on business validation

## Backup and restore posture

- scheduled JSON backups are the first recovery path
- canonical export/import remains the portability path
- `REPLACE` restore/import is a maintenance action, not a casual edit flow
- restore does not roll market-data cache or active alert-delivery state backward to the backup timestamp
- a listed `.json` backup has already been fully written and atomically published; abandoned temporary files are not backup candidates

If a restore is needed, prefer:

1. create or download a fresh backup of the current state
2. preview the incoming snapshot
3. restore/import
4. validate user-facing views
5. check the audit log for backup and restore events

## Market-data behavior and stale handling

The app can run in three meaningful data states:

- healthy live data
- fallback data available but stale
- partial or missing coverage

Operational interpretation:

- `STALE` is acceptable as a temporary degraded mode
- it is not acceptable if the product keeps staying stale without a known upstream reason
- fallback snapshots should explain why the app is still usable
- the global market-data bar covers live datasets; bounded transaction-FX history is inspected separately under
  `System -> Market data` and must not by itself mark the live headline stale

When investigating market-data issues:

1. check `System -> Diagnostics`
2. check `System -> Market data`
3. check `Dashboard -> Data quality`
4. inspect recent audit events for upstream failures

## Auth guardrails

If password auth is enabled:

- use a real `PORTFOLIO_AUTH_SESSION_SECRET`
- keep the session secret distinct from the password
- keep `PORTFOLIO_AUTH_SECURE_COOKIE=true` behind HTTPS
- keep the cookie name simple and RFC-safe
- do not expose OpenAPI UI publicly unless you intentionally want it

The auth model is intentionally thin. It is designed for single-user self-hosting, not as a general identity system.
