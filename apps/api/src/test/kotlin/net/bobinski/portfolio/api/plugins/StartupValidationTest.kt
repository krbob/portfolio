package net.bobinski.portfolio.api.plugins

import java.nio.file.Files
import net.bobinski.portfolio.api.auth.config.AuthConfig
import net.bobinski.portfolio.api.backup.config.BackupConfig
import net.bobinski.portfolio.api.marketdata.config.MarketDataConfig
import net.bobinski.portfolio.api.persistence.config.JournalMode
import net.bobinski.portfolio.api.persistence.config.PersistenceConfig
import net.bobinski.portfolio.api.persistence.config.SynchronousMode
import org.junit.jupiter.api.Assertions.assertDoesNotThrow
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test

class StartupValidationTest {

    @Test
    fun `startup validation rejects blank SQLite database path when SQLite mode is enabled`() {
        assertThrows(IllegalArgumentException::class.java) {
            validateStartupConfiguration(
                persistenceConfig = validSqlitePersistenceConfig().copy(
                    databasePath = ""
                ),
                marketDataConfig = validMarketDataConfig(),
                backupConfig = validBackupConfig(),
                authConfig = validAuthConfig()
            )
        }
    }

    @Test
    fun `startup validation accepts valid SQLite configuration`() {
        assertDoesNotThrow {
            validateStartupConfiguration(
                persistenceConfig = validSqlitePersistenceConfig(),
                marketDataConfig = validMarketDataConfig(),
                backupConfig = validBackupConfig(),
                authConfig = validAuthConfig()
            )
        }
    }

    @Test
    fun `startup validation rejects unsafe SQLite durability settings`() {
        assertThrows(IllegalArgumentException::class.java) {
            validateStartupConfiguration(
                persistenceConfig = validSqlitePersistenceConfig().copy(journalMode = JournalMode.MEMORY),
                marketDataConfig = validMarketDataConfig(),
                backupConfig = validBackupConfig(),
                authConfig = validAuthConfig()
            )
        }

        assertThrows(IllegalArgumentException::class.java) {
            validateStartupConfiguration(
                persistenceConfig = validSqlitePersistenceConfig().copy(synchronousMode = SynchronousMode.OFF),
                marketDataConfig = validMarketDataConfig(),
                backupConfig = validBackupConfig(),
                authConfig = validAuthConfig()
            )
        }
    }

    @Test
    fun `startup validation rejects malformed market data base urls`() {
        assertThrows(IllegalArgumentException::class.java) {
            validateStartupConfiguration(
                persistenceConfig = validPersistenceConfig(),
                marketDataConfig = validMarketDataConfig().copy(stockAnalystBaseUrl = "stock.local"),
                backupConfig = validBackupConfig(),
                authConfig = validAuthConfig()
            )
        }
    }

    @Test
    fun `startup validation rejects blank bond benchmark symbol`() {
        assertThrows(IllegalArgumentException::class.java) {
            validateStartupConfiguration(
                persistenceConfig = validPersistenceConfig(),
                marketDataConfig = validMarketDataConfig().copy(bondBenchmarkSymbol = ""),
                backupConfig = validBackupConfig(),
                authConfig = validAuthConfig()
            )
        }
    }

    @Test
    fun `startup validation rejects blank backup directory when backups are enabled`() {
        assertThrows(IllegalArgumentException::class.java) {
            validateStartupConfiguration(
                persistenceConfig = validPersistenceConfig(),
                marketDataConfig = validMarketDataConfig(),
                backupConfig = validBackupConfig().copy(enabled = true, directory = ""),
                authConfig = validAuthConfig()
            )
        }
    }

    @Test
    fun `startup validation accepts valid local configuration`() {
        assertDoesNotThrow {
            validateStartupConfiguration(
                persistenceConfig = validPersistenceConfig(),
                marketDataConfig = validMarketDataConfig(),
                backupConfig = validBackupConfig(),
                authConfig = validAuthConfig()
            )
        }
    }

    @Test
    fun `startup validation creates SQLite and backup directories eagerly`() {
        val tempRoot = Files.createTempDirectory("portfolio-startup-validation")
        val databasePath = tempRoot.resolve("db/portfolio.db")
        val backupPath = tempRoot.resolve("backups")

        assertDoesNotThrow {
            validateStartupConfiguration(
                persistenceConfig = validPersistenceConfig().copy(databasePath = databasePath.toString()),
                marketDataConfig = validMarketDataConfig(),
                backupConfig = validBackupConfig().copy(enabled = true, directory = backupPath.toString()),
                authConfig = validAuthConfig()
            )
        }

        org.junit.jupiter.api.Assertions.assertTrue(Files.isDirectory(databasePath.parent))
        org.junit.jupiter.api.Assertions.assertTrue(Files.isDirectory(backupPath))
    }

    @Test
    fun `startup validation rejects backup directory equal to database file`() {
        val tempRoot = Files.createTempDirectory("portfolio-startup-validation-conflict")
        val databasePath = tempRoot.resolve("portfolio.db")

        assertThrows(IllegalArgumentException::class.java) {
            validateStartupConfiguration(
                persistenceConfig = validPersistenceConfig().copy(databasePath = databasePath.toString()),
                marketDataConfig = validMarketDataConfig(),
                backupConfig = validBackupConfig().copy(enabled = true, directory = databasePath.toString()),
                authConfig = validAuthConfig()
            )
        }
    }

    private fun validPersistenceConfig() = defaultPersistenceConfig()

    private fun validSqlitePersistenceConfig() = defaultPersistenceConfig()

    private fun validMarketDataConfig() = MarketDataConfig(
        enabled = true,
        stockAnalystBaseUrl = "http://127.0.0.1:18080",
        edoCalculatorBaseUrl = "http://127.0.0.1:18081",
        goldApiBaseUrl = "https://api.gold-api.com",
        goldApiKey = null,
        usdPlnSymbol = "USDPLN=X",
        goldBenchmarkSymbol = "XAUUSD=X",
        equityBenchmarkSymbol = "VWRA.L",
        bondBenchmarkSymbol = "VAGF.DE"
    )

    private fun validBackupConfig() = BackupConfig(
        enabled = false,
        directory = "./data/backups",
        intervalMinutes = 1440,
        retentionCount = 30
    )

    private fun validAuthConfig() = AuthConfig(
        enabled = false,
        password = "",
        sessionSecret = "",
        sessionCookieName = "portfolio_session",
        secureCookie = false,
        sessionMaxAgeDays = 30
    )

    private fun defaultPersistenceConfig() = PersistenceConfig(
        databasePath = "./data/portfolio.db",
        journalMode = JournalMode.WAL,
        synchronousMode = SynchronousMode.FULL,
        busyTimeoutMs = 5_000
    )
}
