package net.bobinski.portfolio.api.system

import java.nio.file.Files
import java.nio.file.Path
import java.sql.SQLException
import java.time.Clock
import java.time.Instant
import javax.sql.DataSource
import net.bobinski.portfolio.api.auth.config.AuthConfig
import net.bobinski.portfolio.api.backup.config.BackupConfig
import net.bobinski.portfolio.api.marketdata.config.MarketDataConfig
import net.bobinski.portfolio.api.persistence.config.PersistenceConfig

class SystemReadinessService(
    private val persistenceConfig: PersistenceConfig,
    private val backupConfig: BackupConfig,
    private val marketDataConfig: MarketDataConfig,
    private val authConfig: AuthConfig,
    private val clock: Clock,
    private val dataSource: DataSource? = null
) {
    fun current(): SystemReadiness {
        val checks = checks()
        return SystemReadiness(
            status = readinessStatus(checks),
            checkedAt = Instant.now(clock),
            checks = checks
        )
    }

    private fun checks(): List<SystemReadinessCheck> = buildList {
        add(databasePathCheck())
        add(databaseConnectionCheck())
        add(backupDirectoryCheck())
        add(marketDataCheck())
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

    private fun marketDataCheck(): SystemReadinessCheck =
        if (!marketDataConfig.enabled) {
            SystemReadinessCheck(
                key = "market-data",
                label = "Market data",
                status = ReadinessCheckStatus.INFO,
                message = "Live market data is disabled."
            )
        } else {
            SystemReadinessCheck(
                key = "market-data",
                label = "Market data",
                status = ReadinessCheckStatus.PASS,
                message = "Using ${marketDataConfig.stockAnalystBaseUrl} and ${marketDataConfig.edoCalculatorBaseUrl}."
            )
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
