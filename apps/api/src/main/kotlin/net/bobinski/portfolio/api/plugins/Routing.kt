package net.bobinski.portfolio.api.plugins

import io.ktor.http.ContentType
import io.ktor.openapi.OpenApiDoc
import io.ktor.openapi.OpenApiInfo
import io.ktor.server.application.Application
import io.ktor.server.application.call
import io.ktor.server.plugins.openapi.openAPI
import io.ktor.server.response.respondText
import io.ktor.server.routing.get
import io.ktor.server.routing.routing
import io.ktor.server.routing.openapi.OpenApiDocSource
import net.bobinski.portfolio.api.route.documented
import net.bobinski.portfolio.api.route.authRoute
import net.bobinski.portfolio.api.route.accountRoute
import net.bobinski.portfolio.api.route.instrumentRoute
import net.bobinski.portfolio.api.route.portfolioOperationsRoute
import net.bobinski.portfolio.api.route.portfolioRoute
import net.bobinski.portfolio.api.route.portfolioSettingsRoute
import net.bobinski.portfolio.api.route.systemRoute
import net.bobinski.portfolio.api.route.transactionImportRoute
import net.bobinski.portfolio.api.route.transactionRoute

fun Application.configureRouting() {
    routing {
        get("/") {
            call.respondText("Portfolio API")
        }.documented(
            operationId = "getApiBanner",
            summary = "Get the API root banner",
            description = "Returns a plain-text banner confirming that the Portfolio API is reachable.",
            tag = "System"
        )

        get("/v1/openapi.json") {
            val source = OpenApiDocSource.Routing(
                contentType = ContentType.Application.Json
            )
            val document = source.read(
                call.application,
                OpenApiDoc(
                    info = OpenApiInfo(
                        title = "Portfolio API",
                        version = "0.1.0",
                        description = "Portfolio accounting, valuation, history, rebalancing and operational workflows API."
                    )
                )
            )
            call.respondText(document.content, document.contentType)
        }.documented(
            operationId = "getOpenApiDocument",
            summary = "Export the OpenAPI document",
            description = "Returns the generated OpenAPI specification for the Portfolio API as JSON.",
            tag = "System"
        )

        if (this@configureRouting.openApiUiEnabled()) {
            openAPI("/openapi") {
                info = OpenApiInfo(
                    title = "Portfolio API",
                    version = "0.1.0",
                    description = "Portfolio accounting, valuation, history, rebalancing and operational workflows API."
                )
                outputPath = "build/openapi-ui"
                source = OpenApiDocSource.Routing(
                    contentType = ContentType.Application.Json
                )
            }
        }

        systemRoute(this@configureRouting)
        authRoute(this@configureRouting)
        protectedRoute(this@configureRouting) {
            accountRoute()
            instrumentRoute()
            portfolioRoute()
            portfolioSettingsRoute()
            portfolioOperationsRoute()
            transactionImportRoute()
            transactionRoute()
        }
    }
}

private fun Application.openApiUiEnabled(): Boolean =
    System.getenv("PORTFOLIO_OPENAPI_UI_ENABLED")
        ?.toBooleanStrictOrNull()
        ?: environment.config
            .propertyOrNull("portfolio.openapi.uiEnabled")
            ?.getString()
            ?.toBooleanStrictOrNull()
        ?: (
            environment.config
                .propertyOrNull("portfolio.stage")
                ?.getString()
                ?.lowercase() != "test"
        )
