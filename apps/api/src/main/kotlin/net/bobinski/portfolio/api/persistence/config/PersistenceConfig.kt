package net.bobinski.portfolio.api.persistence.config

import io.ktor.server.config.ApplicationConfig

data class PersistenceConfig(
    val mode: PersistenceMode,
    val jdbcUrl: String,
    val username: String,
    val password: String
) {
    val isPostgresEnabled: Boolean get() = mode == PersistenceMode.POSTGRES

    companion object {
        fun from(config: ApplicationConfig): PersistenceConfig = PersistenceConfig(
            mode = config.property("portfolio.persistence.mode").getString().let(PersistenceMode::from),
            jdbcUrl = config.property("portfolio.persistence.jdbcUrl").getString(),
            username = config.property("portfolio.persistence.username").getString(),
            password = config.property("portfolio.persistence.password").getString()
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
