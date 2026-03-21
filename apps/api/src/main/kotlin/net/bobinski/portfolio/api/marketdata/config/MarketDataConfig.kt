package net.bobinski.portfolio.api.marketdata.config

import io.ktor.server.config.ApplicationConfig
import io.ktor.server.config.propertyOrNull

data class MarketDataConfig(
    val enabled: Boolean,
    val stockAnalystBaseUrl: String,
    val edoCalculatorBaseUrl: String,
    val goldApiBaseUrl: String,
    val goldApiKey: String?,
    val usdPlnSymbol: String,
    val goldBenchmarkSymbol: String,
    val equityBenchmarkSymbol: String,
    val bondBenchmarkSymbol: String
) {
    companion object {
        fun from(config: ApplicationConfig): MarketDataConfig = MarketDataConfig(
            enabled = readSetting("PORTFOLIO_MARKET_DATA_ENABLED", config, "portfolio.marketData.enabled")
                ?.let(::toBooleanStrictOrNullSafe)
                ?: true,
            stockAnalystBaseUrl = readSetting(
                "PORTFOLIO_STOCK_ANALYST_BASE_URL",
                config,
                "portfolio.marketData.stockAnalystBaseUrl"
            ) ?: "http://127.0.0.1:18080",
            edoCalculatorBaseUrl = readSetting(
                "PORTFOLIO_EDO_CALCULATOR_BASE_URL",
                config,
                "portfolio.marketData.edoCalculatorBaseUrl"
            ) ?: "http://127.0.0.1:18081",
            goldApiBaseUrl = readSetting(
                "PORTFOLIO_GOLD_API_BASE_URL",
                config,
                "portfolio.marketData.goldApiBaseUrl"
            ) ?: "https://api.gold-api.com",
            goldApiKey = readSetting(
                "PORTFOLIO_GOLD_API_KEY",
                config,
                "portfolio.marketData.goldApiKey"
            ),
            usdPlnSymbol = readSetting(
                "PORTFOLIO_USDPLN_SYMBOL",
                config,
                "portfolio.marketData.usdPlnSymbol"
            ) ?: "PLN=X",
            goldBenchmarkSymbol = readSetting(
                "PORTFOLIO_GOLD_BENCHMARK_SYMBOL",
                config,
                "portfolio.marketData.goldBenchmarkSymbol"
            ) ?: "GC=F",
            equityBenchmarkSymbol = readSetting(
                "PORTFOLIO_EQUITY_BENCHMARK_SYMBOL",
                config,
                "portfolio.marketData.equityBenchmarkSymbol"
            ) ?: "VWRA.L",
            bondBenchmarkSymbol = readSetting(
                "PORTFOLIO_BOND_BENCHMARK_SYMBOL",
                config,
                "portfolio.marketData.bondBenchmarkSymbol"
            ) ?: "ETFBTBSP.WA"
        )

        private fun readSetting(
            envKey: String,
            config: ApplicationConfig,
            configKey: String
        ): String? = System.getenv(envKey)
            ?.takeIf { it.isNotBlank() }
            ?: config.propertyOrNull(configKey)?.getString()

        private fun toBooleanStrictOrNullSafe(value: String): Boolean = when (value.trim().lowercase()) {
            "true" -> true
            "false" -> false
            else -> throw IllegalArgumentException("Unsupported boolean value: $value")
        }
    }
}
