package net.bobinski.portfolio.api.persistence.config

import io.ktor.server.config.ApplicationConfig
import io.ktor.server.config.propertyOrNull

data class PersistenceConfig(
    val databasePath: String,
    val journalMode: JournalMode,
    val synchronousMode: SynchronousMode,
    val busyTimeoutMs: Int
) {
    companion object {
        fun from(config: ApplicationConfig): PersistenceConfig = PersistenceConfig(
            databasePath = readSetting(
                "PORTFOLIO_DATABASE_PATH",
                config,
                "portfolio.persistence.databasePath"
            ) ?: "./data/portfolio.db",
            journalMode = readSetting(
                "PORTFOLIO_JOURNAL_MODE",
                config,
                "portfolio.persistence.journalMode"
            )?.let(JournalMode::from) ?: JournalMode.WAL,
            synchronousMode = readSetting(
                "PORTFOLIO_SYNCHRONOUS_MODE",
                config,
                "portfolio.persistence.synchronousMode"
            )?.let(SynchronousMode::from) ?: SynchronousMode.FULL,
            busyTimeoutMs = readIntSetting(
                "PORTFOLIO_BUSY_TIMEOUT_MS",
                config,
                "portfolio.persistence.busyTimeoutMs"
            ) ?: 5_000
        )

        private fun readSetting(
            envKey: String,
            config: ApplicationConfig,
            configKey: String
        ): String? = System.getProperty(envKey)
            ?.takeIf { it.isNotBlank() }
            ?: System.getenv(envKey)
            ?.takeIf { it.isNotBlank() }
            ?: config.propertyOrNull(configKey)?.getString()

        private fun readIntSetting(
            envKey: String,
            config: ApplicationConfig,
            configKey: String
        ): Int? {
            val rawValue = readSetting(envKey, config, configKey) ?: return null
            return rawValue.toIntOrNull()
                ?: throw IllegalArgumentException("Invalid integer value for $configKey: $rawValue")
        }
    }
}

enum class JournalMode {
    DELETE,
    TRUNCATE,
    PERSIST,
    MEMORY,
    WAL,
    OFF;

    companion object {
        fun from(value: String): JournalMode = try {
            valueOf(value.trim().uppercase())
        } catch (_: IllegalArgumentException) {
            throw IllegalArgumentException("Unsupported SQLite journal mode: $value")
        }
    }
}

enum class SynchronousMode {
    OFF,
    NORMAL,
    FULL;

    companion object {
        fun from(value: String): SynchronousMode = try {
            valueOf(value.trim().uppercase())
        } catch (_: IllegalArgumentException) {
            throw IllegalArgumentException("Unsupported SQLite synchronous mode: $value")
        }
    }
}
