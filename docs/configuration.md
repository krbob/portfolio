# Configuration

Portfolio reads conservative application defaults from
`apps/api/src/main/resources/application.yaml`. Compose files opt into deployment-specific behavior.
Environment variables override application config; the four SQLite persistence settings also accept
an identically named JVM system property with higher priority.

Defaults below are raw application defaults. `docker-compose.yml` intentionally changes some of
them, notably enabling backups and secure cookies while keeping market data and background refresh
disabled. Always inspect the rendered deployment with `docker compose config`.

## Persistence

| Variable | Application default | Purpose |
| --- | --- | --- |
| `PORTFOLIO_DATABASE_PATH` | `./data/portfolio.db` | SQLite database file |
| `PORTFOLIO_JOURNAL_MODE` | `WAL` | SQLite journal mode |
| `PORTFOLIO_SYNCHRONOUS_MODE` | `FULL` | SQLite durability mode |
| `PORTFOLIO_BUSY_TIMEOUT_MS` | `5000` | Wait for a locked database before failing |

One API process must own one database file. The production container expects persistent data under
`/srv/portfolio/data` and runs as UID/GID `10001:10001`.

## Runtime logs

Portfolio API writes application and access logs to standard output through an explicit Logback
console appender. Each line uses a UTC timestamp and includes severity, service, logger, thread and
the request ID when one is active. Exceptions retain their full stack trace.

Access-log messages contain only request method, path, response status and elapsed milliseconds.
They do not contain request or response bodies, cookies, authorization values or query strings.
Routine `/v1/health` and `/metrics` requests are excluded; `/v1/readiness` remains visible because a
degraded readiness result requires investigation.

All supplied Compose stacks use Docker's `local` logging driver with five 10 MiB rotated files per
container. Rotation belongs to the container runtime; do not add an application file appender or
mount a second log directory into the API container. Inspect current output with:

```bash
docker compose logs --tail=100 portfolio-api
```

Domain audit events remain in SQLite and are available in the application. Process logs complement
that audit trail; they do not replace it and deliberately omit portfolio transaction details.

## Backups

| Variable | Application default | Purpose |
| --- | --- | --- |
| `PORTFOLIO_BACKUPS_ENABLED` | `false` | Enable periodic and post-change canonical JSON backups |
| `PORTFOLIO_BACKUPS_DIRECTORY` | `./data/backups` | Backup destination |
| `PORTFOLIO_BACKUPS_INTERVAL_MINUTES` | `1440` | Schedule interval |
| `PORTFOLIO_BACKUPS_RETENTION_COUNT` | `30` | Number of managed periodic backups retained |
| `PORTFOLIO_BACKUPS_POST_CHANGE_ENABLED` | `true` | Create a backup after canonical changes settle |
| `PORTFOLIO_BACKUPS_POST_CHANGE_DEBOUNCE_SECONDS` | `120` | Quiet period after the latest canonical change |
| `PORTFOLIO_BACKUPS_POST_CHANGE_MAX_DELAY_SECONDS` | `600` | Due threshold from the first still-unprotected change |
| `PORTFOLIO_BACKUPS_POST_CHANGE_RETENTION_COUNT` | `10` | Number of managed post-change backups retained |
| `PORTFOLIO_BACKUPS_SAFETY_RETENTION_DAYS` | `30` | Minimum age before a managed pre-`REPLACE` safety backup may be pruned |

The local application Compose profile enables backups and mounts a dedicated named volume at
`/srv/portfolio/backups`. A backup contains portable canonical state and user preferences, not
market-data cache or active alert-delivery state.

`PORTFOLIO_BACKUPS_ENABLED` controls both the periodic scheduler and the post-change worker; manual
backups remain available. Post-change backup is effective only when both enable switches are true.
The debounce coalesces a burst of writes, while the maximum delay defines when the first
unprotected change becomes due even if writes continue. The maximum delay must be at least the
debounce delay. The worker polls at least every 30 seconds, so `nextPostChangeBackupAt` is the due
threshold rather than an exact completion promise; normal publication can follow it by one polling
interval plus file-write time.

Canonical writes advance a revision and update the pending timestamps in the same SQLite
transaction. A successfully published and re-read JSON file advances the durable checkpoint and
records that file's SHA-256. Those values survive an API restart; startup reconciles an upgraded
database, and a missing, unreadable or checksum-mismatched checkpoint file is treated as
unprotected state rather than silently accepted.

Retention is applied independently:

- `retentionCount` bounds the periodic lane, which contains manual, scheduled and recognized legacy
  `portfolio-backup-<timestamp>.json` files;
