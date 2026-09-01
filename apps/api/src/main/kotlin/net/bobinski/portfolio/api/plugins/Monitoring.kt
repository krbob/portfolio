package net.bobinski.portfolio.api.plugins

import io.ktor.http.HttpHeaders
import io.ktor.server.application.Application
import io.ktor.server.application.ApplicationCall
import io.ktor.server.application.createApplicationPlugin
import io.ktor.server.application.install
import io.ktor.server.plugins.calllogging.CallLogging
import io.ktor.server.plugins.calllogging.processingTimeMillis
import io.ktor.server.request.header
import io.ktor.server.request.httpMethod
import io.ktor.server.request.path
import io.ktor.server.response.header
import io.ktor.util.AttributeKey
import java.util.UUID
import org.slf4j.event.Level

fun Application.configureMonitoring() {
    val metricsRegistry = RequestMetricsRegistry()
    attributes.put(REQUEST_METRICS_REGISTRY_KEY, metricsRegistry)

    install(RequestContextPlugin)
    install(CallLogging) {
        level = Level.INFO
        disableDefaultColors()
        filter { call -> shouldLogAccessPath(call.request.path()) }
        mdc("requestId") { call -> call.requestId }
        format { call ->
            formatAccessLog(
                method = call.request.httpMethod.value,
                path = call.request.path(),
                status = call.response.status()?.value,
                durationMillis = call.processingTimeMillis()
            )
        }
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
private val ACCESS_LOG_EXCLUDED_PATHS = setOf("/v1/health", "/metrics")

internal fun shouldLogAccessPath(path: String): Boolean = path !in ACCESS_LOG_EXCLUDED_PATHS

internal fun formatAccessLog(
    method: String,
    path: String,
    status: Int?,
    durationMillis: Long
): String = buildString {
    append("event=http_request")
    append(" method=")
    append(method.toLogValue())
    append(" path=")
    append(path.toLogValue())
    append(" status=")
    append(status?.toString() ?: "unhandled")
    append(" durationMs=")
    append(durationMillis.coerceAtLeast(0))
}

private fun String.toLogValue(): String = buildString {
    append('"')
    this@toLogValue.forEach { character ->
        when (character) {
            '\\' -> append("\\\\")
            '"' -> append("\\\"")
            '\r' -> append("\\r")
            '\n' -> append("\\n")
            else -> append(character)
        }
    }
    append('"')
}
