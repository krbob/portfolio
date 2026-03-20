package net.bobinski.portfolio.api.readmodel.config

import io.ktor.server.config.ApplicationConfig
import io.ktor.server.config.propertyOrNull

data class ReadModelRefreshConfig(
    val enabled: Boolean,
    val intervalMinutes: Long,
    val runOnStart: Boolean
) {
    init {
        require(intervalMinutes > 0) { "Read-model refresh interval must be positive." }
    }

    companion object {
        fun from(config: ApplicationConfig): ReadModelRefreshConfig = ReadModelRefreshConfig(
            enabled = readSetting("PORTFOLIO_READ_MODEL_REFRESH_ENABLED", config, "portfolio.readModelRefresh.enabled")
                ?.let(::toBooleanStrictOrNullSafe)
                ?: false,
            intervalMinutes = readSetting(
                "PORTFOLIO_READ_MODEL_REFRESH_INTERVAL_MINUTES",
                config,
                "portfolio.readModelRefresh.intervalMinutes"
            )?.toLongOrNull()
                ?: 720L,
            runOnStart = readSetting(
                "PORTFOLIO_READ_MODEL_REFRESH_RUN_ON_START",
                config,
                "portfolio.readModelRefresh.runOnStart"
            )?.let(::toBooleanStrictOrNullSafe)
                ?: true
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
