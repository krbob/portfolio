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
import net.bobinski.portfolio.api.readmodel.ReadModelRefreshService
import net.bobinski.portfolio.api.readmodel.config.ReadModelRefreshConfig
import org.koin.ktor.ext.get
import org.slf4j.LoggerFactory

fun Application.configureReadModelRefreshLifecycle() {
    val logger = LoggerFactory.getLogger("ReadModelRefreshLifecycle")
    val config = ReadModelRefreshConfig.from(environment.config)
    if (!config.enabled) {
        return
    }

    val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    var job: Job? = null

    monitor.subscribe(ApplicationStarted) {
        val refreshService = get<ReadModelRefreshService>()
        job = scope.launch {
            if (config.runOnStart) {
                runCatching {
                    refreshService.runStartupRefresh()
                }.onSuccess { result ->
                    logger.info("Warm read-model refresh completed on startup: {}", result.modelNames.joinToString(","))
                }.onFailure { exception ->
                    logger.warn("Warm read-model refresh failed on startup.", exception)
                }
            }

            while (isActive) {
                delay(config.intervalMinutes * 60_000)
                runCatching {
                    refreshService.runScheduledRefresh()
                }.onSuccess { result ->
                    logger.info("Scheduled read-model refresh completed: {}", result.modelNames.joinToString(","))
                }.onFailure { exception ->
                    logger.warn("Scheduled read-model refresh failed.", exception)
                }
            }
        }
    }

    monitor.subscribe(ApplicationStopped) {
        job?.cancel()
        scope.cancel()
    }
}
