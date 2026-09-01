package net.bobinski.portfolio.api.backup.config

import io.ktor.server.config.ApplicationConfig
import io.ktor.server.config.propertyOrNull

data class BackupConfig(
    val enabled: Boolean,
    val directory: String,
    val intervalMinutes: Long,
    val retentionCount: Int,
    val postChangeEnabled: Boolean = true,
    val postChangeDebounceSeconds: Long = 120,
    val postChangeMaxDelaySeconds: Long = 600,
    val postChangeRetentionCount: Int = 10,
    val safetyRetentionDays: Long = 30
) {
    init {
        require(intervalMinutes > 0) { "Backup interval must be positive." }
        require(retentionCount > 0) { "Backup retention count must be positive." }
        require(postChangeDebounceSeconds > 0) { "Post-change backup debounce must be positive." }
        require(postChangeMaxDelaySeconds >= postChangeDebounceSeconds) {
            "Post-change backup maximum delay must be at least the debounce delay."
        }
        require(postChangeRetentionCount > 0) { "Post-change backup retention count must be positive." }
        require(safetyRetentionDays > 0) { "Safety backup retention must be positive." }
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
                ?: 30,
            postChangeEnabled = readSetting(
                "PORTFOLIO_BACKUPS_POST_CHANGE_ENABLED",
                config,
                "portfolio.backups.postChangeEnabled"
            )?.let(::toBooleanStrictOrNullSafe)
                ?: true,
            postChangeDebounceSeconds = readSetting(
                "PORTFOLIO_BACKUPS_POST_CHANGE_DEBOUNCE_SECONDS",
                config,
                "portfolio.backups.postChangeDebounceSeconds"
            )?.toLongOrNull()
                ?: 120,
            postChangeMaxDelaySeconds = readSetting(
                "PORTFOLIO_BACKUPS_POST_CHANGE_MAX_DELAY_SECONDS",
                config,
                "portfolio.backups.postChangeMaxDelaySeconds"
            )?.toLongOrNull()
                ?: 600,
            postChangeRetentionCount = readSetting(
                "PORTFOLIO_BACKUPS_POST_CHANGE_RETENTION_COUNT",
                config,
                "portfolio.backups.postChangeRetentionCount"
            )?.toIntOrNull()
                ?: 10,
            safetyRetentionDays = readSetting(
                "PORTFOLIO_BACKUPS_SAFETY_RETENTION_DAYS",
                config,
                "portfolio.backups.safetyRetentionDays"
            )?.toLongOrNull()
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
