package net.bobinski.portfolio.api.route

import io.ktor.server.application.Application
import io.ktor.server.config.propertyOrNull
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.route
import kotlinx.serialization.Serializable
import net.bobinski.portfolio.api.persistence.config.PersistenceConfig

fun Route.systemRoute(application: Application) {
    route("/v1") {
        get("/health") {
            call.respond(
                HealthResponse(
                    status = "ok",
                    name = application.appName(),
                    stage = application.appStage(),
                    version = application.appVersion(),
                    persistenceMode = application.persistenceMode()
                )
            )
        }

        get("/meta") {
            call.respond(
                AppMetaResponse(
                    name = application.appName(),
                    stage = application.appStage(),
                    version = application.appVersion(),
                    persistenceMode = application.persistenceMode(),
                    stack = StackSummary(
                        web = "React 19 + TypeScript + Vite",
                        api = "Kotlin 2.3 + Ktor 3",
                        database = "PostgreSQL (planned)"
                    ),
                    capabilities = listOf(
                        "Transaction-based portfolio accounting",
                        "Full daily history reconstruction",
                        "ETF pricing via stock-analyst",
                        "EDO valuation via edo-calculator"
                    )
                )
            )
        }
    }
}

private fun Application.appName(): String =
    environment.config.propertyOrNull("portfolio.name")?.getString() ?: "Portfolio"

private fun Application.appStage(): String =
    environment.config.propertyOrNull("portfolio.stage")?.getString() ?: "dev"

private fun Application.appVersion(): String = this::class.java.`package`.implementationVersion ?: "0.1.0-dev"

private fun Application.persistenceMode(): String = PersistenceConfig.from(environment.config).mode.name

@Serializable
data class HealthResponse(
    val status: String,
    val name: String,
    val stage: String,
    val version: String,
    val persistenceMode: String
)

@Serializable
data class AppMetaResponse(
    val name: String,
    val stage: String,
    val version: String,
    val persistenceMode: String,
    val stack: StackSummary,
    val capabilities: List<String>
)

@Serializable
data class StackSummary(
    val web: String,
    val api: String,
    val database: String
)
