package net.bobinski.portfolio.api.route

import io.ktor.server.application.Application
import io.ktor.server.config.propertyOrNull
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.route
import kotlinx.serialization.Serializable
import net.bobinski.portfolio.api.auth.config.AuthConfig
import net.bobinski.portfolio.api.marketdata.config.MarketDataConfig
import net.bobinski.portfolio.api.system.SystemReadiness
import net.bobinski.portfolio.api.system.SystemReadinessCheck
import net.bobinski.portfolio.api.system.SystemReadinessService
import org.koin.ktor.ext.inject

fun Route.systemRoute(application: Application) {
    val authConfig = AuthConfig.from(application.environment.config)
    val marketDataConfig = MarketDataConfig.from(application.environment.config)
    val readinessService: SystemReadinessService by inject()

    route("/v1") {
        get("/health") {
            call.respond(
                HealthResponse(
                    status = "ok",
                    name = application.appName(),
                    stage = application.appStage(),
                    version = application.appVersion(),
                    persistenceMode = PERSISTENCE_MODE,
                    authEnabled = authConfig.enabled
                )
            )
        }.documented(
            operationId = "getHealth",
            summary = "Get the API health status",
            description = "Returns the basic liveness payload with application name, stage, version and auth mode.",
            tag = "System"
        )

        get("/meta") {
            call.respond(
                AppMetaResponse(
                    name = application.appName(),
                    stage = application.appStage(),
                    version = application.appVersion(),
                    persistenceMode = PERSISTENCE_MODE,
                    auth = AuthSummary(
                        enabled = authConfig.enabled,
                        mode = if (authConfig.enabled) "PASSWORD" else "DISABLED"
                    ),
                    stack = StackSummary(
                        web = "React 19 + TypeScript + Vite",
                        api = "Kotlin 2.3 + Ktor 3",
                        database = DATABASE_SUMMARY
                    ),
                    stockAnalystUiUrl = marketDataConfig.stockAnalystUiUrl,
                    capabilities = listOf(
                        "Transaction-based portfolio accounting",
                        "Full daily history reconstruction",
                        "ETF pricing via stock-analyst",
                        "EDO valuation via edo-calculator",
                        "Server-side backup snapshots"
                    )
                )
            )
        }.documented(
            operationId = "getAppMeta",
            summary = "Get application metadata",
            description = "Returns application metadata, stack details and high-level feature capabilities.",
            tag = "System"
        )

        get("/readiness") {
            call.respond(readinessService.current().toResponse())
        }.documented(
            operationId = "getReadiness",
            summary = "Get system readiness checks",
            description = "Returns the latest readiness evaluation for storage, market data, backups and authentication.",
            tag = "System"
        )
    }
}

private fun Application.appName(): String =
    environment.config.propertyOrNull("portfolio.name")?.getString() ?: "Portfolio"

private fun Application.appStage(): String =
    environment.config.propertyOrNull("portfolio.stage")?.getString() ?: "dev"

private fun Application.appVersion(): String = this::class.java.`package`.implementationVersion ?: "0.1.0-dev"

private const val PERSISTENCE_MODE = "SQLITE"
private const val DATABASE_SUMMARY = "SQLite"

@Serializable
data class HealthResponse(
    val status: String,
    val name: String,
    val stage: String,
    val version: String,
    val persistenceMode: String,
    val authEnabled: Boolean
)

@Serializable
data class AppMetaResponse(
    val name: String,
    val stage: String,
    val version: String,
    val persistenceMode: String,
    val auth: AuthSummary,
    val stack: StackSummary,
    val stockAnalystUiUrl: String? = null,
    val capabilities: List<String>
)

@Serializable
data class ReadinessResponse(
    val status: String,
    val checkedAt: String,
    val checks: List<ReadinessCheckResponse>
)

@Serializable
data class ReadinessCheckResponse(
    val key: String,
    val label: String,
    val status: String,
    val message: String,
    val details: Map<String, String> = emptyMap()
)

@Serializable
data class AuthSummary(
    val enabled: Boolean,
    val mode: String
)

@Serializable
data class StackSummary(
    val web: String,
    val api: String,
    val database: String
)

private fun SystemReadiness.toResponse(): ReadinessResponse = ReadinessResponse(
    status = status.name,
    checkedAt = checkedAt.toString(),
    checks = checks.map(SystemReadinessCheck::toResponse)
)

private fun SystemReadinessCheck.toResponse(): ReadinessCheckResponse = ReadinessCheckResponse(
    key = key,
    label = label,
    status = status.name,
    message = message,
    details = details
)
