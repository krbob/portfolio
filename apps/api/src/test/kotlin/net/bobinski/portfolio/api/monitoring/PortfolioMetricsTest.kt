package net.bobinski.portfolio.api.monitoring

import java.math.BigDecimal
import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import kotlinx.coroutines.runBlocking
import net.bobinski.portfolio.api.config.AppJsonFactory
import net.bobinski.portfolio.api.domain.service.OperationalStateService
import net.bobinski.portfolio.api.marketdata.service.InstrumentValuation
import net.bobinski.portfolio.api.marketdata.service.MarketDataSnapshotCacheService
import net.bobinski.portfolio.api.marketdata.service.MarketDataSnapshotStatus
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryOperationalStateRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class PortfolioMetricsTest {
    @Test
    fun `snapshot recovery clears current failure while preserving the failure counter`() = runBlocking {
        val metrics = PortfolioMetrics()
        val cache = MarketDataSnapshotCacheService(
            OperationalStateService(InMemoryOperationalStateRepository(), AppJsonFactory.create(), Clock.systemUTC()),
            metrics = metrics
        )
        val quote = InstrumentValuation(pricePerUnitPln = BigDecimal("100"), valuedAt = LocalDate.parse("2026-10-08"))
        cache.putQuote("stock-quote:PRIVATE", quote)
        cache.recordQuoteFailure("stock-quote:PRIVATE", "temporary failure")
        assertEquals(MarketDataSnapshotStatus.FAILED, cache.listSnapshots().single().status)
        assertTrue(metrics.scrape().contains("portfolio_market_data_checks_total{type=\"QUOTE\",outcome=\"failure\"} 1"))
        assertTrue(metrics.scrape().contains("portfolio_market_data_fallbacks_total{type=\"QUOTE\"} 0"))
        cache.recordFallback("QUOTE")
        cache.putQuote("stock-quote:PRIVATE", quote)
        assertEquals(MarketDataSnapshotStatus.FRESH, cache.listSnapshots().single().status)
        assertEquals(0, cache.listSnapshots().single().failureCount)
        val scrape = metrics.scrape()
        assertTrue(scrape.contains("portfolio_market_data_checks_total{type=\"QUOTE\",outcome=\"failure\"} 1"))
        assertTrue(scrape.contains("portfolio_market_data_checks_total{type=\"QUOTE\",outcome=\"success\"} 2"))
        assertTrue(scrape.contains("portfolio_market_data_fallbacks_total{type=\"QUOTE\"} 1"))
        assertFalse(scrape.contains("PRIVATE"))
        assertFalse(scrape.contains("temporary failure"))
    }

    @Test
    fun `no valuation is reported as healthy before observation and unknown labels remain bounded`() {
        val metrics = PortfolioMetrics()
        val initial = metrics.scrape()
        assertFalse(initial.contains("portfolio_valuation_complete"))
        repeat(400) { metrics.upstreamRequest("host-$it", "symbol-$it", "error-$it") }
        val after = metrics.scrape()
        assertEquals(initial.lines().size, after.lines().size)
        assertTrue(after.contains("portfolio_upstream_requests_total{upstream=\"other\",operation=\"other\",outcome=\"other\"} 400"))
        metrics.valuationFailed(Instant.ofEpochSecond(100))
        assertTrue(metrics.scrape().contains("portfolio_valuation_complete 0"))
        assertFalse(metrics.scrape().contains("portfolio_valuation_last_success_timestamp_seconds"))
    }
}
