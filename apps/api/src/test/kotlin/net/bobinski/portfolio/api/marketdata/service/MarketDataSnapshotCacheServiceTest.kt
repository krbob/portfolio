package net.bobinski.portfolio.api.marketdata.service

import java.math.BigDecimal
import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.time.YearMonth
import java.time.ZoneOffset
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import net.bobinski.portfolio.api.config.AppJsonFactory
import net.bobinski.portfolio.api.domain.model.OperationalStateEntry
import net.bobinski.portfolio.api.domain.repository.OperationalStateRepository
import net.bobinski.portfolio.api.domain.service.OperationalStateService
import net.bobinski.portfolio.api.marketdata.client.StockAnalystDataProvenance
import net.bobinski.portfolio.api.marketdata.model.HistoricalPricePoint
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryOperationalStateRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test

class MarketDataSnapshotCacheServiceTest {

    @Test
    fun `stock provenance survives snapshot persistence and a later failed refresh`() = runBlocking {
        val snapshotCache = snapshotCache()
        val provenance = stockProvenance()
        snapshotCache.putSeries(
            identity = "stock-history:VWRA.L",
            from = LocalDate.parse("2026-03-01"),
            to = LocalDate.parse("2026-03-20"),
            prices = listOf(price("2026-03-20", "102.45")),
            provenance = provenance
        )
        snapshotCache.recordSeriesFailure(
            identity = "stock-history:VWRA.L",
            reason = "Rate limit exceeded."
        )

        val stored = snapshotCache.listSnapshots().single().provenance

        assertNotNull(stored)
        assertEquals("YAHOO_FINANCE", stored?.source)
        assertEquals("2026-03-20T20:01:02Z", stored?.retrievedAt)
        assertEquals("2026-03-20T20:00:00Z", stored?.marketTimestamp)
        assertEquals("2026-03-20", stored?.marketDate)
        assertEquals("USD", stored?.currency)
        assertEquals(1.0, stored?.unitScale)
        assertEquals("SPLIT_ADJUSTED", stored?.adjustment)
        assertEquals("2026-03-01", stored?.coverageFrom)
        assertEquals("2026-03-20", stored?.coverageTo)
        assertEquals("FRESH", stored?.status)
    }

    @Test
    fun `series lookup distinguishes full partial and missing coverage without treating market gaps as missing`() = runBlocking {
        val snapshotCache = snapshotCache()
        snapshotCache.putSeries(
            identity = "stock-history:VWRA.L",
            from = LocalDate.parse("2026-03-01"),
            to = LocalDate.parse("2026-03-10"),
            prices = listOf(
                price("2026-03-03", "101.10"),
                price("2026-03-06", "102.45")
            )
        )

        val contained = snapshotCache.lookupSeries(
            identity = "stock-history:VWRA.L",
            from = LocalDate.parse("2026-03-02"),
            to = LocalDate.parse("2026-03-09")
        )
        val overlapping = snapshotCache.lookupSeries(
            identity = "stock-history:VWRA.L",
            from = LocalDate.parse("2026-02-28"),
            to = LocalDate.parse("2026-03-05")
        )
        val missing = snapshotCache.lookupSeries(
            identity = "stock-history:VWRA.L",
            from = LocalDate.parse("2026-04-01"),
            to = LocalDate.parse("2026-04-02")
        )

        assertEquals(MarketDataSnapshotCoverage.FULL, contained.coverage)
        assertEquals(listOf(LocalDate.parse("2026-03-03"), LocalDate.parse("2026-03-06")), contained.prices.map { it.date })
        assertEquals(MarketDataSnapshotCoverage.PARTIAL, overlapping.coverage)
        assertEquals(
            listOf(MarketDataCoverageRange(LocalDate.parse("2026-02-28"), LocalDate.parse("2026-02-28"))),
            overlapping.missingRanges
        )
        assertEquals(MarketDataSnapshotCoverage.MISS, missing.coverage)
    }

    @Test
    fun `successful empty prehistory range is a full cache hit`() = runBlocking {
        val snapshotCache = snapshotCache()
        val from = LocalDate.parse("1900-01-01")
        val to = LocalDate.parse("1900-01-31")

        snapshotCache.putSeries(
            identity = "stock-history:VWRA.L",
            from = from,
            to = to,
            prices = emptyList()
        )

        val lookup = snapshotCache.lookupSeries(identity = "stock-history:VWRA.L", from = from, to = to)
        val legacyView = snapshotCache.getSeries(identity = "stock-history:VWRA.L", from = from, to = to)

        assertEquals(MarketDataSnapshotCoverage.FULL, lookup.coverage)
        assertEquals(emptyList<HistoricalPricePoint>(), lookup.prices)
        assertNotNull(legacyView)
        assertEquals(emptyList<HistoricalPricePoint>(), legacyView)
    }

