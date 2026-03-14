package net.bobinski.portfolio.api.persistence.config

import io.ktor.server.config.ApplicationConfig
import io.ktor.server.config.propertyOrNull

data class PersistenceConfig(
    val mode: PersistenceMode,
    val jdbcUrl: String,
    val username: String,
    val password: String,
    val sqlite: SqliteConfig
) {
    val isPostgresEnabled: Boolean get() = mode == PersistenceMode.POSTGRES
    val isSqliteEnabled: Boolean get() = mode == PersistenceMode.SQLITE

    companion object {
        fun from(config: ApplicationConfig): PersistenceConfig = PersistenceConfig(
            mode = readSetting("PORTFOLIO_PERSISTENCE_MODE", config, "portfolio.persistence.mode")
                ?.let(PersistenceMode::from)
                ?: PersistenceMode.SQLITE,
            jdbcUrl = readSetting("PORTFOLIO_DB_JDBC_URL", config, "portfolio.persistence.jdbcUrl")
                ?: "jdbc:postgresql://127.0.0.1:15432/portfolio",
            username = readSetting("PORTFOLIO_DB_USERNAME", config, "portfolio.persistence.username")
                ?: "portfolio",
            password = readSetting("PORTFOLIO_DB_PASSWORD", config, "portfolio.persistence.password")
                ?: "portfolio",
            sqlite = SqliteConfig(
                databasePath = readSetting(
                    "PORTFOLIO_SQLITE_DATABASE_PATH",
                    config,
                    "portfolio.persistence.sqlite.databasePath"
                ) ?: "./data/portfolio.db",
                journalMode = readSetting(
                    "PORTFOLIO_SQLITE_JOURNAL_MODE",
                    config,
                    "portfolio.persistence.sqlite.journalMode"
                )?.let(SqliteJournalMode::from) ?: SqliteJournalMode.WAL,
                synchronousMode = readSetting(
                    "PORTFOLIO_SQLITE_SYNCHRONOUS_MODE",
                    config,
                    "portfolio.persistence.sqlite.synchronousMode"
                )?.let(SqliteSynchronousMode::from) ?: SqliteSynchronousMode.FULL,
                busyTimeoutMs = readIntSetting(
                    "PORTFOLIO_SQLITE_BUSY_TIMEOUT_MS",
                    config,
                    "portfolio.persistence.sqlite.busyTimeoutMs"
                ) ?: 5_000
            )
        )

        private fun readSetting(
            envKey: String,
            config: ApplicationConfig,
            configKey: String
        ): String? = System.getenv(envKey)
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

data class SqliteConfig(
    val databasePath: String,
    val journalMode: SqliteJournalMode,
    val synchronousMode: SqliteSynchronousMode,
    val busyTimeoutMs: Int
)

enum class PersistenceMode {
    MEMORY,
    POSTGRES,
    SQLITE;

    companion object {
        fun from(value: String): PersistenceMode = try {
            valueOf(value.trim().uppercase())
        } catch (_: IllegalArgumentException) {
            throw IllegalArgumentException("Unsupported persistence mode: $value")
        }
    }
}

enum class SqliteJournalMode {
    DELETE,
    TRUNCATE,
    PERSIST,
    MEMORY,
    WAL,
    OFF;

    companion object {
        fun from(value: String): SqliteJournalMode = try {
            valueOf(value.trim().uppercase())
        } catch (_: IllegalArgumentException) {
            throw IllegalArgumentException("Unsupported SQLite journal mode: $value")
        }
    }
}

enum class SqliteSynchronousMode {
    OFF,
    NORMAL,
    FULL;

    companion object {
        fun from(value: String): SqliteSynchronousMode = try {
            valueOf(value.trim().uppercase())
        } catch (_: IllegalArgumentException) {
            throw IllegalArgumentException("Unsupported SQLite synchronous mode: $value")
        }
    }
}