- `postChangeRetentionCount` bounds files created by the post-change worker;
- pre-import and pre-restore `REPLACE` safety files are eligible only after `safetyRetentionDays`;
- JSON files that do not match a managed or legacy Portfolio backup name are `UNMANAGED` and are
  never deleted by retention.

Within each count-based lane, readable backups and unreadable managed entries are bounded
separately. A corrupt file therefore does not consume the quota intended for restorable copies.

The backup endpoint `GET /v1/portfolio/backups` exposes these settings, protection state,
`pendingSince`, `nextPostChangeBackupAt`, failures and per-file trigger/retention class. The same
information is summarized in `Data -> Backups`.

## Market data

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORTFOLIO_MARKET_DATA_ENABLED` | `false` | Enable all external valuation integrations |
| `PORTFOLIO_STOCK_ANALYST_API_URL` | `http://127.0.0.1:18080` | Stock/ETF/FX/benchmark API base URL |
| `PORTFOLIO_STOCK_ANALYST_UI_URL` | empty | Optional browser URL used by the app switcher |
| `PORTFOLIO_EDO_CALCULATOR_API_URL` | `http://127.0.0.1:18081` | EDO API base URL |
| `PORTFOLIO_GOLD_API_URL` | `https://api.gold-api.com` | Optional spot-gold API base URL |
| `PORTFOLIO_GOLD_API_KEY` | empty | Optional API credential |
| `PORTFOLIO_MARKET_DATA_STALE_AFTER_DAYS` | `3` | Portfolio snapshot age threshold |
| `PORTFOLIO_USDPLN_SYMBOL` | `PLN=X` | Stock Analyst symbol used for USD/PLN |
| `PORTFOLIO_GOLD_BENCHMARK_SYMBOL` | `GC=F` | Gold reference series |
| `PORTFOLIO_EQUITY_BENCHMARK_SYMBOL` | `VWRA.L` | Default base phase for the global-equity benchmark schedule when no schedule has been saved |
| `PORTFOLIO_BOND_BENCHMARK_SYMBOL` | `ETFBTBSP.WA` | Built-in bond reference series |

Base URLs may contain a deployment prefix such as `/api`, but must not include an operation path.

Stock Analyst requests share two in-flight slots. A classified retryable HTTP 503
`SERVICE_UNAVAILABLE` can be retried at most three times, respecting `Retry-After` (seconds or
HTTP date), with a minimum 1/2/4-second backoff and up to 250 ms jitter. A slot stays occupied
during backoff. All attempts and waits share the original 20-second request budget; waiting to
acquire a slot is outside that budget. A delay that cannot fit leaves the original error intact.
429, unclassified proxy errors, malformed retry headers, other HTTP errors and decode failures
are not retried. EDO keeps its 10-second budget without HTTP response retries. Caller cancellation
cancels the request or wait immediately. These limits are fixed in code.

Portfolio calls only versioned `/v1` routes. `PORTFOLIO_STOCK_ANALYST_UI_URL` must be a browser-
reachable root URL; it is not the server-to-server API address.

### CPI availability and diagnostics

Monthly CPI reads discover the latest published window through EDO Calculator. Within one API
process, publication checks are reused for one hour and concurrent analytics reads share them.
Failed CPI reads have a five-minute cooldown; last-known-good data remains explicitly stale during
that cooldown. These fixed read-path limits are independent of the scheduler settings below.

Detailed readiness shares the Gold API probe result across requests for 15 minutes, including failed
checks, and honors a longer `Retry-After`. Its details include the actual probe time and earliest next
check time. This process-local cache limits diagnostic calls against the provider's quota; current
portfolio valuations keep their separate snapshot policy. Stock Analyst and EDO readiness checks
still run on each detailed readiness request.

### Background recheck

The recheck scheduler repairs missing or failed market-data ranges independently of the full read-
model refresh.

| Variable | Default |
| --- | ---: |
| `PORTFOLIO_MARKET_DATA_RECHECK_ENABLED` | `false` |
| `PORTFOLIO_MARKET_DATA_RECHECK_INTERVAL_MINUTES` | `15` |
| `PORTFOLIO_MARKET_DATA_RECHECK_RUN_ON_START` | `true` |
| `PORTFOLIO_MARKET_DATA_RECHECK_BASE_RETRY_MINUTES` | `30` |
| `PORTFOLIO_MARKET_DATA_RECHECK_MAX_RETRY_MINUTES` | `120` |
| `PORTFOLIO_MARKET_DATA_RECHECK_SERIES_LOOKBACK_DAYS` | `14` |
| `PORTFOLIO_MARKET_DATA_RECHECK_INFLATION_LOOKBACK_MONTHS` | `6` |

