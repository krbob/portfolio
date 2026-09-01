package net.bobinski.portfolio.api.plugins

import io.ktor.server.application.Application
import io.ktor.server.application.ApplicationStarted
import io.ktor.server.application.ApplicationStopping
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
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

    val workerSupervisor = SupervisorJob()
    val scope = CoroutineScope(workerSupervisor + Dispatchers.IO)

    monitor.subscribe(ApplicationStarted) {
        val backupService = get<PortfolioBackupService>()
        scope.launch {
            while (isActive) {
                val failed = runCatching {
                    backupService.runScheduledBackup()
                }.onSuccess { backup ->
                    if (backup != null) {
                        logger.info("Scheduled portfolio backup created: {}", backup.fileName)
                    } else {
                        logger.debug("Scheduled portfolio backup skipped — recent backup exists.")
                    }
                }.onFailure { exception ->
                    if (exception is CancellationException) {
                        throw exception
                    }
                    logger.warn("Scheduled portfolio backup failed.", exception)
                }.isFailure
                delay(
                    if (failed) {
                        minOf(backupConfig.intervalMinutes * 60_000, SCHEDULED_RETRY_DELAY_MS)
                    } else {
                        backupConfig.intervalMinutes * 60_000
                    }
                )
            }
        }
        if (backupConfig.postChangeEnabled) {
            scope.launch {
                while (isActive) {
                    runCatching {
                        backupService.runPostChangeBackupCheck()
                    }.onSuccess { backup ->
                        if (backup != null) {
                            logger.info("Post-change portfolio backup created: {}", backup.fileName)
                        }
                    }.onFailure { exception ->
                        if (exception is CancellationException) {
                            throw exception
                        }
                        logger.warn("Post-change portfolio backup failed.", exception)
                    }
                    delay(postChangePollDelayMs(backupConfig.postChangeDebounceSeconds))
                }
            }
        }
    }

    monitor.subscribe(ApplicationStopping) {
        stopBackupWorkers(workerSupervisor)
    }
}

internal fun stopBackupWorkers(workerSupervisor: Job) {
    runBlocking {
        workerSupervisor.cancelAndJoin()
    }
}

private fun postChangePollDelayMs(debounceSeconds: Long): Long =
    minOf(debounceSeconds * 1_000, POST_CHANGE_MAX_POLL_DELAY_MS)
        .coerceAtLeast(POST_CHANGE_MIN_POLL_DELAY_MS)

private const val SCHEDULED_RETRY_DELAY_MS = 5 * 60_000L
private const val POST_CHANGE_MAX_POLL_DELAY_MS = 30_000L
private const val POST_CHANGE_MIN_POLL_DELAY_MS = 1_000L