    @Test
    fun `separate successful ranges stay partial across a gap until the gap is covered`() = runBlocking {
        val snapshotCache = snapshotCache()
        val identity = "reference:VWRA.L:PLN"
        snapshotCache.putSeries(
            identity = identity,
            from = LocalDate.parse("2026-03-01"),
            to = LocalDate.parse("2026-03-03"),
            prices = listOf(price("2026-03-03", "101.10"))
        )
        snapshotCache.putSeries(
            identity = identity,
            from = LocalDate.parse("2026-03-05"),
            to = LocalDate.parse("2026-03-07"),
            prices = listOf(price("2026-03-06", "102.45"))
        )

        val partial = snapshotCache.lookupSeries(
            identity = identity,
            from = LocalDate.parse("2026-03-01"),
            to = LocalDate.parse("2026-03-07")
        )

        assertEquals(MarketDataSnapshotCoverage.PARTIAL, partial.coverage)
        assertEquals(
            listOf(MarketDataCoverageRange(LocalDate.parse("2026-03-04"), LocalDate.parse("2026-03-04"))),
            partial.missingRanges
        )
        assertNull(
            snapshotCache.getSeries(
                identity = identity,
                from = LocalDate.parse("2026-03-01"),
                to = LocalDate.parse("2026-03-07")
            )
        )

        snapshotCache.putSeries(
            identity = identity,
            from = LocalDate.parse("2026-03-04"),
            to = LocalDate.parse("2026-03-04"),
            prices = emptyList()
        )

        val full = snapshotCache.lookupSeries(
            identity = identity,
            from = LocalDate.parse("2026-03-01"),
            to = LocalDate.parse("2026-03-07")
        )
        assertEquals(MarketDataSnapshotCoverage.FULL, full.coverage)
        assertEquals(emptyList<MarketDataCoverageRange>(), full.missingRanges)
        assertEquals(2, full.prices.size)
    }

    @Test
    fun `legacy point-only snapshot is partial until requested coverage is recorded`() = runBlocking {
        val snapshotCache = snapshotCache()
        val identity = "stock-history:legacy"
        snapshotCache.putSeries(
            identity = identity,
            prices = listOf(price("2026-03-03", "101.10"), price("2026-03-06", "102.45"))
        )

        val lookup = snapshotCache.lookupSeries(
            identity = identity,
            from = LocalDate.parse("2026-03-03"),
            to = LocalDate.parse("2026-03-06")
        )

        assertEquals(MarketDataSnapshotCoverage.PARTIAL, lookup.coverage)
        assertNull(
            snapshotCache.getSeries(
                identity = identity,
                from = LocalDate.parse("2026-03-03"),
                to = LocalDate.parse("2026-03-06")
            )
        )
    }

    @Test
    fun `concurrent range updates preserve the union of points and coverage`() = runBlocking {
        val repository = DelayedOperationalStateRepository(InMemoryOperationalStateRepository())
        val firstSnapshotCache = snapshotCache(repository)
        val secondSnapshotCache = snapshotCache(repository)
        val identity = "fx-history:USD"

        coroutineScope {
            listOf(
                async(Dispatchers.Default) {
                    firstSnapshotCache.putSeries(
                        identity = identity,
                        from = LocalDate.parse("2026-03-01"),
                        to = LocalDate.parse("2026-03-03"),
                        prices = listOf(price("2026-03-02", "3.80"))
                    )
                },
                async(Dispatchers.Default) {
                    secondSnapshotCache.putSeries(
                        identity = identity,
                        from = LocalDate.parse("2026-03-04"),
                        to = LocalDate.parse("2026-03-06"),
                        prices = listOf(price("2026-03-05", "3.85"))
                    )
                }
            ).awaitAll()
        }

        val lookup = firstSnapshotCache.lookupSeries(
            identity = identity,
            from = LocalDate.parse("2026-03-01"),
            to = LocalDate.parse("2026-03-06")
        )
        assertEquals(MarketDataSnapshotCoverage.FULL, lookup.coverage)
        assertEquals(listOf(LocalDate.parse("2026-03-02"), LocalDate.parse("2026-03-05")), lookup.prices.map { it.date })
    }

