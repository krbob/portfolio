package net.bobinski.portfolio.api.plugins

import io.ktor.server.application.Application
import io.ktor.server.application.install
import io.ktor.server.auth.Authentication
import io.ktor.server.auth.authenticate
import io.ktor.server.auth.session
import io.ktor.server.routing.Route
import io.ktor.server.sessions.SessionTransportTransformerEncrypt
import io.ktor.server.sessions.Sessions
import io.ktor.server.sessions.cookie
import io.ktor.util.hex
import java.security.MessageDigest
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec
import kotlinx.serialization.Serializable
import net.bobinski.portfolio.api.auth.config.AuthConfig
import net.bobinski.portfolio.api.auth.config.passwordFingerprint

private const val PORTFOLIO_AUTH_NAME = "portfolio-session"

fun Application.configureAuthentication() {
    val authConfig = AuthConfig.from(environment.config)

    install(Sessions) {
        cookie<PortfolioSession>(authConfig.sessionCookieName) {
            cookie.path = "/"
            cookie.httpOnly = true
            cookie.secure = authConfig.secureCookie
            cookie.extensions["SameSite"] = "lax"
            cookie.maxAgeInSeconds = authConfig.sessionMaxAgeDays * 24 * 60 * 60
            if (authConfig.enabled) {
                transform(
                    SessionTransportTransformerEncrypt(
                        authConfig.sessionSecret.sha256Bytes(),
                        authConfig.sessionSecret.hmacKeyBytes()
                    )
                )
            }
        }
    }

    if (!authConfig.enabled) {
        return
    }

    val sessionFingerprint = authConfig.passwordFingerprint()
    install(Authentication) {
        session<PortfolioSession>(PORTFOLIO_AUTH_NAME) {
            validate { session ->
                if (session.passwordFingerprint == sessionFingerprint) session else null
            }
            challenge {
                call.respondUnauthorized("Authentication required.")
            }
        }
    }
}

fun Route.protectedRoute(application: Application, build: Route.() -> Unit) {
    val authConfig = AuthConfig.from(application.environment.config)
    if (authConfig.enabled) {
        authenticate(PORTFOLIO_AUTH_NAME, build = build)
        return
    }

    build()
}

private fun String.sha256Bytes(): ByteArray {
    val digest = MessageDigest.getInstance("SHA-256")
    return digest.digest(toByteArray()).copyOf(16)
}

private fun String.hmacKeyBytes(): ByteArray {
    val mac = Mac.getInstance("HmacSHA256")
    mac.init(SecretKeySpec(toByteArray(), "HmacSHA256"))
    return mac.doFinal("portfolio-session-signing".toByteArray())
}

@Serializable
data class PortfolioSession(
    val passwordFingerprint: String
)
