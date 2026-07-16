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

## Backups

| Variable | Application default | Purpose |
| --- | --- | --- |
| `PORTFOLIO_BACKUPS_ENABLED` | `false` | Enable scheduled canonical JSON backups |
| `PORTFOLIO_BACKUPS_DIRECTORY` | `./data/backups` | Backup destination |
| `PORTFOLIO_BACKUPS_INTERVAL_MINUTES` | `1440` | Schedule interval |
| `PORTFOLIO_BACKUPS_RETENTION_COUNT` | `30` | Number of completed backups retained |

The local application Compose profile enables backups and mounts a dedicated named volume at
`/srv/portfolio/backups`. A backup contains portable canonical state and user preferences, not
market-data cache or active alert-delivery state.

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
| `PORTFOLIO_EQUITY_BENCHMARK_SYMBOL` | `VWRA.L` | Built-in equity reference series |
| `PORTFOLIO_BOND_BENCHMARK_SYMBOL` | `ETFBTBSP.WA` | Built-in bond reference series |

Base URLs may contain a deployment prefix such as `/api`, but must not include an operation path.
Portfolio calls only versioned `/v1` routes. `PORTFOLIO_STOCK_ANALYST_UI_URL` must be a browser-
reachable root URL; it is not the server-to-server API address.

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

## OpenAPI UI

`PORTFOLIO_OPENAPI_UI_ENABLED` defaults to `false`. Keep it disabled on public deployments unless
interactive API documentation is intentionally exposed.