    @Test
    fun `backfilling older coverage does not regress the newest source date`() = runBlocking {
        val repository = InMemoryOperationalStateRepository()

        fun snapshotCacheAt(instant: String): MarketDataSnapshotCacheService {
            val clock = fixedClock(instant)
            return MarketDataSnapshotCacheService(
                operationalStateService = OperationalStateService(
                    repository = repository,
                    json = AppJsonFactory.create(),
                    clock = clock
                ),
                clock = clock
            )
        }

        snapshotCacheAt("2026-03-27T12:00:00Z").putSeries(
            identity = "stock-history:VWRA.L",
            from = LocalDate.parse("2026-03-19"),
            to = LocalDate.parse("2026-03-20"),
            prices = listOf(price("2026-03-20", "102.45"))
        )
        snapshotCacheAt("2026-03-27T12:30:00Z").putSeries(
            identity = "stock-history:VWRA.L",
            from = LocalDate.parse("1900-01-01"),
            to = LocalDate.parse("1900-01-31"),
            prices = emptyList()
        )

        val summary = snapshotCacheAt("2026-03-27T13:00:00Z")
            .getSeriesSnapshotSummary("stock-history:VWRA.L")

        assertNotNull(summary)
        assertEquals("2026-03-20", summary?.sourceAsOf)
        assertEquals(1, summary?.pointCount)
        assertEquals(Instant.parse("2026-03-27T12:30:00Z"), summary?.lastSuccessfulCheckAt)
        assertEquals(Instant.parse("2026-03-27T12:30:00Z"), summary?.canonicalUpdatedAt)
    }

