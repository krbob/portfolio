package net.bobinski.portfolio.api.plugins

import io.ktor.http.HttpHeaders
import io.ktor.server.application.Application
import io.ktor.server.application.ApplicationCall
import io.ktor.server.application.createApplicationPlugin
import io.ktor.server.application.install
import io.ktor.server.plugins.calllogging.CallLogging
import io.ktor.server.request.header
import io.ktor.server.response.header
import io.ktor.util.AttributeKey
import java.util.UUID

fun Application.configureMonitoring() {
    val metricsRegistry = RequestMetricsRegistry()
    attributes.put(REQUEST_METRICS_REGISTRY_KEY, metricsRegistry)

    install(RequestContextPlugin)
    install(CallLogging) {
        mdc("requestId") { call -> call.requestId }
    }
    install(RequestMetricsPlugin) {
        registry = metricsRegistry
    }
}

internal val ApplicationCall.requestId: String
    get() = attributes[REQUEST_ID_KEY]

internal fun Application.requestMetricsRegistry(): RequestMetricsRegistry =
    attributes[REQUEST_METRICS_REGISTRY_KEY]

private val RequestContextPlugin = createApplicationPlugin(name = "PortfolioRequestContext") {
    onCall { call ->
        val requestId = call.request.header(HttpHeaders.XRequestId)
            ?.takeIf(REQUEST_ID_PATTERN::matches)
            ?: UUID.randomUUID().toString()
        call.attributes.put(REQUEST_ID_KEY, requestId)
        call.response.header(HttpHeaders.XRequestId, requestId)
    }
}

private val REQUEST_ID_PATTERN = Regex("[A-Za-z0-9][A-Za-z0-9._:-]{0,127}")
private val REQUEST_ID_KEY = AttributeKey<String>("portfolio-request-id")
private val REQUEST_METRICS_REGISTRY_KEY = AttributeKey<RequestMetricsRegistry>("portfolio-request-metrics")
