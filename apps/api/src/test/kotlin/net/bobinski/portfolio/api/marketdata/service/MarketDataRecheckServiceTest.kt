package net.bobinski.portfolio.api.marketdata.service

import java.math.BigDecimal
import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.time.YearMonth
import java.time.ZoneOffset
import java.util.UUID
import kotlinx.coroutines.runBlocking
import net.bobinski.portfolio.api.config.AppJsonFactory
import net.bobinski.portfolio.api.domain.model.AssetClass
import net.bobinski.portfolio.api.domain.model.Instrument
import net.bobinski.portfolio.api.domain.model.InstrumentKind
import net.bobinski.portfolio.api.domain.model.ValuationSource
import net.bobinski.portfolio.api.domain.service.AppPreferenceService
import net.bobinski.portfolio.api.domain.service.AuditLogService
import net.bobinski.portfolio.api.domain.service.InstrumentService
import net.bobinski.portfolio.api.domain.service.ValuationProbeService
import net.bobinski.portfolio.api.marketdata.config.MarketDataRecheckConfig
import net.bobinski.portfolio.api.marketdata.model.HistoricalPricePoint
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryAuditEventRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryInstrumentRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryAppPreferenceRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class MarketDataRecheckServiceTest {

    @Test
    fun `recheck retries failed stock history snapshots after backoff`() = runBlocking {
        val failureClock = Clock.fixed(Instant.parse("2026-03-27T12:00:00Z"), ZoneOffset.UTC)
        val snapshotCacheService = snapshotCacheService(failureClock)
        snapshotCacheService.recordSeriesFailure(identity = "stock-history:VWRA.L", reason = "upstream timeout")
        val runClock = Clock.fixed(Instant.parse("2026-03-27T12:30:00Z"), ZoneOffset.UTC)

        val instrumentRepository = InMemoryInstrumentRepository().also { repository ->
            repository.save(
                Instrument(
                    id = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
                    name = "VWRA",
                    kind = InstrumentKind.ETF,
                    assetClass = AssetClass.EQUITIES,
                    symbol = "VWRA.L",
                    currency = "USD",
                    valuationSource = ValuationSource.STOCK_ANALYST,
                    isActive = true,
                    createdAt = CREATED_AT,
                    updatedAt = CREATED_AT
                )
            )
        }
        val historicalProvider = RecordingHistoricalProvider()
        val service = marketDataRecheckService(
            clock = runClock,
            instrumentRepository = instrumentRepository,
            snapshotCacheService = snapshotCacheService,
            historicalProvider = historicalProvider
        )

        val result = service.runScheduledRecheck()

        assertEquals(1, result.attemptedCount)
        assertEquals(1, result.refreshedCount)
        assertEquals(0, result.stillDegradedCount)
        assertEquals(listOf("stock-history:VWRA.L"), result.identities)
        assertEquals(
            listOf(
                HistoricalCall(
                    instrumentSymbol = "VWRA.L",
                    from = LocalDate.parse("2026-03-14"),
                    to = LocalDate.parse("2026-03-27")
                )
            ),
            historicalProvider.calls
        )
    }

    @Test
    fun `recheck does not retry failures before backoff elapses`() = runBlocking {
        val failureClock = Clock.fixed(Instant.parse("2026-03-27T12:00:00Z"), ZoneOffset.UTC)
        val snapshotCacheService = snapshotCacheService(failureClock)
        snapshotCacheService.recordSeriesFailure(identity = "stock-history:VWRA.L", reason = "upstream timeout")

        val runClock = Clock.fixed(Instant.parse("2026-03-27T12:10:00Z"), ZoneOffset.UTC)
        val historicalProvider = RecordingHistoricalProvider()
        val service = marketDataRecheckService(
            clock = runClock,
            instrumentRepository = InMemoryInstrumentRepository(),
            snapshotCacheService = snapshotCacheService,
            historicalProvider = historicalProvider
        )

        val result = service.runScheduledRecheck()

        assertEquals(0, result.attemptedCount)
        assertEquals(0, result.refreshedCount)
        assertEquals(0, result.stillDegradedCount)
        assertEquals(0, result.skippedCount)
        assertTrue(result.identities.isEmpty())
        assertTrue(historicalProvider.calls.isEmpty())
    }

    private fun marketDataRecheckService(
        clock: Clock,
        instrumentRepository: InMemoryInstrumentRepository,
        snapshotCacheService: MarketDataSnapshotCacheService,
        historicalProvider: RecordingHistoricalProvider
    ): MarketDataRecheckService {
        val auditLogService = AuditLogService(
            auditEventRepository = InMemoryAuditEventRepository(),
            clock = clock
        )
        val instrumentService = InstrumentService(
            instrumentRepository = instrumentRepository,
            auditLogService = auditLogService,
            valuationProbeService = object : ValuationProbeService {
                override suspend fun verifyStockAnalystSymbol(symbol: String) = Unit
            },
            clock = clock
        )
        return MarketDataRecheckService(
            config = MarketDataRecheckConfig(
                enabled = true,
                intervalMinutes = 15,
                runOnStart = false,
                baseRetryMinutes = 30,
                maxRetryMinutes = 120,
                seriesLookbackDays = 14,
                inflationLookbackMonths = 6
            ),
            snapshotCacheService = snapshotCacheService,
            instrumentService = instrumentService,
            currentInstrumentValuationProvider = NoopCurrentInstrumentValuationProvider(),
            historicalInstrumentValuationProvider = historicalProvider,
            edoLotValuationProvider = NoopEdoLotValuationProvider(),
            referenceSeriesProvider = NoopReferenceSeriesProvider(),
            fxRateHistoryProvider = NoopFxRateHistoryProvider(),
            inflationAdjustmentProvider = NoopInflationAdjustmentProvider(),
            clock = clock
        )
    }

    private fun snapshotCacheService(clock: Clock): MarketDataSnapshotCacheService {
        val repository = InMemoryAppPreferenceRepository()
        val json = AppJsonFactory.create()
        return MarketDataSnapshotCacheService(
            appPreferenceService = AppPreferenceService(
                repository = repository,
                json = json,
                clock = clock
            ),
            clock = clock
        )
    }

    private class RecordingHistoricalProvider : HistoricalInstrumentValuationProvider {
        val calls = mutableListOf<HistoricalCall>()

        override suspend fun dailyPriceSeries(
            instrument: Instrument,
            from: LocalDate,
            to: LocalDate
        ): HistoricalInstrumentValuationResult {
            calls += HistoricalCall(
                instrumentSymbol = requireNotNull(instrument.symbol),
                from = from,
                to = to
            )
            return HistoricalInstrumentValuationResult.Success(
                prices = listOf(
                    HistoricalPricePoint(
                        date = to,
                        closePricePln = BigDecimal("123.45")
                    )
                )
            )
        }
    }

    private class NoopCurrentInstrumentValuationProvider : CurrentInstrumentValuationProvider {
        override suspend fun value(instrument: Instrument): InstrumentValuationResult =
            InstrumentValuationResult.Failure(
                type = InstrumentValuationFailureType.UNSUPPORTED,
                reason = "not used"
            )
    }

    private class NoopEdoLotValuationProvider : EdoLotValuationProvider {
        override suspend fun value(lotTerms: net.bobinski.portfolio.api.domain.model.EdoLotTerms): InstrumentValuationResult =
            InstrumentValuationResult.Failure(
                type = InstrumentValuationFailureType.UNSUPPORTED,
                reason = "not used"
            )

        override suspend fun dailyPriceSeries(
            lotTerms: net.bobinski.portfolio.api.domain.model.EdoLotTerms,
            from: LocalDate,
            to: LocalDate
        ): HistoricalInstrumentValuationResult = HistoricalInstrumentValuationResult.Failure(
            type = InstrumentValuationFailureType.UNSUPPORTED,
            reason = "not used"
        )
    }

    private class NoopReferenceSeriesProvider : ReferenceSeriesProvider {
        override suspend fun usdPln(from: LocalDate, to: LocalDate): ReferenceSeriesResult =
            ReferenceSeriesResult.Failure("not used")

        override suspend fun goldPln(from: LocalDate, to: LocalDate): ReferenceSeriesResult =
            ReferenceSeriesResult.Failure("not used")

        override suspend fun equityBenchmarkPln(from: LocalDate, to: LocalDate): ReferenceSeriesResult =
            ReferenceSeriesResult.Failure("not used")

        override suspend fun bondBenchmarkPln(from: LocalDate, to: LocalDate): ReferenceSeriesResult =
            ReferenceSeriesResult.Failure("not used")

        override suspend fun benchmarkPln(symbol: String, from: LocalDate, to: LocalDate): ReferenceSeriesResult =
            ReferenceSeriesResult.Failure("not used")
    }

    private class NoopFxRateHistoryProvider : FxRateHistoryProvider {
        override suspend fun dailyRateToPln(currency: String, from: LocalDate, to: LocalDate): FxRateHistoryResult =
            FxRateHistoryResult.Failure("not used")
    }

    private class NoopInflationAdjustmentProvider : InflationAdjustmentProvider {
        override suspend fun cumulativeSince(from: YearMonth): InflationAdjustmentResult =
            InflationAdjustmentResult.Failure("not used")

        override suspend fun monthlySeries(from: YearMonth, untilExclusive: YearMonth): InflationSeriesResult =
            InflationSeriesResult.Failure("not used")
    }

    private data class HistoricalCall(
        val instrumentSymbol: String,
        val from: LocalDate,
        val to: LocalDate
    )

    private companion object {
        val CREATED_AT: Instant = Instant.parse("2026-03-01T00:00:00Z")
    }
}
