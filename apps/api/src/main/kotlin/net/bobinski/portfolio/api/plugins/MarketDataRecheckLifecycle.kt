package net.bobinski.portfolio.api.plugins

import io.ktor.server.application.Application
import io.ktor.server.application.ApplicationStarted
import io.ktor.server.application.ApplicationStopped
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import net.bobinski.portfolio.api.marketdata.config.MarketDataRecheckConfig
import net.bobinski.portfolio.api.marketdata.service.MarketDataRecheckService
import org.koin.ktor.ext.get
import org.slf4j.LoggerFactory

fun Application.configureMarketDataRecheckLifecycle() {
    val logger = LoggerFactory.getLogger("MarketDataRecheckLifecycle")
    val config = MarketDataRecheckConfig.from(environment.config)
    if (!config.enabled) {
        return
    }

    val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    var job: Job? = null

    monitor.subscribe(ApplicationStarted) {
        val recheckService = get<MarketDataRecheckService>()
        job = scope.launch {
            if (config.runOnStart) {
                runCatching {
                    recheckService.runStartupRecheck()
                }.onSuccess { result ->
                    logger.info(
                        "Startup market-data recheck completed: attempted={}, refreshed={}, degraded={}, skipped={}",
                        result.attemptedCount,
                        result.refreshedCount,
                        result.stillDegradedCount,
                        result.skippedCount
                    )
                }.onFailure { exception ->
                    logger.warn("Startup market-data recheck failed.", exception)
                }
            }

            while (isActive) {
                delay(config.intervalMinutes * 60_000)
                runCatching {
                    recheckService.runScheduledRecheck()
                }.onSuccess { result ->
                    logger.info(
                        "Scheduled market-data recheck completed: attempted={}, refreshed={}, degraded={}, skipped={}",
                        result.attemptedCount,
                        result.refreshedCount,
                        result.stillDegradedCount,
                        result.skippedCount
                    )
                }.onFailure { exception ->
                    logger.warn("Scheduled market-data recheck failed.", exception)
                }
            }
        }
    }

    monitor.subscribe(ApplicationStopped) {
        job?.cancel()
        scope.cancel()
    }
}