## Read-model refresh

| Variable | Application default | Purpose |
| --- | --- | --- |
| `PORTFOLIO_READ_MODEL_REFRESH_ENABLED` | `false` | Enable scheduled analytics rebuilds |
| `PORTFOLIO_READ_MODEL_REFRESH_INTERVAL_MINUTES` | `720` | Refresh interval |
| `PORTFOLIO_READ_MODEL_REFRESH_RUN_ON_START` | `true` | Run once when the scheduler starts |

Automatic push-alert dispatch follows a successful read-model refresh. A deployment that expects
scheduled notifications must enable this scheduler.

## Alerts and web push

| Variable | Default |
| --- | ---: |
| `PORTFOLIO_ALERTS_ENABLED` | `true` |
| `PORTFOLIO_ALERT_ALLOCATION_DRIFT_THRESHOLD_PCT_POINTS` | `5.00` |
| `PORTFOLIO_ALERT_BENCHMARK_UNDERPERFORMANCE_THRESHOLD_PCT_POINTS` | `5.00` |
| `PORTFOLIO_WEB_PUSH_VAPID_PUBLIC_KEY` | empty |
| `PORTFOLIO_WEB_PUSH_VAPID_PRIVATE_KEY_B64` | empty |
| `PORTFOLIO_WEB_PUSH_VAPID_PRIVATE_KEY` | empty |
| `PORTFOLIO_WEB_PUSH_VAPID_SUBJECT` | empty |

Web push is active only when public key, one private-key representation and subject are all set.
The thresholds and global delivery switch act as defaults until the user saves corresponding
settings in the application.

## Authentication

| Variable | Application default | Purpose |
| --- | --- | --- |
| `PORTFOLIO_AUTH_ENABLED` | `false` | Enable single-user password auth |
| `PORTFOLIO_AUTH_PASSWORD` | empty | Login password |
| `PORTFOLIO_AUTH_SESSION_SECRET` | empty | Independent session-signing secret |
| `PORTFOLIO_AUTH_SESSION_COOKIE_NAME` | `portfolio_session` | Session cookie name |
| `PORTFOLIO_AUTH_SECURE_COOKIE` | `false` | Restrict the cookie to HTTPS |
| `PORTFOLIO_AUTH_SESSION_MAX_AGE_DAYS` | `30` | Session lifetime |

Set `PORTFOLIO_AUTH_ENABLED=true` explicitly. Use a strong session secret different from the
password and set `PORTFOLIO_AUTH_SECURE_COOKIE=true` behind HTTPS. This is deliberately a thin
single-user guard, not a multi-user identity system.

## Secret files

Settings read through the secret-aware config reader accept an additional `${VARIABLE}_FILE`
environment variable. The direct value wins when both are set. The supplied Compose files expose
file variants for:

- `PORTFOLIO_GOLD_API_KEY`
- `PORTFOLIO_AUTH_PASSWORD`
- `PORTFOLIO_AUTH_SESSION_SECRET`
- all VAPID public/private/subject values

Mount the secret read-only and point the `_FILE` variable at the container path. Do not commit
credentials or private VAPID material.

## Web container and local Vite

| Variable | Scope | Default | Purpose |
| --- | --- | --- | --- |
| `PORTFOLIO_API_UPSTREAM` | web container | `http://portfolio-api:18082` | Nginx server-side API upstream |
| `PORTFOLIO_SHOW_CHART_ATTRIBUTION` | web container | `true` | Runtime chart attribution switch |
| `VITE_API_PROXY_TARGET` | Vite dev server | `http://127.0.0.1:18082` | Local `/api` proxy target |
| `VITE_ALLOWED_HOSTS` | Vite dev server | unset | Additional development hosts |
| `VITE_SHOW_CHART_ATTRIBUTION` | local build | unset | Build-time fallback for local development |

The browser always calls same-origin `/api`. `PORTFOLIO_API_UPSTREAM` is consumed by Nginx inside
the container, not exposed to browser JavaScript. Keep chart attribution enabled unless your use of
the chart library permits hiding it.

### Browser data cache

API responses are cached in memory per browser tab. A new tab or full page reload starts with an
empty data cache; the service worker caches the application shell and assets, not `/api/` responses.
The web client continues to request API responses with HTTP `cache: no-store`.

