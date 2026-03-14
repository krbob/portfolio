package net.bobinski.portfolio.api.plugins

import net.bobinski.portfolio.api.backup.config.BackupConfig
import net.bobinski.portfolio.api.marketdata.config.MarketDataConfig
import net.bobinski.portfolio.api.persistence.config.PersistenceConfig

internal fun validateStartupConfiguration(
    persistenceConfig: PersistenceConfig,
    marketDataConfig: MarketDataConfig,
    backupConfig: BackupConfig
) {
    if (persistenceConfig.isPostgresEnabled) {
        require(persistenceConfig.jdbcUrl.startsWith("jdbc:postgresql://")) {
            "PostgreSQL persistence requires jdbc:postgresql:// JDBC URL."
        }
        require(persistenceConfig.username.isNotBlank()) {
            "PostgreSQL persistence requires a non-blank username."
        }
    }

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
    }

    if (backupConfig.enabled) {
        require(backupConfig.directory.isNotBlank()) {
            "Backups require a non-blank directory."
        }
    }
}

private fun String.isHttpUrl(): Boolean = startsWith("http://") || startsWith("https://")
