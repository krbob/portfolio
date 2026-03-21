package net.bobinski.portfolio.api.system

import java.nio.file.Files
import java.nio.file.Path
import java.sql.SQLException
import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.time.YearMonth
import javax.sql.DataSource
import kotlinx.coroutines.withTimeout
import net.bobinski.portfolio.api.auth.config.AuthConfig
import net.bobinski.portfolio.api.backup.config.BackupConfig
import net.bobinski.portfolio.api.marketdata.client.EdoCalculatorClient
import net.bobinski.portfolio.api.marketdata.client.GoldApiClient
import net.bobinski.portfolio.api.marketdata.client.StockAnalystClient
import net.bobinski.portfolio.api.marketdata.config.MarketDataConfig
import net.bobinski.portfolio.api.persistence.config.PersistenceConfig

class SystemReadinessService(
    private val persistenceConfig: PersistenceConfig,
    private val backupConfig: BackupConfig,
    private val marketDataConfig: MarketDataConfig,
    private val authConfig: AuthConfig,
    private val clock: Clock,
    private val dataSource: DataSource? = null,
    private val stockAnalystClient: StockAnalystClient? = null,
    private val edoCalculatorClient: EdoCalculatorClient? = null,
    private val goldApiClient: GoldApiClient? = null
) {
    suspend fun current(): SystemReadiness {
        val checks = checks()
        return SystemReadiness(
            status = readinessStatus(checks),
            checkedAt = Instant.now(clock),
            checks = checks
        )
    }

    private suspend fun checks(): List<SystemReadinessCheck> = buildList {
        add(databasePathCheck())
        add(databaseConnectionCheck())
        add(backupDirectoryCheck())
        addAll(marketDataChecks())
        add(authCheck())
    }

    private fun databasePathCheck(): SystemReadinessCheck {
        val databasePath = Path.of(persistenceConfig.databasePath).toAbsolutePath().normalize()
        val databaseDirectory = databasePath.parent

        if (databaseDirectory == null) {
            return SystemReadinessCheck(
                key = "sqlite-directory",
                label = "SQLite directory",
                status = ReadinessCheckStatus.FAIL,
                message = "Database path must have a parent directory."
            )
        }

        return runCatching {
            Files.createDirectories(databaseDirectory)
            require(Files.isDirectory(databaseDirectory)) {
                "Resolved database parent is not a directory."
            }
            require(Files.isWritable(databaseDirectory)) {
                "Resolved database parent is not writable."
            }

            SystemReadinessCheck(
                key = "sqlite-directory",
                label = "SQLite directory",
                status = ReadinessCheckStatus.PASS,
                message = "Using ${databasePath.fileName} in $databaseDirectory."
            )
        }.getOrElse { exception ->
            SystemReadinessCheck(
                key = "sqlite-directory",
                label = "SQLite directory",
                status = ReadinessCheckStatus.FAIL,
                message = exception.message ?: "Failed to validate SQLite directory."
            )
        }
    }

    private fun databaseConnectionCheck(): SystemReadinessCheck {
        val runtimeDataSource = dataSource
            ?: return SystemReadinessCheck(
                key = "sqlite-connection",
                label = "SQLite connection",
                status = ReadinessCheckStatus.INFO,
                message = "No runtime DataSource is bound in this application mode."
            )

        return runCatching {
            runtimeDataSource.connection.use { connection ->
                connection.createStatement().use { statement ->
                    statement.executeQuery("select 1").use { resultSet ->
                        require(resultSet.next()) { "SQLite test query returned no rows." }
                    }
                }
            }

            SystemReadinessCheck(
                key = "sqlite-connection",
                label = "SQLite connection",
                status = ReadinessCheckStatus.PASS,
                message = "SQLite responded to a connection test query."
            )
        }.getOrElse { exception ->
            val message = (exception as? SQLException)?.message ?: exception.message
            SystemReadinessCheck(
                key = "sqlite-connection",
                label = "SQLite connection",
                status = ReadinessCheckStatus.FAIL,
                message = message ?: "Failed to connect to SQLite."
            )
        }
    }

    private fun backupDirectoryCheck(): SystemReadinessCheck {
        if (!backupConfig.enabled) {
            return SystemReadinessCheck(
                key = "backups-directory",
                label = "Backups",
                status = ReadinessCheckStatus.INFO,
                message = "Server-side backups are disabled."
            )
        }

        val backupPath = Path.of(backupConfig.directory).toAbsolutePath().normalize()
        return runCatching {
            Files.createDirectories(backupPath)
            require(Files.isDirectory(backupPath)) {
                "Resolved backup path is not a directory."
            }
            require(Files.isWritable(backupPath)) {
                "Resolved backup directory is not writable."
            }

            SystemReadinessCheck(
                key = "backups-directory",
                label = "Backups",
                status = ReadinessCheckStatus.PASS,
                message = "Backups enabled in $backupPath with retention ${backupConfig.retentionCount}."
            )
        }.getOrElse { exception ->
            SystemReadinessCheck(
                key = "backups-directory",
                label = "Backups",
                status = ReadinessCheckStatus.FAIL,
                message = exception.message ?: "Failed to validate backup directory."
            )
        }
    }

    private suspend fun marketDataChecks(): List<SystemReadinessCheck> =
        if (!marketDataConfig.enabled) {
            listOf(
                SystemReadinessCheck(
                    key = "market-data",
                    label = "Market data",
                    status = ReadinessCheckStatus.INFO,
                    message = "Live market data is disabled."
                )
            )
        } else {
            buildList {
                add(stockAnalystProbeCheck())
                add(edoCalculatorProbeCheck())
                add(goldProbeCheck())
            }
        }

    private suspend fun stockAnalystProbeCheck(): SystemReadinessCheck = probeCheck(
        key = "stock-analyst",
        label = "Stock Analyst",
        clientBound = stockAnalystClient != null,
        unavailableMessage = "Stock Analyst client is not bound in this application mode."
    ) {
        val history = stockAnalystClient!!.history(
            symbol = marketDataConfig.usdPlnSymbol,
            from = MARKET_DATA_PROBE_FROM,
            to = MARKET_DATA_PROBE_TO
        )
        require(history.isNotEmpty()) {
            "Stock Analyst returned no history points for ${marketDataConfig.usdPlnSymbol}."
        }
        "Responded with ${history.size} history points for ${marketDataConfig.usdPlnSymbol}."
    }

    private suspend fun edoCalculatorProbeCheck(): SystemReadinessCheck = probeCheck(
        key = "edo-calculator",
        label = "EDO Calculator",
        clientBound = edoCalculatorClient != null,
        unavailableMessage = "EDO Calculator client is not bound in this application mode."
    ) {
        val inflation = edoCalculatorClient!!.monthlyInflation(
            from = CPI_PROBE_FROM,
            untilExclusive = CPI_PROBE_UNTIL_EXCLUSIVE
        )
        require(inflation.points.isNotEmpty()) {
            "EDO Calculator returned no CPI points for $CPI_PROBE_FROM..$CPI_PROBE_UNTIL_EXCLUSIVE."
        }
        "Responded with ${inflation.points.size} CPI points for $CPI_PROBE_FROM..$CPI_PROBE_UNTIL_EXCLUSIVE."
    }

    private suspend fun goldProbeCheck(): SystemReadinessCheck {
        if (marketDataConfig.goldApiKey.isNullOrBlank()) {
            return SystemReadinessCheck(
                key = "gold-market-data",
                label = "Gold data",
                status = ReadinessCheckStatus.INFO,
                message = "Spot gold API key is not configured; using fallback benchmark ${marketDataConfig.goldBenchmarkSymbol}."
            )
        }

        return probeCheck(
            key = "gold-market-data",
            label = "Gold data",
            clientBound = goldApiClient != null,
            unavailableMessage = "Gold API client is not bound in this application mode."
        ) {
            val history = goldApiClient!!.historyUsd(
                apiKey = marketDataConfig.goldApiKey,
                from = GOLD_PROBE_FROM,
                to = GOLD_PROBE_TO
            )
            require(history.isNotEmpty()) {
                "Gold API returned no spot XAU points."
            }
            "Responded with ${history.size} spot XAU points."
        }
    }

    private suspend fun probeCheck(
        key: String,
        label: String,
        clientBound: Boolean,
        unavailableMessage: String,
        probe: suspend () -> String
    ): SystemReadinessCheck {
        return if (!clientBound) {
            SystemReadinessCheck(
                key = key,
                label = label,
                status = ReadinessCheckStatus.INFO,
                message = unavailableMessage
            )
        } else {
            runCatching {
                val message = withTimeout(MARKET_DATA_PROBE_TIMEOUT_MS) { probe() }
                SystemReadinessCheck(
                    key = key,
                    label = label,
                    status = ReadinessCheckStatus.PASS,
                    message = message
                )
            }.getOrElse { exception ->
                SystemReadinessCheck(
                    key = key,
                    label = label,
                    status = ReadinessCheckStatus.WARN,
                    message = exception.message ?: "$label probe failed."
                )
            }
        }
    }

    private fun authCheck(): SystemReadinessCheck =
        if (!authConfig.enabled) {
            SystemReadinessCheck(
                key = "auth",
                label = "Authentication",
                status = ReadinessCheckStatus.INFO,
                message = "Single-user local mode without password auth."
            )
        } else {
            SystemReadinessCheck(
                key = "auth",
                label = "Authentication",
                status = ReadinessCheckStatus.PASS,
                message = "Password auth enabled with cookie session ${authConfig.sessionCookieName}."
            )
        }

    private fun readinessStatus(checks: List<SystemReadinessCheck>): SystemReadinessStatus = when {
        checks.any { it.status == ReadinessCheckStatus.FAIL } -> SystemReadinessStatus.NOT_READY
        checks.any { it.status == ReadinessCheckStatus.WARN } -> SystemReadinessStatus.DEGRADED
        else -> SystemReadinessStatus.READY
    }

    private companion object {
        const val MARKET_DATA_PROBE_TIMEOUT_MS = 2_500L
        val MARKET_DATA_PROBE_FROM: LocalDate = LocalDate.of(2025, 1, 2)
        val MARKET_DATA_PROBE_TO: LocalDate = LocalDate.of(2025, 1, 10)
        val CPI_PROBE_FROM: YearMonth = YearMonth.of(2025, 1)
        val CPI_PROBE_UNTIL_EXCLUSIVE: YearMonth = YearMonth.of(2025, 3)
        val GOLD_PROBE_FROM: LocalDate = LocalDate.of(2025, 1, 2)
        val GOLD_PROBE_TO: LocalDate = LocalDate.of(2025, 1, 5)
    }
}

data class SystemReadiness(
    val status: SystemReadinessStatus,
    val checkedAt: Instant,
    val checks: List<SystemReadinessCheck>
)

data class SystemReadinessCheck(
    val key: String,
    val label: String,
    val status: ReadinessCheckStatus,
    val message: String
)

enum class SystemReadinessStatus {
    READY,
    DEGRADED,
    NOT_READY
}

enum class ReadinessCheckStatus {
    PASS,
    WARN,
    FAIL,
    INFO
}