The dashboard additionally uses a persistent API overview snapshot in SQLite. After the first
complete valuation has been saved, a new browser session or API restart can display it immediately.
The calculation timestamp is shown beside the valuation. The web query first requests
`GET /v1/portfolio/overview?preferCached=true`; if `valuationSnapshot.refreshRequired` is true, it
publishes that preview and continues with a normal `GET /v1/portfolio/overview` while the page remains
visible. The normal endpoint still attempts a live valuation. There is no extra polling loop.

A saved preview requires matching account, instrument and transaction contents plus the market-data
configuration. Edits, deletes and imports cannot reuse a snapshot of another ledger, including when
imported timestamps are unchanged. A new date, changed source revision, or a calculation at least
60 seconds old requires a refresh. A previous day's compatible snapshot retains its original date
and timestamp while being refreshed. An empty/incompatible cache needs an initial live calculation.

Only complete market valuations replace the saved overview (book-only valuation is also allowed
when market data is explicitly disabled). A failed or partial live refresh preserves a compatible
complete snapshot and sets `valuationSnapshot.refreshFailed`; the dashboard keeps the values visible
with an explanatory message and retry action. A transport failure during background fetching also
keeps the already displayed preview. Cancellation on navigation/session clearing cannot restore an
abandoned response to the browser cache. `valuationSnapshot.generatedAt` is the time of calculation,
not the time of the HTTP response or the exchange quote.

Query freshness is configured in the web application:

| Data | Fresh for |
| --- | --- |
| Current overview, holdings, account valuations, allocation, contribution plans, alerts and market-data diagnostics | 1 minute |
| Daily history and returns | 5 minutes |
| Other queries, including transactions, accounts, instruments and settings | 5 minutes by default |
| Detailed system readiness | 5 minutes |
| Application metadata | 1 minute |
| Authentication session | 30 seconds |

These windows control reuse on screen mounts, returning to a visible tab and reconnecting. They
are not polling intervals. Returning to the app does not globally invalidate the cache. Mutations
and explicit refresh actions still invalidate their affected queries immediately, even within the
freshness window. Backup status retains its separate 30-second polling interval, shortened to five
seconds while a backup is running or post-change protection is pending.

Concurrent valuation and analytics reads share one final diagnostics refresh after all settle,
including failures. An initial diagnostics read can still show the previous state while those reads
are running. The overview snapshot is separate from those browser freshness windows and from the
raw market-data fallback cache. It occupies one `portfolio.overview` row in `read_model_cache`, is
excluded from portable JSON, and is removed by the existing read-model cache clear action.

## OpenAPI UI

`PORTFOLIO_OPENAPI_UI_ENABLED` defaults to `false`. Keep it disabled on public deployments unless
interactive API documentation is intentionally exposed.

## Prometheus metrics

`/metrics` (through the web proxy: `/api/metrics`) reads local operational state only. Scraping
never calls a market-data provider or rebuilds a valuation. Authentication follows the existing
single-user session policy. Counters are process-local and reset on restart; all bounded series
start at zero so Prometheus can observe the first event after its initial scrape.

- `portfolio_http_responses_total`: HTTP status classes, with 429 separate from other 4xx.
- `portfolio_upstream_requests_total`: Stock Analyst/EDO HTTP attempts by provider, operation and
  outcome, including diagnostics. `portfolio_upstream_retries_total` counts actual retries.
- `portfolio_market_data_checks_total`: completed dataset refresh outcomes after retries, grouped
  by snapshot type. Includes ETF/FX, EDO, gold and inflation snapshot updates.
- `portfolio_market_data_fallbacks_total`: accepted older snapshot data after a failure; normal
  fresh CPI/gold cache reuse does not increment it. Attempts, dataset checks and fallback uses
  are different stages and must not be summed as user operations.
- `portfolio_market_data_snapshots`: persisted last-check states, including inactive and historical
  datasets. FRESH means the last check succeeded, not that its market date is today.
- `portfolio_valuation_*`: completeness, holding/issue counts and attempt/success timestamps from
  live overview calculations in this process. Missing before the first observation; serving a
  cached preview does not advance them. Timestamps describe calculation time, not quote age.
- `portfolio_read_model_refreshes_total`: success, degraded (not published) or failure by trigger.
  Scheduler gauges expose configured cadence, running state and last run/success/failure/duration.
- `portfolio_read_model_generated_timestamp_seconds`: latest persisted calculation time per model,
  preserved across restarts. It does not certify compatibility with the current ledger.

Metric labels never contain account IDs, instrument symbols, purchase dates, URLs or error text.
Use the application audit log for per-instrument failures. HTTP latency remains a sum/count
summary: it supports averages, not percentile calculations.
