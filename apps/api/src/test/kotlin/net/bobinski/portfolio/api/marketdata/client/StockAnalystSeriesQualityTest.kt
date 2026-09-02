package net.bobinski.portfolio.api.marketdata.client

import net.bobinski.portfolio.api.marketdata.model.HistoricalPricePoint
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertSame
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import java.math.BigDecimal
import java.time.Instant
import java.time.LocalDate

class StockAnalystSeriesQualityTest {
    @Test
    fun `rejects a hundredfold terminal drop in a split-adjusted series`() {
        val history = history(
            adjustment = "SPLIT_ADJUSTED",
            "2026-08-28" to "719.84",
            "2026-09-01" to "7.12"
        )

        val exception = assertThrows<MarketDataClientException> {
            history.requirePlausibleSplitAdjustedSeries("VWRA.L")
        }

        assertEquals("IMPLAUSIBLE_SPLIT_ADJUSTED_SERIES", exception.errorCode)
        assertEquals(true, exception.retryable)
        assertEquals("VWRA.L", exception.symbol)
    }

    @Test
    fun `rejects a hundredfold rebound in a split-adjusted series`() {
        val history = history(
            adjustment = "split_adjusted",
            "2026-09-01" to "7.12",
            "2026-09-02" to "719.84"
        )

        assertThrows<MarketDataClientException> {
            history.requirePlausibleSplitAdjustedSeries("VWRA.L")
        }
    }

    @Test
    fun `rejects non-positive split-adjusted closes`() {
        listOf("0.00", "-1.00").forEach { close ->
            val history = history(
                adjustment = "SPLIT_ADJUSTED",
                "2026-09-01" to close
            )

            val exception = assertThrows<MarketDataClientException> {
                history.requirePlausibleSplitAdjustedSeries("VWRA.L")
            }

            assertEquals("IMPLAUSIBLE_SPLIT_ADJUSTED_SERIES", exception.errorCode)
        }
    }

    @Test
    fun `accepts ordinary split-adjusted market moves`() {
        val history = history(
            adjustment = "SPLIT_ADJUSTED",
            "2026-08-28" to "719.84",
            "2026-09-01" to "712.00",
            "2026-09-02" to "720.17"
        )

        assertSame(history, history.requirePlausibleSplitAdjustedSeries("VWRA.L"))
    }

    @Test
    fun `does not infer an adjacent jump across a long coverage gap`() {
        val history = history(
            adjustment = "SPLIT_ADJUSTED",
            "2020-01-02" to "10.00",
            "2026-09-02" to "600.00"
        )

        assertSame(history, history.requirePlausibleSplitAdjustedSeries("EXAMPLE"))
    }

    @Test
    fun `leaves raw histories to their declared upstream semantics`() {
        val history = history(
            adjustment = "RAW",
            "2026-08-28" to "719.84",
            "2026-09-01" to "7.12"
        )

        assertSame(history, history.requirePlausibleSplitAdjustedSeries("VWRA.L"))
    }

    @Test
    fun `reusable point validation detects non-positive cached values without provenance`() {
        val points = history(
            adjustment = "RAW",
            "2026-09-01" to "0.00"
        ).prices

        assertEquals("non-positive close on 2026-09-01", points.seriesQualityIssue()?.description)
    }

    @Test
    fun `reusable point validation rejects an exact fiftyfold short-gap change`() {
        val points = history(
            adjustment = "RAW",
            "2026-08-28" to "500.00",
            "2026-09-01" to "10.00"
        ).prices

        assertEquals(
            "50x close-price jump between 2026-08-28 and 2026-09-01",
            points.seriesQualityIssue()?.description
        )
    }

    private fun history(
        adjustment: String,
        vararg prices: Pair<String, String>
    ) = StockAnalystHistory(
        prices = prices.map { (date, close) ->
            HistoricalPricePoint(
                date = LocalDate.parse(date),
                closePricePln = BigDecimal(close)
            )
        },
        provenance = StockAnalystDataProvenance(
            source = "YAHOO_FINANCE",
            retrievedAt = Instant.parse("2026-09-02T08:00:00Z"),
            marketTimestamp = null,
            marketDate = LocalDate.parse("2026-09-02"),
            currency = "PLN",
            unitScale = 1.0,
            adjustment = adjustment,
            coverageFrom = prices.firstOrNull()?.first?.let(LocalDate::parse),
            coverageTo = prices.lastOrNull()?.first?.let(LocalDate::parse),
            status = "FRESH"
        )
    )
}
