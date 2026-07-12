package net.bobinski.portfolio.api.route

import io.ktor.http.HttpStatusCode
import io.ktor.http.HttpHeaders
import io.ktor.server.application.Application
import io.ktor.server.application.ApplicationCall
import io.ktor.server.application.call
import io.ktor.server.request.receive
import io.ktor.server.plugins.origin
import io.ktor.server.response.header
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.delete
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.route
import io.ktor.server.sessions.clear
import io.ktor.server.sessions.get
import io.ktor.server.sessions.sessions
import io.ktor.server.sessions.set
import kotlinx.serialization.Serializable
import net.bobinski.portfolio.api.auth.config.AuthConfig
import net.bobinski.portfolio.api.auth.LoginAttemptLimiter
import net.bobinski.portfolio.api.auth.config.matchesPassword
import net.bobinski.portfolio.api.auth.config.modeName
import net.bobinski.portfolio.api.auth.config.passwordFingerprint
import net.bobinski.portfolio.api.plugins.ApiErrorCode
import net.bobinski.portfolio.api.plugins.PortfolioSession
import net.bobinski.portfolio.api.plugins.respondError

fun Route.authRoute(application: Application) {
    val authConfig = AuthConfig.from(application.environment.config)
    val passwordFingerprint = authConfig.passwordFingerprint()
    val loginAttemptLimiter = LoginAttemptLimiter()

    route("/v1/auth") {
        get("/session") {
            val activeSession = call.sessions.get<PortfolioSession>()
            call.respond(
                AuthSessionResponse(
                    authEnabled = authConfig.enabled,
                    authenticated = authConfig.enabled.not() || activeSession?.passwordFingerprint == passwordFingerprint,
                    mode = authConfig.modeName()
                )
            )
        }.documented(
            operationId = "getAuthSession",
            summary = "Get current authentication session",
            description = "Returns whether password authentication is enabled and whether the current session is authenticated.",
            tag = "Authentication"
        )

        post("/session") {
            call.createAuthSession(authConfig, passwordFingerprint, loginAttemptLimiter)
        }.documented(
            operationId = "createAuthSession",
            summary = "Create an authentication session",
            description = "Authenticates the current client using the configured password and creates a session cookie.",
            tag = "Authentication"
        )

        delete("/session") {
            call.sessions.clear<PortfolioSession>()
            call.respond(
                AuthSessionResponse(
                    authEnabled = authConfig.enabled,
                    authenticated = authConfig.enabled.not(),
                    mode = authConfig.modeName()
                )
            )
        }.documented(
            operationId = "deleteAuthSession",
            summary = "Clear the authentication session",
            description = "Clears the current session cookie and returns the resulting authentication state.",
            tag = "Authentication"
        )
    }
}

private suspend fun ApplicationCall.createAuthSession(
    authConfig: AuthConfig,
    passwordFingerprint: String,
    loginAttemptLimiter: LoginAttemptLimiter
) {
    if (!authConfig.enabled) {
        respond(
            AuthSessionResponse(
                authEnabled = false,
                authenticated = true,
                mode = authConfig.modeName()
            )
        )
        return
    }

    // Deliberately key by the transport peer instead of trusting spoofable forwarding headers.
    // Behind the bundled reverse proxy this becomes a shared, bounded single-user login budget.
    val transportPeerKey = request.origin.remoteHost.take(MAX_TRANSPORT_PEER_KEY_LENGTH)
    loginAttemptLimiter.retryAfterSeconds(transportPeerKey)?.let { retryAfterSeconds ->
        response.header(HttpHeaders.RetryAfter, retryAfterSeconds.toString())
        respondError(
            HttpStatusCode.TooManyRequests,
            "Too many login attempts. Retry later.",
            ApiErrorCode.RATE_LIMITED,
            retryable = true
        )
        return
    }

    val payload = receive<CreateAuthSessionRequest>()
    if (!authConfig.matchesPassword(payload.password)) {
        respondToFailedLogin(loginAttemptLimiter, transportPeerKey)
        return
    }

    loginAttemptLimiter.recordSuccess(transportPeerKey)
    sessions.set(PortfolioSession(passwordFingerprint = passwordFingerprint))
    respond(
        AuthSessionResponse(
            authEnabled = true,
            authenticated = true,
            mode = authConfig.modeName()
        )
    )
}

private suspend fun ApplicationCall.respondToFailedLogin(
    loginAttemptLimiter: LoginAttemptLimiter,
    transportPeerKey: String
) {
    val retryAfterSeconds = loginAttemptLimiter.recordFailure(transportPeerKey)
    if (retryAfterSeconds != null) {
        response.header(HttpHeaders.RetryAfter, retryAfterSeconds.toString())
        respondError(
            HttpStatusCode.TooManyRequests,
            "Too many login attempts. Retry later.",
            ApiErrorCode.RATE_LIMITED,
            retryable = true
        )
        return
    }
    respondError(
        HttpStatusCode.Unauthorized,
        "Invalid password.",
        ApiErrorCode.INVALID_CREDENTIALS
    )
}

@Serializable
data class CreateAuthSessionRequest(
    val password: String
)

@Serializable
data class AuthSessionResponse(
    val authEnabled: Boolean,
    val authenticated: Boolean,
    val mode: String
)

private const val MAX_TRANSPORT_PEER_KEY_LENGTH = 128