    @Test
    fun `list snapshots summarizes cached quote series and inflation coverage with freshness metadata`() = runBlocking {
        val repository = InMemoryOperationalStateRepository()
        val json = AppJsonFactory.create()

        fun snapshotCacheAt(instant: String) = MarketDataSnapshotCacheService(
            operationalStateService = OperationalStateService(
                repository = repository,
                json = json,
                clock = fixedClock(instant)
            ),
            clock = fixedClock(instant)
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
        assertEquals(MarketDataSnapshotStatus.FRESH, inflationWindow.status)
        assertEquals(Instant.parse("2026-03-27T12:15:00Z"), inflationWindow.lastCheckedAt)
        assertEquals(Instant.parse("2026-03-27T12:15:00Z"), inflationWindow.canonicalUpdatedAt)
        assertEquals(0, inflationWindow.failureCount)

        val monthlyInflation = snapshots.first { it.snapshotType == "INFLATION_MONTHLY" }
        assertEquals("2026-01", monthlyInflation.sourceFrom)
        assertEquals("2026-02", monthlyInflation.sourceTo)
        assertEquals("2026-02", monthlyInflation.sourceAsOf)
        assertEquals(2, monthlyInflation.pointCount)
        assertEquals(MarketDataSnapshotStatus.FRESH, monthlyInflation.status)
        assertEquals(Instant.parse("2026-03-27T12:10:00Z"), monthlyInflation.lastCheckedAt)
        assertEquals(Instant.parse("2026-03-27T12:10:00Z"), monthlyInflation.canonicalUpdatedAt)

        val quote = snapshots.first { it.snapshotType == "QUOTE" }
        assertEquals("2026-03-26", quote.sourceFrom)
        assertEquals("2026-03-26", quote.sourceTo)
        assertEquals("2026-03-26", quote.sourceAsOf)
        assertEquals(1, quote.pointCount)
        assertEquals(MarketDataSnapshotStatus.FRESH, quote.status)
        assertEquals(Instant.parse("2026-03-27T12:05:00Z"), quote.lastCheckedAt)
        assertEquals(Instant.parse("2026-03-27T12:05:00Z"), quote.lastSuccessfulCheckAt)
        assertEquals(Instant.parse("2026-03-27T12:05:00Z"), quote.canonicalUpdatedAt)

        val series = snapshots.first { it.snapshotType == "PRICE_SERIES" }
        assertEquals("2026-03-01", series.sourceFrom)
        assertEquals("2026-03-03", series.sourceTo)
        assertEquals("2026-03-03", series.sourceAsOf)
        assertEquals(2, series.pointCount)
        assertEquals(MarketDataSnapshotStatus.FRESH, series.status)
        assertEquals(Instant.parse("2026-03-27T12:00:00Z"), series.lastCheckedAt)
        assertEquals(Instant.parse("2026-03-27T12:00:00Z"), series.canonicalUpdatedAt)
    }

    @Test
    fun `unchanged payload preserves canonical timestamp while failed recheck updates diagnostics`() = runBlocking {
        val repository = InMemoryOperationalStateRepository()
        val json = AppJsonFactory.create()

        fun snapshotCacheAt(instant: String) = MarketDataSnapshotCacheService(
            operationalStateService = OperationalStateService(
                repository = repository,
                json = json,
                clock = fixedClock(instant)
            ),
            clock = fixedClock(instant)
        )

        val prices = listOf(
            HistoricalPricePoint(
                date = LocalDate.parse("2026-03-01"),
                closePricePln = BigDecimal("101.10")
            ),
            HistoricalPricePoint(
                date = LocalDate.parse("2026-03-03"),
                closePricePln = BigDecimal("102.45")
            )
        )

        snapshotCacheAt("2026-03-27T12:00:00Z").putSeries(identity = "VWRA.L", prices = prices)
        snapshotCacheAt("2026-03-27T12:30:00Z").putSeries(identity = "VWRA.L", prices = prices)
        snapshotCacheAt("2026-03-27T13:00:00Z").recordSeriesFailure(identity = "VWRA.L", reason = "Rate limit exceeded.")

        val series = snapshotCacheAt("2026-03-27T13:05:00Z").listSnapshots().single()

        assertEquals(MarketDataSnapshotStatus.FAILED, series.status)
        assertEquals(Instant.parse("2026-03-27T13:00:00Z"), series.lastCheckedAt)
        assertEquals(Instant.parse("2026-03-27T12:30:00Z"), series.lastSuccessfulCheckAt)
        assertEquals(Instant.parse("2026-03-27T12:00:00Z"), series.canonicalUpdatedAt)
        assertEquals(1, series.failureCount)
        assertEquals(Instant.parse("2026-03-27T13:00:00Z"), series.lastFailureAt)
        assertEquals("Rate limit exceeded.", series.lastFailureReason)
        assertEquals("2026-03-03", series.sourceAsOf)
        assertEquals(2, series.pointCount)
    }

    private fun fixedClock(instant: String): Clock = Clock.fixed(Instant.parse(instant), ZoneOffset.UTC)

    private fun snapshotCache(
        repository: OperationalStateRepository = InMemoryOperationalStateRepository()
    ): MarketDataSnapshotCacheService {
        val clock = fixedClock("2026-03-27T12:00:00Z")
        return MarketDataSnapshotCacheService(
            operationalStateService = OperationalStateService(
                repository = repository,
                json = AppJsonFactory.create(),
                clock = clock
            ),
            clock = clock
        )
    }

    private fun price(date: String, close: String): HistoricalPricePoint = HistoricalPricePoint(
        date = LocalDate.parse(date),
        closePricePln = BigDecimal(close)
    )

    private fun stockProvenance() = StockAnalystDataProvenance(
        source = "YAHOO_FINANCE",
        retrievedAt = Instant.parse("2026-03-20T20:01:02Z"),
        marketTimestamp = Instant.parse("2026-03-20T20:00:00Z"),
        marketDate = LocalDate.parse("2026-03-20"),
        currency = "USD",
        unitScale = 1.0,
        adjustment = "SPLIT_ADJUSTED",
        coverageFrom = LocalDate.parse("2026-03-01"),
        coverageTo = LocalDate.parse("2026-03-20"),
        status = "FRESH"
    )
}

private class DelayedOperationalStateRepository(
    private val delegate: OperationalStateRepository
) : OperationalStateRepository {
    override suspend fun get(key: String): OperationalStateEntry? = delegate.get(key).also { delay(25) }

    override suspend fun listByPrefix(prefix: String): List<OperationalStateEntry> = delegate.listByPrefix(prefix)

    override suspend fun save(entry: OperationalStateEntry): OperationalStateEntry = delegate.save(entry)

    override suspend fun saveIfAbsent(entry: OperationalStateEntry): OperationalStateEntry =
        delegate.saveIfAbsent(entry)

    override suspend fun saveIfNewer(entry: OperationalStateEntry): OperationalStateEntry =
        delegate.saveIfNewer(entry)
}
