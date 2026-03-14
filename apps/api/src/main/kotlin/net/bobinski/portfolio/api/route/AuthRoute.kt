package net.bobinski.portfolio.api.route

import io.ktor.http.HttpStatusCode
import io.ktor.server.application.Application
import io.ktor.server.application.call
import io.ktor.server.request.receive
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
import net.bobinski.portfolio.api.auth.config.modeName
import net.bobinski.portfolio.api.auth.config.passwordFingerprint
import net.bobinski.portfolio.api.plugins.ErrorResponse
import net.bobinski.portfolio.api.plugins.PortfolioSession

fun Route.authRoute(application: Application) {
    val authConfig = AuthConfig.from(application.environment.config)
    val passwordFingerprint = authConfig.passwordFingerprint()

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
        }

        post("/session") {
            if (!authConfig.enabled) {
                call.respond(
                    AuthSessionResponse(
                        authEnabled = false,
                        authenticated = true,
                        mode = authConfig.modeName()
                    )
                )
                return@post
            }

            val payload = call.receive<CreateAuthSessionRequest>()
            if (payload.password != authConfig.password) {
                call.respond(HttpStatusCode.Unauthorized, ErrorResponse("Invalid password."))
                return@post
            }

            call.sessions.set(PortfolioSession(passwordFingerprint = passwordFingerprint))
            call.respond(
                AuthSessionResponse(
                    authEnabled = true,
                    authenticated = true,
                    mode = authConfig.modeName()
                )
            )
        }

        delete("/session") {
            call.sessions.clear<PortfolioSession>()
            call.respond(
                AuthSessionResponse(
                    authEnabled = authConfig.enabled,
                    authenticated = authConfig.enabled.not(),
                    mode = authConfig.modeName()
                )
            )
        }
    }
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
