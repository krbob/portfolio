package net.bobinski.portfolio.api.auth.config

import io.ktor.server.config.ApplicationConfig
import io.ktor.server.config.propertyOrNull

data class AuthConfig(
    val enabled: Boolean,
    val password: String,
    val sessionSecret: String,
    val sessionCookieName: String,
    val secureCookie: Boolean,
    val sessionMaxAgeDays: Long
) {
    companion object {
        fun from(config: ApplicationConfig): AuthConfig {
            val password = readSetting("PORTFOLIO_AUTH_PASSWORD", config, "portfolio.auth.password") ?: ""
            val enabled = readSetting("PORTFOLIO_AUTH_ENABLED", config, "portfolio.auth.enabled")
                ?.toBooleanStrictOrNull()
                ?: password.isNotBlank()

            return AuthConfig(
                enabled = enabled,
                password = password,
                sessionSecret = readSetting("PORTFOLIO_AUTH_SESSION_SECRET", config, "portfolio.auth.sessionSecret")
                    ?: "",
                sessionCookieName = readSetting(
                    "PORTFOLIO_AUTH_SESSION_COOKIE_NAME",
                    config,
                    "portfolio.auth.sessionCookieName"
                ) ?: "portfolio_session",
                secureCookie = readSetting("PORTFOLIO_AUTH_SECURE_COOKIE", config, "portfolio.auth.secureCookie")
                    ?.toBooleanStrictOrNull()
                    ?: false,
                sessionMaxAgeDays = readSetting(
                    "PORTFOLIO_AUTH_SESSION_MAX_AGE_DAYS",
                    config,
                    "portfolio.auth.sessionMaxAgeDays"
                )?.toLongOrNull()
                    ?: 30L
            )
        }

        private fun readSetting(
            envKey: String,
            config: ApplicationConfig,
            configKey: String
        ): String? = System.getenv(envKey)
            ?.takeIf { it.isNotBlank() }
            ?: config.propertyOrNull(configKey)?.getString()
    }
}

fun AuthConfig.modeName(): String = if (enabled) "PASSWORD" else "DISABLED"

fun AuthConfig.passwordFingerprint(): String =
    java.security.MessageDigest.getInstance("SHA-256")
        .digest(password.toByteArray())
        .joinToString(separator = "") { byte -> "%02x".format(byte) }
        .take(16)
