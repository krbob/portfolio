package net.bobinski.portfolio.api.monitoring

import net.bobinski.portfolio.api.domain.service.ReadModelCacheService
import net.bobinski.portfolio.api.marketdata.service.MarketDataSnapshotCacheService
import net.bobinski.portfolio.api.marketdata.service.MarketDataSnapshotStatus
import net.bobinski.portfolio.api.readmodel.ReadModelRefreshService

/** Scraping reads local state only; it must never trigger valuations or upstream HTTP. */
class PortfolioMetricsService(
    private val metrics: PortfolioMetrics,
    private val snapshots: MarketDataSnapshotCacheService,
    private val cache: ReadModelCacheService,
    private val refresh: ReadModelRefreshService
) {
    suspend fun scrape(): String {
        val saved = snapshots.listSnapshots()
        val models = cache.list().filter { it.modelName in setOf("OVERVIEW", "DAILY_HISTORY", "RETURNS") }
        val status = refresh.status()
        return buildString {
            append(metrics.scrape())
            appendLine("# HELP portfolio_market_data_snapshots Saved snapshot check states, including inactive datasets; not a market-age measure.")
            appendLine("# TYPE portfolio_market_data_snapshots gauge")
            for (type in PortfolioMetrics.SNAPSHOT_TYPES) {
                for (state in MarketDataSnapshotStatus.entries) {
                    sample("portfolio_market_data_snapshots", saved.count { it.snapshotType == type && it.status == state },
                        "type=\"$type\",status=\"${state.name}\"")
                }
            }
            appendLine("# TYPE portfolio_read_model_generated_timestamp_seconds gauge")
            models.groupBy { it.modelName }.forEach { (model, entries) ->
                sample("portfolio_read_model_generated_timestamp_seconds", entries.maxOf { it.generatedAt.epochSecond }, "model=\"$model\"")
            }
            gauge("portfolio_read_model_refresh_enabled", if (status.schedulerEnabled) 1 else 0)
            gauge("portfolio_read_model_refresh_running", if (status.running) 1 else 0)
            gauge("portfolio_read_model_refresh_interval_seconds", status.intervalMinutes * 60)
            gauge("portfolio_read_model_refresh_last_run_timestamp_seconds", status.lastRunAt?.epochSecond ?: 0)
            gauge("portfolio_read_model_refresh_last_success_timestamp_seconds", status.lastSuccessAt?.epochSecond ?: 0)
            gauge("portfolio_read_model_refresh_last_failure_timestamp_seconds", status.lastFailureAt?.epochSecond ?: 0)
            gauge("portfolio_read_model_refresh_last_duration_seconds", (status.lastDurationMs ?: 0) / 1000.0)
        }
    }
}
