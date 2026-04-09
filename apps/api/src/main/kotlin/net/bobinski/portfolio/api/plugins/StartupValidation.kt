package net.bobinski.portfolio.api.plugins

import java.nio.file.Files
import java.nio.file.Path
import net.bobinski.portfolio.api.auth.config.AuthConfig
import net.bobinski.portfolio.api.backup.config.BackupConfig
import net.bobinski.portfolio.api.marketdata.config.MarketDataConfig
import net.bobinski.portfolio.api.marketdata.config.MarketDataRecheckConfig
import net.bobinski.portfolio.api.persistence.config.JournalMode
import net.bobinski.portfolio.api.persistence.config.PersistenceConfig
import net.bobinski.portfolio.api.persistence.config.SynchronousMode
import net.bobinski.portfolio.api.readmodel.config.ReadModelRefreshConfig

internal fun validateStartupConfiguration(
    persistenceConfig: PersistenceConfig,
    marketDataConfig: MarketDataConfig,
    marketDataRecheckConfig: MarketDataRecheckConfig,
    backupConfig: BackupConfig,
    readModelRefreshConfig: ReadModelRefreshConfig,
    authConfig: AuthConfig
) {
    require(persistenceConfig.databasePath.isNotBlank()) {
        "SQLite persistence requires a non-blank database path."
    }
    require(persistenceConfig.busyTimeoutMs > 0) {
        "SQLite persistence requires a positive busy timeout."
    }
    require(persistenceConfig.journalMode != JournalMode.OFF) {
        "SQLite journal mode OFF is unsupported for the self-hosted runtime."
    }
    require(persistenceConfig.journalMode != JournalMode.MEMORY) {
        "SQLite journal mode MEMORY is unsupported for the self-hosted runtime."
    }
    require(persistenceConfig.synchronousMode != SynchronousMode.OFF) {
        "SQLite synchronous mode OFF is unsupported for the self-hosted runtime."
    }

    val databasePath = validateDatabasePath(persistenceConfig.databasePath)

    if (marketDataConfig.enabled) {
        require(marketDataConfig.stockAnalystApiUrl.isHttpUrl()) {
            "Market data requires a valid stock analyst HTTP API URL."
        }
        require(marketDataConfig.edoCalculatorApiUrl.isHttpUrl()) {
            "Market data requires a valid EDO calculator HTTP API URL."
        }
        require(marketDataConfig.goldApiKey == null || marketDataConfig.goldApiUrl.isHttpUrl()) {
            "Gold API integration requires a valid HTTP API URL."
        }
        require(marketDataConfig.staleAfterDays > 0) {
            "Market data stale-after threshold must be positive."
        }
        require(marketDataConfig.usdPlnSymbol.isNotBlank()) {
            "Market data requires a non-blank USD/PLN symbol."
        }
        require(marketDataConfig.goldBenchmarkSymbol.isNotBlank()) {
            "Market data requires a non-blank gold benchmark symbol."
        }
        require(marketDataConfig.equityBenchmarkSymbol.isNotBlank()) {
            "Market data requires a non-blank equity benchmark symbol."
        }
        require(marketDataConfig.bondBenchmarkSymbol.isNotBlank()) {
            "Market data requires a non-blank bond benchmark symbol."
        }
    }

    if (marketDataRecheckConfig.enabled) {
        require(marketDataConfig.enabled) {
            "Market data recheck requires market data integration to be enabled."
        }
        require(marketDataRecheckConfig.intervalMinutes > 0) {
            "Market data recheck requires a positive interval."
        }
        require(marketDataRecheckConfig.baseRetryMinutes > 0) {
            "Market data recheck requires a positive base retry interval."
        }
        require(marketDataRecheckConfig.maxRetryMinutes >= marketDataRecheckConfig.baseRetryMinutes) {
            "Market data recheck max retry must be greater than or equal to base retry."
        }
        require(marketDataRecheckConfig.seriesLookbackDays > 0) {
            "Market data recheck requires a positive series lookback."
        }
        require(marketDataRecheckConfig.inflationLookbackMonths > 0) {
            "Market data recheck requires a positive inflation lookback."
        }
    }

    if (backupConfig.enabled) {
        require(backupConfig.directory.isNotBlank()) {
            "Backups require a non-blank directory."
        }
        validateBackupDirectory(
            backupDirectory = backupConfig.directory,
            databasePath = databasePath
        )
    }

    if (readModelRefreshConfig.enabled) {
        require(readModelRefreshConfig.intervalMinutes > 0) {
            "Read-model refresh requires a positive interval."
        }
    }

    if (authConfig.enabled) {
        require(authConfig.password.isNotBlank()) {
            "Password authentication requires a non-blank password."
        }
        require(authConfig.sessionSecret.length >= 16) {
            "Password authentication requires a session secret of at least 16 characters."
        }
        require(authConfig.sessionCookieName.isNotBlank()) {
            "Password authentication requires a non-blank session cookie name."
        }
        require(authConfig.sessionCookieName.isValidCookieName()) {
            "Password authentication requires a valid session cookie name."
        }
        require(authConfig.sessionMaxAgeDays > 0) {
            "Password authentication requires a positive session max age."
        }
        require(authConfig.sessionSecret != authConfig.password) {
            "Password authentication requires a session secret distinct from the password."
        }
    }
}

private fun String.isHttpUrl(): Boolean = startsWith("http://") || startsWith("https://")

private fun String.isValidCookieName(): Boolean =
    matches(Regex("^[!#$%&'*+.^_`|~0-9A-Za-z-]+$"))

private fun validateDatabasePath(rawPath: String): Path {
    val databasePath = Path.of(rawPath).toAbsolutePath().normalize()
    require(databasePath.fileName != null) {
        "SQLite database path must point to a file."
    }
    require(!Files.exists(databasePath) || !Files.isDirectory(databasePath)) {
        "SQLite database path must point to a file, not a directory."
    }

    val directory = databasePath.parent
        ?: throw IllegalArgumentException("SQLite database path must have a parent directory.")
    Files.createDirectories(directory)
    require(Files.isDirectory(directory)) {
        "SQLite database directory could not be created."
    }
    require(Files.isWritable(directory)) {
        "SQLite database directory must be writable."
    }

    return databasePath
}

private fun validateBackupDirectory(backupDirectory: String, databasePath: Path) {
    val backupPath = Path.of(backupDirectory).toAbsolutePath().normalize()
    require(backupPath != databasePath) {
        "Backup directory must not point at the SQLite database file."
    }

    Files.createDirectories(backupPath)
    require(Files.isDirectory(backupPath)) {
        "Backup directory could not be created."
    }
    require(Files.isWritable(backupPath)) {
        "Backup directory must be writable."
    }
}
