package net.bobinski.portfolio.api.marketdata.service

import java.math.BigDecimal
import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.time.YearMonth
import java.time.ZoneOffset
import kotlinx.coroutines.runBlocking
import net.bobinski.portfolio.api.config.AppJsonFactory
import net.bobinski.portfolio.api.domain.service.AppPreferenceService
import net.bobinski.portfolio.api.marketdata.model.HistoricalPricePoint
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryAppPreferenceRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

class MarketDataSnapshotCacheServiceTest {

    @Test
    fun `list snapshots summarizes cached quote series and inflation coverage`() = runBlocking {
        val repository = InMemoryAppPreferenceRepository()
        val json = AppJsonFactory.create()

        fun snapshotCacheAt(instant: String) = MarketDataSnapshotCacheService(
            appPreferenceService = AppPreferenceService(
                repository = repository,
                json = json,
                clock = Clock.fixed(Instant.parse(instant), ZoneOffset.UTC)
            )
        )

        snapshotCacheAt("2026-03-27T12:00:00Z").putSeries(
            identity = "VWRA.L",
            prices = listOf(
                HistoricalPricePoint(
                    date = LocalDate.parse("2026-03-01"),
                    closePricePln = BigDecimal("101.10")
                ),
                HistoricalPricePoint(
                    date = LocalDate.parse("2026-03-03"),
                    closePricePln = BigDecimal("102.45")
                )
            )
        )
        snapshotCacheAt("2026-03-27T12:05:00Z").putQuote(
            identity = "PLN=X",
            valuation = InstrumentValuation(
                pricePerUnitPln = BigDecimal("3.9876"),
                valuedAt = LocalDate.parse("2026-03-26")
            )
        )
        snapshotCacheAt("2026-03-27T12:10:00Z").putMonthlyInflation(
            listOf(
                MonthlyInflationPoint(
                    month = YearMonth.parse("2026-01"),
                    multiplier = BigDecimal("1.002")
                ),
                MonthlyInflationPoint(
                    month = YearMonth.parse("2026-02"),
                    multiplier = BigDecimal("1.003")
                )
            )
        )
        snapshotCacheAt("2026-03-27T12:15:00Z").putCumulativeInflation(
            InflationAdjustmentResult.Success(
                from = YearMonth.parse("2026-01"),
                until = YearMonth.parse("2026-03"),
                multiplier = BigDecimal("1.005006")
            )
        )

        val snapshots = snapshotCacheAt("2026-03-27T12:20:00Z").listSnapshots()

        assertEquals(
            listOf("2026-01", "inflation.monthly", "PLN=X", "VWRA.L"),
            snapshots.map(MarketDataSnapshotSummary::identity)
        )

        val inflationWindow = snapshots.first { it.snapshotType == "INFLATION_WINDOW" }
        assertEquals("2026-01", inflationWindow.sourceFrom)
        assertEquals("2026-02", inflationWindow.sourceTo)
        assertEquals("2026-03", inflationWindow.sourceAsOf)
        assertEquals(null, inflationWindow.pointCount)

        val monthlyInflation = snapshots.first { it.snapshotType == "INFLATION_MONTHLY" }
        assertEquals("2026-01", monthlyInflation.sourceFrom)
        assertEquals("2026-02", monthlyInflation.sourceTo)
        assertEquals("2026-02", monthlyInflation.sourceAsOf)
        assertEquals(2, monthlyInflation.pointCount)

        val quote = snapshots.first { it.snapshotType == "QUOTE" }
        assertEquals("2026-03-26", quote.sourceFrom)
        assertEquals("2026-03-26", quote.sourceTo)
        assertEquals("2026-03-26", quote.sourceAsOf)
        assertEquals(1, quote.pointCount)

        val series = snapshots.first { it.snapshotType == "PRICE_SERIES" }
        assertEquals("2026-03-01", series.sourceFrom)
        assertEquals("2026-03-03", series.sourceTo)
        assertEquals("2026-03-03", series.sourceAsOf)
        assertEquals(2, series.pointCount)
    }
}
