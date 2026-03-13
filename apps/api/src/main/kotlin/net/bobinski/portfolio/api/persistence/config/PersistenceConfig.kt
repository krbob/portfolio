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
            mode = config.propertyOrNull("portfolio.persistence.mode")?.getString()?.let(PersistenceMode::from)
                ?: PersistenceMode.MEMORY,
            jdbcUrl = config.propertyOrNull("portfolio.persistence.jdbcUrl")?.getString()
                ?: "jdbc:postgresql://127.0.0.1:15432/portfolio",
            username = config.propertyOrNull("portfolio.persistence.username")?.getString() ?: "portfolio",
            password = config.propertyOrNull("portfolio.persistence.password")?.getString() ?: "portfolio"
        )
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
