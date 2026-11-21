# Operations runbook

This runbook covers both the repository's single full-stack Compose project and installations where
Stock Analyst UI, Stock Analyst, Portfolio and EDO Calculator are four independent Compose projects.
The stages and gates are the same; only orchestration differs.

## Before every rollout

1. Select one reviewed compatibility manifest with status `released` and immutable digests for all six images.
2. Export its selected path and six exact digest values, then pass `--require-released` before any Compose command.
3. Record the currently deployed digest set for rollback.
4. Confirm a recent canonical JSON backup and a separate copy outside the container volumes.
5. Render every Compose project with `docker compose config` and check for empty secrets, moving
   tags and unexpected public routes.
6. Read release notes for contract, persistence and configuration changes.

Never invent a digest, replace one with zeros or substitute `main`/`latest` in a production stack.
The candidate manifest in this repository deliberately contains null digests and is not a release.

## Repository full-stack rollout

Export `PORTFOLIO_COMPATIBILITY_MANIFEST` with the repository-relative released-manifest path and copy all six
digest variables exactly from that file, then:

```bash
export PORTFOLIO_COMPATIBILITY_MANIFEST=deployment/compatibility/<version>.json
python3 scripts/validate-compatibility-manifest.py --require-released
scripts/rollout-full-stack.sh
```

The script repeats this validation before its first Compose command. A candidate manifest, an unpublished image,
a missing variable or one mismatched digest stops the rollout without pulling or replacing any container.

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

The Portfolio API image owns `/app/bin/healthcheck`. Deployment-specific Compose definitions must inherit it;
remove legacy `portfolio-api.healthcheck` overrides. The image verifies its curl dependency during the build.
The probe requires HTTP 200 from the local `/v1/health`, does not follow redirects or use proxies, and limits
connection setup to one second and the whole request to two seconds. Docker keeps the ten-second interval,
three-second outer timeout, ten-second start period and twelve-failure threshold.

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
docker compose logs --tail=100 portfolio-api
```

The API log should contain UTC startup output and a safe access entry for the metadata request with
its `requestId`, status and duration. Liveness and metrics probes are intentionally filtered. The
supplied Compose stacks retain at most five 10 MiB local-driver log files per container.

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
5. After import, verify overview, holdings, transactions, the target schedule and import profiles.

Important semantics:

- in schema-version 5 `MERGE`, omitted `targetSchedule` preserves the schedule and a present
  section replaces the complete schedule;
- legacy schema-version 4 `targets` remain importable; a non-empty section updates the allocation
  effective on the import date, while an explicitly empty section clears the schedule;
- omitted `importProfiles` preserve current profiles;
- present `importProfiles` merge by id and final names must remain unique;
- market-data snapshots and active alert-dispatch state are excluded from transfer JSON and survive
  both modes;
- preview and real import enforce the same business validation.

## Backup and recovery posture

- Scheduled and post-change JSON backups are the first server-side recovery path.
- Canonical export/import is the portability path between installations.
- A backup produced by the API has been fully written and atomically published; abandoned temporary
  files are not candidates. Administratively supplied JSON may also be listed as unmanaged.
- Canonical writes persist an unprotected revision and its timing in SQLite. The checkpoint advances
  only after the API atomically publishes and re-reads a JSON backup, and stores that file's SHA-256,
  so restart does not discard pending work or silently accept a replaced checkpoint file.
- The default post-change policy waits for 120 quiet seconds to coalesce related writes. Continuing
  writes make the backup due at the 600-second threshold from the first still-unprotected change;
  the worker polls at least every 30 seconds, then still needs time to publish and verify the file.
- Periodic files (manual, scheduled and exact legacy names) keep the newest configured count of
  readable files; post-change files have their own count, and unreadable managed entries are bounded
  separately. Pre-`REPLACE` safety files expire by age. Retention protects the current checkpoint and
  the restore source during the operation.
- Legacy `portfolio-backup-<timestamp>.json` files remain readable, downloadable and restorable.
  Other JSON files are marked unmanaged and are never deleted by Portfolio retention.
- Restore does not roll market-data cache or active alert-delivery state backward.

Inspect `Data -> Backups` or `GET /v1/portfolio/backups` after a write. The status reports whether
changes are protected, `pendingSince`, `nextPostChangeBackupAt`, scheduler settings, the last
success/failure and each file's trigger and retention class. A brief pending state inside the
debounce window is expected. Pending state beyond the reported time plus a normal polling and
file-write interval, or any reported failure, requires a volume-permission and API-log/audit check.

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

## Apple container on macOS

For a local evaluation on Apple silicon, build the two ARM64 images from the repository root.
Allow the builder 6 GiB of memory for Gradle and the frontend toolchain.

```bash
container system start
container build --memory 6G -t portfolio-api:apple-local apps/api
container build --memory 6G -t portfolio-web:apple-local apps/web
```

Create the local network and two volumes once. Initialize the mount points with the API's UID
before its first start. The data and backups stay in these volumes when you recreate the services.

```bash
container network create portfolio-apple
container volume create portfolio-apple-data
container volume create portfolio-apple-backups
container run --rm --user 0:0 --entrypoint /usr/bin/chown \
  -v portfolio-apple-data:/srv/portfolio/data -v portfolio-apple-backups:/srv/portfolio/backups \
  portfolio-api:apple-local 10001:10001 /srv/portfolio/data /srv/portfolio/backups
```

Start the API, then use its current address for the web proxy. These commands require `jq`.

```bash
container run -d --rm --name portfolio-api --network portfolio-apple \
  -v portfolio-apple-data:/srv/portfolio/data -v portfolio-apple-backups:/srv/portfolio/backups \
  -e PORTFOLIO_DATABASE_PATH=/srv/portfolio/data/portfolio.db \
  -e PORTFOLIO_BACKUPS_ENABLED=true -e PORTFOLIO_BACKUPS_DIRECTORY=/srv/portfolio/backups \
  portfolio-api:apple-local
api_ip=$(container inspect portfolio-api | jq -er '.[0].status.networks[0].ipv4Address | split("/")[0]')
curl --fail --retry 30 --retry-all-errors --retry-delay 1 "http://${api_ip}:18082/v1/health"
container run -d --rm --name portfolio-web --network portfolio-apple -p 127.0.0.1:4174:4174 \
  -e PORTFOLIO_API_UPSTREAM="http://${api_ip}:18082" portfolio-web:apple-local
curl --fail --retry 30 --retry-all-errors --retry-delay 1 http://127.0.0.1:4174/api/v1/health
```

Open <http://127.0.0.1:4174>. Stop the services with `container stop portfolio-web portfolio-api`.
If you recreate the API, read its address again when starting the web container.
