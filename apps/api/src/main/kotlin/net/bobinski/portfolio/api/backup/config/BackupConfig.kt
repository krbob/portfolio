package net.bobinski.portfolio.api.backup.config

import io.ktor.server.config.ApplicationConfig
import io.ktor.server.config.propertyOrNull

data class BackupConfig(
    val enabled: Boolean,
    val directory: String,
    val intervalMinutes: Long,
    val retentionCount: Int
) {
    init {
        require(intervalMinutes > 0) { "Backup interval must be positive." }
        require(retentionCount > 0) { "Backup retention count must be positive." }
    }

    companion object {
        fun from(config: ApplicationConfig): BackupConfig = BackupConfig(
            enabled = readSetting("PORTFOLIO_BACKUPS_ENABLED", config, "portfolio.backups.enabled")
                ?.let(::toBooleanStrictOrNullSafe)
                ?: false,
            directory = readSetting("PORTFOLIO_BACKUPS_DIRECTORY", config, "portfolio.backups.directory")
                ?: "./data/backups",
            intervalMinutes = readSetting(
                "PORTFOLIO_BACKUPS_INTERVAL_MINUTES",
                config,
                "portfolio.backups.intervalMinutes"
            )?.toLongOrNull()
                ?: 1440L,
            retentionCount = readSetting(
                "PORTFOLIO_BACKUPS_RETENTION_COUNT",
                config,
                "portfolio.backups.retentionCount"
            )?.toIntOrNull()
                ?: 30
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
