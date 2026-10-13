package net.bobinski.portfolio.api.monitoring

import net.bobinski.portfolio.api.plugins.RequestMetricsRegistry
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class DurationHistogramTest {
    @Test
    fun `successful slow responses have cumulative buckets including exact thresholds`() {
        val registry = RequestMetricsRegistry()
        val slowMetric = "portfolio_http_slow_responses_total{route=\"/v1/portfolio/alerts\",threshold_seconds=\"20\"}"
        assertTrue(registry.scrape().contains("$slowMetric 0"))
        listOf(0L, 5_000_000_000, 5_000_000_001, 20_000_000_000, 29_400_000_000).forEach {
            registry.record("GET", "/v1/portfolio/alerts", 200, it)
        }
        val scrape = registry.scrape()
        assertTrue(scrape.contains("$slowMetric 1"))
        assertTrue(scrape.contains("portfolio_http_slow_responses_total{route=\"/v1/portfolio/alerts\",threshold_seconds=\"5\"} 3"))
        val labels = "method=\"GET\",route=\"/v1/portfolio/alerts\",status=\"200\""
        assertTrue(scrape.contains("# TYPE portfolio_http_request_duration_seconds histogram"))
        for ((bound, count) in listOf("5.0" to 2, "20.0" to 4, "+Inf" to 5)) {
            assertTrue(scrape.contains("portfolio_http_request_duration_seconds_bucket{$labels,le=\"$bound\"} $count"), scrape)
        }
    }

    @Test
    fun `queue and supplier timings are separate and labels cannot grow`() {
        val metrics = PortfolioMetrics()
        val size = metrics.scrape().lines().size
        metrics.upstreamDuration("stock-analyst", "history", "queue", 7_000_000_000)
        metrics.upstreamDuration("stock-analyst", "history", "request", 2_000_000_000)
        repeat(400) { metrics.upstreamDuration("private-$it", "secret-$it", "request", 1) }
        val scrape = metrics.scrape()
        assertEquals(size, scrape.lines().size)
        assertTrue(scrape.contains("portfolio_upstream_queue_duration_seconds_sum{upstream=\"stock-analyst\",operation=\"history\"} 7.000000000"))
        assertTrue(scrape.contains("portfolio_upstream_request_duration_seconds_sum{upstream=\"stock-analyst\",operation=\"history\"} 2.000000000"))
    }
}
