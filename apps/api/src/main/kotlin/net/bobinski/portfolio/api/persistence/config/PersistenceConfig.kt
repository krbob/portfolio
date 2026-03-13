package net.bobinski.portfolio.api.persistence.config

import io.ktor.server.config.ApplicationConfig
import io.ktor.server.config.propertyOrNull

data class PersistenceConfig(
    val mode: PersistenceMode,
    val jdbcUrl: String,
    val username: String,
    val password: String
) {
    val isPostgresEnabled: Boolean get() = mode == PersistenceMode.POSTGRES

    companion object {
        fun from(config: ApplicationConfig): PersistenceConfig = PersistenceConfig(
            mode = readSetting("PORTFOLIO_PERSISTENCE_MODE", config, "portfolio.persistence.mode")
                ?.let(PersistenceMode::from)
                ?: PersistenceMode.MEMORY,
            jdbcUrl = readSetting("PORTFOLIO_DB_JDBC_URL", config, "portfolio.persistence.jdbcUrl")
                ?: "jdbc:postgresql://127.0.0.1:15432/portfolio",
            username = readSetting("PORTFOLIO_DB_USERNAME", config, "portfolio.persistence.username")
                ?: "portfolio",
            password = readSetting("PORTFOLIO_DB_PASSWORD", config, "portfolio.persistence.password")
                ?: "portfolio"
        )

        private fun readSetting(
            envKey: String,
            config: ApplicationConfig,
            configKey: String
        ): String? = System.getenv(envKey)
            ?.takeIf { it.isNotBlank() }
            ?: config.propertyOrNull(configKey)?.getString()
    }
}

enum class PersistenceMode {
    MEMORY,
    POSTGRES;

    companion object {
        fun from(value: String): PersistenceMode = try {
            valueOf(value.trim().uppercase())
        } catch (_: IllegalArgumentException) {
            throw IllegalArgumentException("Unsupported persistence mode: $value")
        }
    }
}
