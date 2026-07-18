package net.bobinski.portfolio.api.plugins

import io.ktor.http.HttpMethod
import io.ktor.server.application.createApplicationPlugin
import io.ktor.server.application.hooks.ResponseSent
import io.ktor.server.request.httpMethod
import io.ktor.server.request.path
import io.ktor.util.AttributeKey
import java.util.Locale
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.LongAdder

internal class RequestMetricsConfig {
    lateinit var registry: RequestMetricsRegistry
}

internal val RequestMetricsPlugin = createApplicationPlugin(
    name = "PortfolioRequestMetrics",
    createConfiguration = ::RequestMetricsConfig
) {
    val registry = pluginConfig.registry

    onCall { call ->
        if (call.request.path() !in EXCLUDED_PATHS) {
            call.attributes.put(REQUEST_STARTED_AT_NANOS, System.nanoTime())
        }
    }
    on(ResponseSent) { call ->
        val startedAt = call.attributes.getOrNull(REQUEST_STARTED_AT_NANOS) ?: return@on
        if (call.attributes.contains(METRICS_RECORDED)) return@on
        call.attributes.put(METRICS_RECORDED, true)
        registry.record(
            method = call.request.httpMethod.metricLabel(),
            route = call.request.path().normalizedRoute(),
            status = call.response.status()?.value ?: 500,
            durationNanos = (System.nanoTime() - startedAt).coerceAtLeast(0)
        )
    }
}

internal class RequestMetricsRegistry {
    private val samples = ConcurrentHashMap<MetricKey, MetricSample>()
    private val seriesLock = Any()

    fun record(method: String, route: String, status: Int, durationNanos: Long) {
        val requestedKey = MetricKey(method, route, status)
        val sample = samples[requestedKey] ?: synchronized(seriesLock) {
            samples[requestedKey] ?: when {
                samples.size < MAX_METRIC_SERIES - 1 -> MetricSample().also { samples[requestedKey] = it }
                else -> samples.computeIfAbsent(OVERFLOW_KEY) { MetricSample() }
            }
        }
        sample.record(durationNanos)
    }

    fun scrape(): String = buildString {
        appendLine("# HELP portfolio_http_requests_total Completed API requests.")
        appendLine("# TYPE portfolio_http_requests_total counter")
        orderedSamples().forEach { (key, sample) ->
            append("portfolio_http_requests_total")
            append(key.labels())
            append(' ')
            appendLine(sample.count.sum())
        }
        appendLine("# HELP portfolio_http_request_duration_seconds API request latency.")
        appendLine("# TYPE portfolio_http_request_duration_seconds summary")
        orderedSamples().forEach { (key, sample) ->
            append("portfolio_http_request_duration_seconds_sum")
            append(key.labels())
            append(' ')
            appendLine(String.format(Locale.ROOT, "%.9f", sample.totalNanos.sum() / NANOS_PER_SECOND))
            append("portfolio_http_request_duration_seconds_count")
            append(key.labels())
            append(' ')
            appendLine(sample.count.sum())
        }
    }

    private fun orderedSamples(): List<Map.Entry<MetricKey, MetricSample>> =
        samples.entries.sortedWith(
            compareBy<Map.Entry<MetricKey, MetricSample>>(
                { it.key.route },
                { it.key.method },
                { it.key.status }
            )
        )
}

private data class MetricKey(
    val method: String,
    val route: String,
    val status: Int
) {
    fun labels(): String = "{method=\"$method\",route=\"$route\",status=\"$status\"}"
}

private class MetricSample {
    val count = LongAdder()
    val totalNanos = LongAdder()

    fun record(durationNanos: Long) {
        count.increment()
        totalNanos.add(durationNanos)
    }
}

private fun HttpMethod.metricLabel(): String = when (this) {
    HttpMethod.Get -> "GET"
    HttpMethod.Post -> "POST"
    HttpMethod.Put -> "PUT"
    HttpMethod.Patch -> "PATCH"
    HttpMethod.Delete -> "DELETE"
    HttpMethod.Options -> "OPTIONS"
    HttpMethod.Head -> "HEAD"
    else -> "OTHER"
}

private fun String.normalizedRoute(): String = when {
    this in STATIC_ROUTES -> this
    ENTITY_ID_ROUTE.matches(this) -> ENTITY_ID_ROUTE.replace(this, "\$1/{id}")
    IMPORT_PROFILE_ID_ROUTE.matches(this) -> "/v1/transactions/import/profiles/{id}"
    else -> "unmatched"
}

private const val NANOS_PER_SECOND = 1_000_000_000.0
private const val MAX_METRIC_SERIES = 256
private val REQUEST_STARTED_AT_NANOS = AttributeKey<Long>("portfolio-request-metrics-started-at")
private val METRICS_RECORDED = AttributeKey<Boolean>("portfolio-request-metrics-recorded")
private val OVERFLOW_KEY = MetricKey("OTHER", "overflow", 0)
private val EXCLUDED_PATHS = setOf("/v1/health", "/v1/readiness", "/metrics", "/v1/openapi.json")
private val ENTITY_ID_ROUTE = Regex("^(/v1/(?:accounts|instruments|transactions))/[^/]+$")
private val IMPORT_PROFILE_ID_ROUTE = Regex("^/v1/transactions/import/profiles/[^/]+$")
private val STATIC_ROUTES = setOf(
    "/",
    "/v1/meta",
    "/v1/readiness/details",
    "/v1/auth/session",
    "/v1/accounts",
    "/v1/instruments",
    "/v1/transactions",
    "/v1/transactions/import",
    "/v1/transactions/import/preview",
    "/v1/transactions/import/profiles",
    "/v1/transactions/import/csv",
    "/v1/transactions/import/csv/preview",
    "/v1/portfolio/overview",
    "/v1/portfolio/holdings",
    "/v1/portfolio/accounts",
    "/v1/portfolio/history/daily",
    "/v1/portfolio/returns",
    "/v1/portfolio/allocation",
    "/v1/portfolio/allocation/contribution-plan",
    "/v1/portfolio/allocation/manual-contribution-preview",
    "/v1/portfolio/allocation/withdrawal-plan",
    "/v1/portfolio/targets",
    "/v1/portfolio/target-schedule",
    "/v1/portfolio/benchmark-settings",
    "/v1/portfolio/rebalancing-settings",
    "/v1/portfolio/withdrawal-settings",
    "/v1/portfolio/alerts",
    "/v1/portfolio/alerts/dispatch",
    "/v1/portfolio/alert-settings",
    "/v1/portfolio/read-model-cache",
    "/v1/portfolio/read-model-cache/invalidate",
    "/v1/portfolio/read-model-refresh",
    "/v1/portfolio/read-model-refresh/run",
    "/v1/portfolio/market-data-snapshots",
    "/v1/portfolio/audit/events",
    "/v1/portfolio/backups",
    "/v1/portfolio/backups/download",
    "/v1/portfolio/backups/run",
    "/v1/portfolio/backups/restore",
    "/v1/portfolio/state/export",
    "/v1/portfolio/state/preview",
    "/v1/portfolio/state/import",
    "/v1/push/config",
    "/v1/push/subscriptions"
)
