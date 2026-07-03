package net.bobinski.portfolio.api.auth.config

import io.ktor.server.config.ApplicationConfig
import net.bobinski.portfolio.api.config.readSetting
import java.nio.charset.StandardCharsets
import java.security.MessageDigest

data class AuthConfig(
    val enabled: Boolean,
    val password: String,
    val sessionSecret: String,
    val sessionCookieName: String,
    val secureCookie: Boolean,
    val sessionMaxAgeDays: Long
) {
    companion object {
        fun from(config: ApplicationConfig, env: (String) -> String? = System::getenv): AuthConfig {
            val password = readSetting("PORTFOLIO_AUTH_PASSWORD", config, "portfolio.auth.password", env) ?: ""
            val enabled = readSetting("PORTFOLIO_AUTH_ENABLED", config, "portfolio.auth.enabled", env)
                ?.toBooleanStrictOrNull()
                ?: password.isNotBlank()

            return AuthConfig(
                enabled = enabled,
                password = password,
                sessionSecret = readSetting(
                    "PORTFOLIO_AUTH_SESSION_SECRET",
                    config,
                    "portfolio.auth.sessionSecret",
                    env
                )
                    ?: "",
                sessionCookieName = readSetting(
                    "PORTFOLIO_AUTH_SESSION_COOKIE_NAME",
                    config,
                    "portfolio.auth.sessionCookieName",
                    env
                ) ?: "portfolio_session",
                secureCookie = readSetting("PORTFOLIO_AUTH_SECURE_COOKIE", config, "portfolio.auth.secureCookie", env)
                    ?.toBooleanStrictOrNull()
                    ?: false,
                sessionMaxAgeDays = readSetting(
                    "PORTFOLIO_AUTH_SESSION_MAX_AGE_DAYS",
                    config,
                    "portfolio.auth.sessionMaxAgeDays",
                    env
                )?.toLongOrNull()
                    ?: 30L
            )
        }
    }
}

fun AuthConfig.modeName(): String = if (enabled) "PASSWORD" else "DISABLED"

fun AuthConfig.passwordFingerprint(): String =
    MessageDigest.getInstance("SHA-256")
        .digest(password.toByteArray())
        .joinToString(separator = "") { byte -> "%02x".format(byte) }
        .take(16)

fun AuthConfig.matchesPassword(candidate: String): Boolean =
    MessageDigest.isEqual(
        password.toByteArray(StandardCharsets.UTF_8),
        candidate.toByteArray(StandardCharsets.UTF_8)
    )
