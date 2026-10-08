package net.bobinski.portfolio.api.monitoring

import java.time.Instant
import java.util.concurrent.atomic.LongAdder
import net.bobinski.portfolio.api.route.PortfolioOverviewResponse

/** Fixed label sets: symbols, account IDs, dates, URLs and error messages never become labels. */
class PortfolioMetrics {
    private val requests = MetricCounter("portfolio_upstream_requests_total", "Completed upstream HTTP attempts.",
        mapOf("upstream" to UPSTREAMS, "operation" to OPERATIONS, "outcome" to OUTCOMES))
    private val retries = MetricCounter("portfolio_upstream_retries_total", "Retries after a busy upstream response.",
        mapOf("upstream" to UPSTREAMS, "operation" to OPERATIONS))
    private val checks = MetricCounter("portfolio_market_data_checks_total", "Snapshot refresh outcomes after retries.",
        mapOf("type" to SNAPSHOT_TYPES, "outcome" to listOf("success", "failure")))
    private val fallbacks = MetricCounter("portfolio_market_data_fallbacks_total", "Accepted cached data after a provider failure.",
        mapOf("type" to SNAPSHOT_TYPES))
    private val refreshes = MetricCounter("portfolio_read_model_refreshes_total", "Background or manual analytics refresh outcomes.",
        mapOf("trigger" to listOf("STARTUP", "SCHEDULED", "MANUAL"), "outcome" to listOf("success", "degraded", "failure")))

    @Volatile private var valuation: ValuationObservation? = null

    fun upstreamRequest(upstream: String, operation: String, outcome: String) =
        requests.increment(upstream.bounded(UPSTREAMS), operation.bounded(OPERATIONS), outcome.bounded(OUTCOMES))
    fun upstreamRetry(upstream: String, operation: String) =
        retries.increment(upstream.bounded(UPSTREAMS), operation.bounded(OPERATIONS))
    fun snapshotCheck(type: String, success: Boolean) = checks.increment(type, if (success) "success" else "failure")
    fun fallback(type: String) = fallbacks.increment(type)
    fun refresh(trigger: String, outcome: String) = refreshes.increment(trigger, outcome)

    fun observeValuation(result: PortfolioOverviewResponse, complete: Boolean, at: Instant) {
        valuation = ValuationObservation(
            attemptedAt = at.epochSecond,
            lastSuccessAt = if (complete) at.epochSecond else valuation?.lastSuccessAt,
            complete = complete,
            active = result.activeHoldingCount,
            valued = result.valuedHoldingCount,
            issues = result.valuationIssueCount,
            missingFx = result.missingFxTransactions
        )
    }

    fun valuationFailed(at: Instant) {
        valuation = valuation?.copy(attemptedAt = at.epochSecond, complete = false)
            ?: ValuationObservation(at.epochSecond, null, false, 0, 0, 1, 0)
    }

    fun scrape(): String = buildString {
        listOf(requests, retries, checks, fallbacks, refreshes).forEach { append(it.scrape()) }
        valuation?.let { observation ->
            gauge("portfolio_valuation_last_attempt_timestamp_seconds", observation.attemptedAt)
            observation.lastSuccessAt?.let { gauge("portfolio_valuation_last_success_timestamp_seconds", it) }
            gauge("portfolio_valuation_complete", if (observation.complete) 1 else 0)
            gauge("portfolio_valuation_holdings", observation.active, "state=\"active\"")
            sample("portfolio_valuation_holdings", observation.valued, "state=\"valued\"")
            gauge("portfolio_valuation_issues", observation.issues, "kind=\"valuation\"")
            sample("portfolio_valuation_issues", observation.missingFx, "kind=\"missing_fx\"")
        }
    }

    companion object {
        val SNAPSHOT_TYPES = listOf("QUOTE", "PRICE_SERIES", "INFLATION_MONTHLY", "INFLATION_WINDOW")
        private val UPSTREAMS = listOf("stock-analyst", "edo-calculator", "other")
        private val OPERATIONS = listOf("quote", "history", "value", "inflation", "monthly-inflation", "other")
        private val OUTCOMES = listOf("success", "http_4xx", "http_429", "http_5xx", "timeout", "transport_error", "other")
    }
}

private data class ValuationObservation(
    val attemptedAt: Long, val lastSuccessAt: Long?, val complete: Boolean,
    val active: Int, val valued: Int, val issues: Int, val missingFx: Int
)

private fun String.bounded(allowed: List<String>): String = takeIf { it in allowed } ?: "other"

private class MetricCounter(private val name: String, private val help: String, labels: Map<String, List<String>>) {
    private val names = labels.keys.toList()
    // Preinitialize every series so increase() sees the first event after a zero scrape.
    private val counts = labels.values.fold(listOf(emptyList<String>())) { keys, values ->
        keys.flatMap { key -> values.map { key + it } }
    }.associateWith { LongAdder() }

    fun increment(vararg values: String) { counts.getValue(values.toList()).increment() }
    fun scrape(): String = buildString {
        appendLine("# HELP $name $help")
        appendLine("# TYPE $name counter")
        counts.forEach { (values, count) ->
            sample(name, count.sum(), names.zip(values).joinToString(",") { (key, value) -> "$key=\"$value\"" })
        }
    }
}

internal fun StringBuilder.gauge(name: String, value: Number, labels: String = "") {
    appendLine("# TYPE $name gauge")
    sample(name, value, labels)
}

internal fun StringBuilder.sample(name: String, value: Number, labels: String = "") {
    append(name)
    if (labels.isNotEmpty()) append("{$labels}")
    appendLine(" $value")
}
