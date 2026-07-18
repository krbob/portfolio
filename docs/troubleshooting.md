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

A missing FX conversion must preserve native quantities, but can make PLN cost/value fields partial.
The UI should say `PARTIALLY_VALUED`; it must not present the remaining valued subset as a complete
portfolio.

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

Never run `docker compose down --volumes` while investigating unless permanent deletion of the
database and server-backup volumes is intentional and a separate recovery copy has been verified.
