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
import net.bobinski.portfolio.api.backup.config.BackupConfig
import net.bobinski.portfolio.api.domain.service.PortfolioBackupService
import org.koin.ktor.ext.get
import org.slf4j.LoggerFactory

fun Application.configureBackupLifecycle() {
    val logger = LoggerFactory.getLogger("BackupLifecycle")
    val backupConfig = BackupConfig.from(environment.config)
    if (!backupConfig.enabled) {
        return
    }

    val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    var job: Job? = null

    monitor.subscribe(ApplicationStarted) {
        val backupService = get<PortfolioBackupService>()
        job = scope.launch {
            while (isActive) {
                runCatching {
                    backupService.runScheduledBackup()
                }.onSuccess { backup ->
                    logger.info("Scheduled portfolio backup created: {}", backup.fileName)
                }.onFailure { exception ->
                    logger.warn("Scheduled portfolio backup failed.", exception)
                }
                delay(backupConfig.intervalMinutes * 60_000)
            }
        }
    }

    monitor.subscribe(ApplicationStopped) {
        job?.cancel()
        scope.cancel()
    }
}
