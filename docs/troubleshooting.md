# Troubleshooting

Start with `System -> Diagnostics`, then `System -> Market data`, then the Dashboard data-quality
panel. These views distinguish upstream availability, snapshot freshness, coverage gaps and
portfolio calculation state.

## Portfolio value dropped unexpectedly

Do not assume a large change is a market move until coverage is checked.

1. Confirm the canonical transaction and holding counts.
2. Check whether the main holding quantities are still present.
3. Inspect missing transaction FX, unvalued holdings and instrument-history gaps.
4. Compare the current read-model revision with the latest successful snapshot.
5. Check Stock Analyst readiness and the required `/v1/quote/{stock}` and
   `/v1/history/{stock}` paths.
6. Compare the final historical close with the live quote. A roughly 50x/100x discontinuity in a
   split-adjusted series is rejected by current versions; inspect older snapshot metadata and rebuild
   the read models once the provider returns a corrected range.

A missing FX conversion must preserve native quantities, but can make PLN cost/value fields partial.
The UI should say `PARTIALLY_VALUED`; it must not present the remaining valued subset as a complete
portfolio.

An omitted observation in a successful refreshed range is treated as an upstream correction and is
removed from the market-data cache when the provider marks the response fresh. Partial or stale
responses cannot delete last-known-good points. If an older deployment keeps resurrecting that
observation, upgrade before rebuilding; repeatedly refreshing the old union-only cache cannot remove
it. Current releases also refuse a cached fallback that contains the same implausible discontinuity.

## Header says stale while quotes look current

The header is scoped to live valuation datasets. Historical series ending at an explicitly
requested past date are assessed against that date and remain in diagnostics. If the header is
stale:

- inspect the dataset named in the status details;
- compare `marketTimestamp`/`marketDate` with `retrievedAt`;
- verify whether the app is serving a last-known-good fallback;
- check the refresh and market-data recheck scheduler status.

Repeated stale status without an explained market closure or upstream incident requires action.

## USD, gold or TWR is unavailable

These views need more than a current PLN quote:

- USD requires historical USD/PLN coverage;
- gold requires the gold reference range;
- TWR requires a usable start valuation and an uninterrupted chain after external-flow adjustment;
- real return also requires the supported complete inflation window.

Open `System -> Market data` and locate the missing range. Refreshing the browser cannot repair an
upstream coverage gap; run or wait for a read-model refresh/recheck after the provider recovers.

## `Failed to fetch` during startup

This normally means the web shell was reachable before Portfolio API, DNS or the reverse proxy was
ready. The bootstrap calls use bounded retry, after which the UI offers a manual retry.

Check in order:

```bash
curl -fsS http://127.0.0.1:18082/v1/health
curl -fsS http://127.0.0.1:18082/v1/readiness
curl -fsS http://127.0.0.1:4174/api/v1/meta
```

For a remote deployment, use the corresponding protected public URLs. A rolling update must not
start Portfolio until both providers and the Stock Analyst versioned route gate pass.

If Docker reports `exec: "curl": executable file not found` for `portfolio-api`, the deployment Compose file is
overriding the image-owned healthcheck with the retired curl command. Remove the API `healthcheck` block, recreate
the API container and let Docker inherit the application-packaged Java probe from the image.

## Portfolio API logs are empty or too noisy

Use the same Compose file set as the running deployment, then inspect recent output:

```bash
docker compose logs --tail=100 portfolio-api
curl -fsS http://127.0.0.1:18082/v1/meta >/dev/null
docker compose logs --since=1m portfolio-api
```

The metadata request should produce an `event=http_request` line with `method`, `path`, `status`,
`durationMs` and a correlated `requestId`. The request body and query string must not appear. Routine
`/v1/health` and `/metrics` probes are intentionally absent, so an otherwise idle healthy API can be
quiet after its startup messages.

If the metadata request still produces no line, verify that the inspected container belongs to the
active Compose project and that its configured log driver supports `docker compose logs`. Recreate
the API from the reviewed image after checking the rendered configuration; do not add a log file
inside the container. Supplied Compose stacks use bounded `local`-driver rotation (five 10 MiB files
per container), so persistent high volume should be investigated at its originating logger rather
than handled by increasing retention.

## Unexpected interface language

Without a current navigation hint, Portfolio resolves language from `navigator.languages` and
`navigator.language`. `uiLocale` received from Stock Analyst is a one-navigation hint, not a durable
preference. Theme remains persistent.

If an old browser profile behaves differently, verify its preferred-language order and perform one
normal reload. Current versions remove the legacy `portfolio:ui-locale` storage entry rather than
letting it override the browser indefinitely.

## Import or restore is blocked

- Always run preview first and read blocking issues as well as warnings.
- `REPLACE` requires the literal confirmation and an automatically created safety backup.
- In schema-version 5 `MERGE`, omitted `targetSchedule` and `importProfiles` are preserved; a present
  schedule section replaces the complete effective-dated strategy. Legacy schema-version 4
  `targets` remain supported: a non-empty section updates the allocation effective on the import
  date, while an explicitly empty section clears the schedule.
- A long-only replay violation identifies a transaction sequence that would create a negative
  quantity; fix the source data instead of bypassing it.

Operational market-data and alert-dispatch snapshots are deliberately not rolled backward by state
import or restore.

## Read-model refresh keeps failing

1. Confirm both upstream readiness endpoints.
2. Check for `429`, retryable `503`, timeout and circuit-open metadata.
3. Ensure Portfolio is not configured with a request concurrency above the Stock Analyst loader
   budget.
4. Inspect whether a compatible last-known-good snapshot remains available.
5. After the upstream recovers, trigger one refresh and verify that data quality returns to healthy.

Do not repeatedly restart all services: it removes useful in-memory protection and can amplify a
rate-limited upstream.

## Backup or SQLite startup failure

- verify that both mounted directories are writable by UID/GID `10001:10001`;
- use `scripts/fix-volume-ownership.sh` only for the documented legacy-volume migration;
- keep one API process per database file;
- do not copy a live SQLite database file as the primary backup workflow—use canonical JSON backup
  or an SQLite-aware snapshot.

If `Data -> Backups` or `GET /v1/portfolio/backups` reports unprotected changes:

1. Compare `pendingSince` and `nextPostChangeBackupAt` with the current time. The default policy
   intentionally waits for 120 quiet seconds and marks a continuing burst due after 600 seconds.
   The worker checks at least every 30 seconds, so allow one polling interval plus file-write time
   after the reported due timestamp before treating the delay itself as a failure.
2. Confirm both `schedulerEnabled` and `postChangeEnabled`; disabling either leaves automatic
   post-change protection off, although an on-demand backup is still available.
3. Check `lastFailureAt`/`lastFailureMessage`, API logs and `BACKUP_CREATE_FAILED` audit events, then
   verify free space and write permissions on the backup volume.
4. Do not rely on restarting the API to clear the warning. The canonical revision, checkpoint and
   pending timestamps are durable SQLite state and the worker resumes/reconciles them after restart.
5. If the checkpointed JSON was moved, deleted, became unreadable or no longer matches its stored
   SHA-256, restore the exact file or create a new on-demand backup; Portfolio deliberately marks
   that revision unprotected.

Old `portfolio-backup-<timestamp>.json` files remain in the periodic retention lane. JSON with any
other unrecognized name is shown as unmanaged and is never deleted automatically.

Never run `docker compose down --volumes` while investigating unless permanent deletion of the
database and server-backup volumes is intentional and a separate recovery copy has been verified.
