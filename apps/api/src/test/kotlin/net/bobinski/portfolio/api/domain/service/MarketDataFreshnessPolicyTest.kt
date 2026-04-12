package net.bobinski.portfolio.api.domain.service

import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class MarketDataFreshnessPolicyTest {

    @Test
    fun `london daily series tolerates long holiday weekends`() {
        val policy = policyAt("2026-04-07T20:00:00Z")

        assertFalse(
            policy.isDailySeriesStale(
                valuedAt = LocalDate.parse("2026-04-02"),
                asOf = LocalDate.parse("2026-04-07"),
                symbolHint = "VWRA.L"
            )
        )
    }

    @Test
    fun `warsaw daily series waits for evening publish window`() {
        val policy = policyAt("2026-03-16T16:30:00Z")

        assertFalse(
            policy.isDailySeriesStale(
                valuedAt = LocalDate.parse("2026-03-13"),
                asOf = LocalDate.parse("2026-03-16"),
                symbolHint = "ETFBTBSP.WA"
            )
        )
    }

    @Test
    fun `fx series waits for utc end of day publish window`() {
        val policy = policyAt("2026-03-16T20:00:00Z")

        assertFalse(
            policy.isDailySeriesStale(
                valuedAt = LocalDate.parse("2026-03-13"),
                asOf = LocalDate.parse("2026-03-16"),
                symbolHint = "PLN=X"
            )
        )
    }

    @Test
    fun `gold futures series waits for chicago settlement window`() {
        val policy = policyAt("2026-03-16T22:30:00Z")

        assertFalse(
            policy.isDailySeriesStale(
                valuedAt = LocalDate.parse("2026-03-13"),
                asOf = LocalDate.parse("2026-03-16"),
                symbolHint = "GC=F"
            )
        )
    }

    @Test
    fun `warsaw daily series becomes stale after missing enough trading days`() {
        val policy = policyAt("2026-03-18T20:00:00Z")

        assertTrue(
            policy.isDailySeriesStale(
                valuedAt = LocalDate.parse("2026-03-13"),
                asOf = LocalDate.parse("2026-03-18"),
                symbolHint = "ETFBTBSP.WA"
            )
        )
    }

    private fun policyAt(instant: String) = MarketDataFreshnessPolicy(
        clock = Clock.fixed(Instant.parse(instant), ZoneOffset.UTC),
        staleAfterTradingDays = 3
    )
}
