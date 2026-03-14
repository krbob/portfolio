package net.bobinski.portfolio.api.plugins

import net.bobinski.portfolio.api.backup.config.BackupConfig
import net.bobinski.portfolio.api.marketdata.config.MarketDataConfig
import net.bobinski.portfolio.api.persistence.config.PersistenceConfig
import net.bobinski.portfolio.api.persistence.config.PersistenceMode
import org.junit.jupiter.api.Assertions.assertDoesNotThrow
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test

class StartupValidationTest {

    @Test
    fun `startup validation rejects non-postgres jdbc url when postgres mode is enabled`() {
        assertThrows(IllegalArgumentException::class.java) {
            validateStartupConfiguration(
                persistenceConfig = PersistenceConfig(
                    mode = PersistenceMode.POSTGRES,
                    jdbcUrl = "jdbc:sqlite:portfolio.db",
                    username = "portfolio",
                    password = "portfolio"
                ),
                marketDataConfig = validMarketDataConfig(),
                backupConfig = validBackupConfig()
            )
        }
    }

    @Test
    fun `startup validation rejects malformed market data base urls`() {
        assertThrows(IllegalArgumentException::class.java) {
            validateStartupConfiguration(
                persistenceConfig = validPersistenceConfig(),
                marketDataConfig = validMarketDataConfig().copy(stockAnalystBaseUrl = "stock.local"),
                backupConfig = validBackupConfig()
            )
        }
    }

    @Test
    fun `startup validation rejects blank backup directory when backups are enabled`() {
        assertThrows(IllegalArgumentException::class.java) {
            validateStartupConfiguration(
                persistenceConfig = validPersistenceConfig(),
                marketDataConfig = validMarketDataConfig(),
                backupConfig = validBackupConfig().copy(enabled = true, directory = "")
            )
        }
    }

    @Test
    fun `startup validation accepts valid local configuration`() {
        assertDoesNotThrow {
            validateStartupConfiguration(
                persistenceConfig = validPersistenceConfig(),
                marketDataConfig = validMarketDataConfig(),
                backupConfig = validBackupConfig()
            )
        }
    }

    private fun validPersistenceConfig() = PersistenceConfig(
        mode = PersistenceMode.POSTGRES,
        jdbcUrl = "jdbc:postgresql://127.0.0.1:15432/portfolio",
        username = "portfolio",
        password = "portfolio"
    )

    private fun validMarketDataConfig() = MarketDataConfig(
        enabled = true,
        stockAnalystBaseUrl = "http://127.0.0.1:18080",
        edoCalculatorBaseUrl = "http://127.0.0.1:18081",
        usdPlnSymbol = "USDPLN=X",
        goldBenchmarkSymbol = "XAUUSD=X",
        equityBenchmarkSymbol = "VWRA.L"
    )

    private fun validBackupConfig() = BackupConfig(
        enabled = false,
        directory = "./data/backups",
        intervalMinutes = 1440,
        retentionCount = 30
    )
}
