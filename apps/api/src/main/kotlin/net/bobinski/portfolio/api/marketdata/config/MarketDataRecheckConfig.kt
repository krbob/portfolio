package net.bobinski.portfolio.api.marketdata.config

import io.ktor.server.config.ApplicationConfig
import io.ktor.server.config.propertyOrNull

data class MarketDataRecheckConfig(
    val enabled: Boolean,
    val intervalMinutes: Long,
    val runOnStart: Boolean,
    val baseRetryMinutes: Long,
    val maxRetryMinutes: Long,
    val seriesLookbackDays: Long,
    val inflationLookbackMonths: Long
) {
    init {
        require(intervalMinutes > 0) { "Market data recheck interval must be positive." }
        require(baseRetryMinutes > 0) { "Market data recheck base retry must be positive." }
        require(maxRetryMinutes >= baseRetryMinutes) { "Market data recheck max retry must be >= base retry." }
        require(seriesLookbackDays > 0) { "Market data recheck series lookback must be positive." }
        require(inflationLookbackMonths > 0) { "Market data recheck inflation lookback must be positive." }
    }

    companion object {
        fun from(config: ApplicationConfig): MarketDataRecheckConfig = MarketDataRecheckConfig(
            enabled = readSetting(
                "PORTFOLIO_MARKET_DATA_RECHECK_ENABLED",
                config,
                "portfolio.marketData.recheck.enabled"
            )?.let(::toBooleanStrictOrNullSafe)
                ?: false,
            intervalMinutes = readSetting(
                "PORTFOLIO_MARKET_DATA_RECHECK_INTERVAL_MINUTES",
                config,
                "portfolio.marketData.recheck.intervalMinutes"
            )?.toLongOrNull()
                ?: 15L,
            runOnStart = readSetting(
                "PORTFOLIO_MARKET_DATA_RECHECK_RUN_ON_START",
                config,
                "portfolio.marketData.recheck.runOnStart"
            )?.let(::toBooleanStrictOrNullSafe)
                ?: true,
            baseRetryMinutes = readSetting(
                "PORTFOLIO_MARKET_DATA_RECHECK_BASE_RETRY_MINUTES",
                config,
                "portfolio.marketData.recheck.baseRetryMinutes"
            )?.toLongOrNull()
                ?: 30L,
            maxRetryMinutes = readSetting(
                "PORTFOLIO_MARKET_DATA_RECHECK_MAX_RETRY_MINUTES",
                config,
                "portfolio.marketData.recheck.maxRetryMinutes"
            )?.toLongOrNull()
                ?: 120L,
            seriesLookbackDays = readSetting(
                "PORTFOLIO_MARKET_DATA_RECHECK_SERIES_LOOKBACK_DAYS",
                config,
                "portfolio.marketData.recheck.seriesLookbackDays"
            )?.toLongOrNull()
                ?: 14L,
            inflationLookbackMonths = readSetting(
                "PORTFOLIO_MARKET_DATA_RECHECK_INFLATION_LOOKBACK_MONTHS",
                config,
                "portfolio.marketData.recheck.inflationLookbackMonths"
            )?.toLongOrNull()
                ?: 6L
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
