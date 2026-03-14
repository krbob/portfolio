package net.bobinski.portfolio.api.plugins

import net.bobinski.portfolio.api.auth.config.AuthConfig
import net.bobinski.portfolio.api.backup.config.BackupConfig
import net.bobinski.portfolio.api.marketdata.config.MarketDataConfig
import net.bobinski.portfolio.api.persistence.config.PersistenceConfig

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
