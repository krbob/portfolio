package net.bobinski.portfolio.api.plugins

import java.nio.file.Files
import java.nio.file.Path
import net.bobinski.portfolio.api.auth.config.AuthConfig
import net.bobinski.portfolio.api.backup.config.BackupConfig
import net.bobinski.portfolio.api.marketdata.config.MarketDataConfig
import net.bobinski.portfolio.api.persistence.config.JournalMode
import net.bobinski.portfolio.api.persistence.config.PersistenceConfig
import net.bobinski.portfolio.api.persistence.config.SynchronousMode

internal fun validateStartupConfiguration(
    persistenceConfig: PersistenceConfig,
    marketDataConfig: MarketDataConfig,
    backupConfig: BackupConfig,
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
        require(marketDataConfig.stockAnalystBaseUrl.isHttpUrl()) {
            "Market data requires a valid stock analyst HTTP base URL."
        }
        require(marketDataConfig.edoCalculatorBaseUrl.isHttpUrl()) {
            "Market data requires a valid EDO calculator HTTP base URL."
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

    if (backupConfig.enabled) {
        require(backupConfig.directory.isNotBlank()) {
            "Backups require a non-blank directory."
        }
        validateBackupDirectory(
            backupDirectory = backupConfig.directory,
            databasePath = databasePath
        )
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
        require(authConfig.sessionMaxAgeDays > 0) {
            "Password authentication requires a positive session max age."
        }
    }
}

private fun String.isHttpUrl(): Boolean = startsWith("http://") || startsWith("https://")

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
