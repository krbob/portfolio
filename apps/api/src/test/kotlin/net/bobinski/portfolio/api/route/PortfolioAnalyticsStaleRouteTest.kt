package net.bobinski.portfolio.api.route

import io.ktor.client.request.get
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpStatusCode
import io.ktor.server.routing.route
import io.ktor.server.routing.routing
import io.ktor.server.testing.testApplication
import java.math.BigDecimal
import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.YearMonth
import java.util.UUID
import net.bobinski.portfolio.api.config.AppJsonFactory
import net.bobinski.portfolio.api.domain.model.Account
import net.bobinski.portfolio.api.domain.model.AccountType
import net.bobinski.portfolio.api.domain.model.AssetClass
import net.bobinski.portfolio.api.domain.model.Instrument
import net.bobinski.portfolio.api.domain.model.InstrumentKind
import net.bobinski.portfolio.api.domain.model.Transaction
import net.bobinski.portfolio.api.domain.model.TransactionType
import net.bobinski.portfolio.api.domain.model.ValuationSource
import net.bobinski.portfolio.api.domain.service.AppPreferenceService
import net.bobinski.portfolio.api.domain.service.AuditLogService
import net.bobinski.portfolio.api.domain.service.OperationalStateService
import net.bobinski.portfolio.api.domain.service.PortfolioBenchmarkSettingsService
import net.bobinski.portfolio.api.domain.service.PortfolioHistoryService
import net.bobinski.portfolio.api.domain.service.PortfolioReadModelCacheDescriptorService
import net.bobinski.portfolio.api.domain.service.PortfolioReturnsService
import net.bobinski.portfolio.api.domain.service.ReadModelCacheService
import net.bobinski.portfolio.api.domain.service.TransactionFxConversionService
import net.bobinski.portfolio.api.marketdata.model.HistoricalPricePoint
import net.bobinski.portfolio.api.marketdata.service.EdoLotValuationProvider
import net.bobinski.portfolio.api.marketdata.service.FxRateHistoryProvider
import net.bobinski.portfolio.api.marketdata.service.FxRateHistoryResult
import net.bobinski.portfolio.api.marketdata.service.HistoricalInstrumentValuationProvider
import net.bobinski.portfolio.api.marketdata.service.HistoricalInstrumentValuationResult
import net.bobinski.portfolio.api.marketdata.service.InflationAdjustmentProvider
import net.bobinski.portfolio.api.marketdata.service.InflationAdjustmentResult
import net.bobinski.portfolio.api.marketdata.service.InflationSeriesResult
import net.bobinski.portfolio.api.marketdata.service.InstrumentValuationFailureType
import net.bobinski.portfolio.api.marketdata.service.MarketDataSnapshotCacheService
import net.bobinski.portfolio.api.marketdata.service.ReferenceSeriesProvider
import net.bobinski.portfolio.api.marketdata.service.ReferenceSeriesResult
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryAccountRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryAppPreferenceRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryAuditEventRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryInstrumentRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryOperationalStateRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryPortfolioTargetRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryReadModelCacheRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryTransactionRepository
import net.bobinski.portfolio.api.plugins.configureSerialization
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class PortfolioAnalyticsStaleRouteTest {

    @Test
    fun `history and returns keep last good snapshots when market revision recompute is degraded`() {
        val fixture = AnalyticsRouteFixture()

        testApplication {
            application {
                configureSerialization()
                routing {
                    route("/v1/portfolio") {
                        registerPortfolioAnalyticsReadModelRoutes(
                            readModelCacheService = fixture.readModelCacheService,
                            portfolioReadModelCacheDescriptorService = fixture.descriptorService,
                            portfolioHistoryService = fixture.historyService,
                            portfolioReturnsService = fixture.returnsService
                        )
                    }
                }
            }

            fixture.seedPortfolio()
            val healthyHistoryResponse = client.get("/v1/portfolio/history/daily")
            val healthyReturnsResponse = client.get("/v1/portfolio/returns")
            val healthyHistoryBody = healthyHistoryResponse.bodyAsText()
            val healthyReturnsBody = healthyReturnsResponse.bodyAsText()
            val healthySnapshots = fixture.cacheRepository.list().associateBy { snapshot -> snapshot.cacheKey }
            val healthyReturns = fixture.json.decodeFromString(
                PortfolioReturnsResponse.serializer(),
                healthyReturnsBody
            )

            assertEquals(HttpStatusCode.OK, healthyHistoryResponse.status)
            assertEquals(HttpStatusCode.OK, healthyReturnsResponse.status)
            assertTrue(healthyHistoryBody.contains("\"valuationState\": \"MARK_TO_MARKET\""))
            assertNotNull(
                healthyReturns.periods.first { period -> period.key == "MAX" }
                    .nominalPln
                    ?.timeWeightedReturn
            )

            fixture.advanceMarketRevisionAndDegradeProvider()
            val mismatchedDescriptor = fixture.descriptorService.dailyHistoryDescriptor()
            val healthyHistorySnapshot = healthySnapshots.getValue(HISTORY_CACHE_KEY)
            assertTrue(mismatchedDescriptor.sourceUpdatedAt!! > healthyHistorySnapshot.sourceUpdatedAt!!)
            assertEquals(healthyHistorySnapshot.inputsFrom, mismatchedDescriptor.inputsFrom)
            assertEquals(healthyHistorySnapshot.inputsTo, mismatchedDescriptor.inputsTo)
            assertEquals(healthyHistorySnapshot.modelVersion, mismatchedDescriptor.modelVersion)

            val staleHistoryResponse = client.get("/v1/portfolio/history/daily")
            val staleReturnsResponse = client.get("/v1/portfolio/returns")

            assertEquals(HttpStatusCode.OK, staleHistoryResponse.status)
            assertEquals(HttpStatusCode.OK, staleReturnsResponse.status)
            assertEquals(healthyHistoryBody, staleHistoryResponse.bodyAsText())
            assertEquals(healthyReturnsBody, staleReturnsResponse.bodyAsText())
            assertEquals(healthySnapshots, fixture.cacheRepository.list().associateBy { snapshot -> snapshot.cacheKey })

            fixture.recoverHistoryAndDegradeReferences()
            val referenceFallbackHistory = client.get("/v1/portfolio/history/daily")
            val referenceFallbackReturns = client.get("/v1/portfolio/returns")

            assertEquals(HttpStatusCode.OK, referenceFallbackHistory.status)
            assertEquals(HttpStatusCode.OK, referenceFallbackReturns.status)
            assertEquals(healthyHistoryBody, referenceFallbackHistory.bodyAsText())
            assertEquals(healthyReturnsBody, referenceFallbackReturns.bodyAsText())
            assertEquals(healthySnapshots, fixture.cacheRepository.list().associateBy { snapshot -> snapshot.cacheKey })
        }
    }

    private class AnalyticsRouteFixture {
        val json = AppJsonFactory.create()
        private val clock = MutableClock(Instant.parse("2026-03-20T14:00:00Z"))
        private val accountRepository = InMemoryAccountRepository()
        private val instrumentRepository = InMemoryInstrumentRepository()
        private val targetRepository = InMemoryPortfolioTargetRepository()
        private val transactionRepository = InMemoryTransactionRepository()
        private val appPreferenceRepository = InMemoryAppPreferenceRepository()
        private val operationalStateService = OperationalStateService(
            repository = InMemoryOperationalStateRepository(),
            json = json,
            clock = clock
        )
        private val marketDataSnapshotCacheService = MarketDataSnapshotCacheService(
            operationalStateService = operationalStateService,
            clock = clock
        )
        private val historyProvider = SwitchableHistoricalProvider(marketDataSnapshotCacheService)
        val cacheRepository = InMemoryReadModelCacheRepository()
        val descriptorService = PortfolioReadModelCacheDescriptorService(
            accountRepository = accountRepository,
            appPreferenceRepository = appPreferenceRepository,
            operationalStateService = operationalStateService,
            instrumentRepository = instrumentRepository,
            portfolioTargetRepository = targetRepository,
            transactionRepository = transactionRepository,
            marketDataCacheFingerprint = "route-stale-test",
            clock = clock
        )
        private val auditLogService = AuditLogService(
            auditEventRepository = InMemoryAuditEventRepository(),
            clock = clock
        )
        private val benchmarkSettingsService = PortfolioBenchmarkSettingsService(
            appPreferenceService = AppPreferenceService(
                repository = appPreferenceRepository,
                json = json,
                clock = clock
            ),
            auditLogService = auditLogService,
            clock = clock
        )
        private val referenceSeriesProvider = CompleteReferenceSeriesProvider()
        private val fxConversionService = TransactionFxConversionService(NoopFxRateHistoryProvider())
        val historyService = PortfolioHistoryService(
            accountRepository = accountRepository,
            instrumentRepository = instrumentRepository,
            portfolioTargetRepository = targetRepository,
            transactionRepository = transactionRepository,
            historicalInstrumentValuationProvider = historyProvider,
            edoLotValuationProvider = NoopEdoLotValuationProvider(),
            referenceSeriesProvider = referenceSeriesProvider,
            inflationAdjustmentProvider = NoopInflationAdjustmentProvider(),
            transactionFxConversionService = fxConversionService,
            benchmarkSettingsService = benchmarkSettingsService,
            clock = clock
        )
        val returnsService = PortfolioReturnsService(
            transactionRepository = transactionRepository,
            portfolioHistoryService = historyService,
            transactionFxConversionService = fxConversionService,
            referenceSeriesProvider = referenceSeriesProvider,
            inflationAdjustmentProvider = NoopInflationAdjustmentProvider(),
            benchmarkSettingsService = benchmarkSettingsService,
            clock = clock
        )
        val readModelCacheService = ReadModelCacheService(
            repository = cacheRepository,
            json = json,
            clock = clock
        )

        suspend fun seedPortfolio() {
            accountRepository.save(
                Account(
                    id = ACCOUNT_ID,
                    name = "Route test brokerage",
                    institution = "QA",
                    type = AccountType.BROKERAGE,
                    baseCurrency = "PLN",
                    isActive = true,
                    createdAt = CANONICAL_UPDATED_AT,
                    updatedAt = CANONICAL_UPDATED_AT
                )
            )
            instrumentRepository.save(
                Instrument(
                    id = INSTRUMENT_ID,
                    name = "Route test ETF",
                    kind = InstrumentKind.ETF,
                    assetClass = AssetClass.EQUITIES,
                    symbol = "ROUTEETF",
                    currency = "PLN",
                    valuationSource = ValuationSource.STOCK_ANALYST,
                    isActive = true,
                    createdAt = CANONICAL_UPDATED_AT,
                    updatedAt = CANONICAL_UPDATED_AT
                )
            )
            transactionRepository.save(depositTransaction())
            transactionRepository.save(buyTransaction())
        }

        suspend fun advanceMarketRevisionAndDegradeProvider() {
            clock.current = Instant.parse("2026-03-20T15:00:00Z")
            marketDataSnapshotCacheService.putSeries(
                identity = "route-test:revision-bump",
                from = FROM,
                to = UNTIL,
                prices = listOf(HistoricalPricePoint(date = UNTIL, closePricePln = BigDecimal.ONE))
            )
            historyProvider.degraded = true
        }

        suspend fun recoverHistoryAndDegradeReferences() {
            clock.current = Instant.parse("2026-03-20T16:00:00Z")
            marketDataSnapshotCacheService.putSeries(
                identity = "route-test:second-revision-bump",
                from = FROM,
                to = UNTIL,
                prices = listOf(HistoricalPricePoint(date = UNTIL, closePricePln = BigDecimal.TEN))
            )
            historyProvider.degraded = false
            referenceSeriesProvider.degraded = true
        }

        private fun depositTransaction() = Transaction(
            id = UUID.fromString("c0000000-0000-0000-0000-000000000011"),
            accountId = ACCOUNT_ID,
            instrumentId = null,
            type = TransactionType.DEPOSIT,
            tradeDate = FROM,
            settlementDate = FROM,
            quantity = null,
            unitPrice = null,
            grossAmount = BigDecimal("1000.00"),
            feeAmount = BigDecimal.ZERO,
            taxAmount = BigDecimal.ZERO,
            currency = "PLN",
            fxRateToPln = null,
            notes = "Funding",
            createdAt = CANONICAL_UPDATED_AT,
            updatedAt = CANONICAL_UPDATED_AT
        )

        private fun buyTransaction() = Transaction(
            id = UUID.fromString("c0000000-0000-0000-0000-000000000012"),
            accountId = ACCOUNT_ID,
            instrumentId = INSTRUMENT_ID,
            type = TransactionType.BUY,
            tradeDate = FROM.plusDays(1),
            settlementDate = FROM.plusDays(1),
            quantity = BigDecimal.ONE,
            unitPrice = BigDecimal("100.00"),
            grossAmount = BigDecimal("100.00"),
            feeAmount = BigDecimal.ZERO,
            taxAmount = BigDecimal.ZERO,
            currency = "PLN",
            fxRateToPln = null,
            notes = "Buy",
            createdAt = CANONICAL_UPDATED_AT,
            updatedAt = CANONICAL_UPDATED_AT
        )
    }

    private class SwitchableHistoricalProvider(
        private val snapshotCacheService: MarketDataSnapshotCacheService
    ) : HistoricalInstrumentValuationProvider {
        var degraded: Boolean = false

        override suspend fun dailyPriceSeries(
            instrument: Instrument,
            from: LocalDate,
            to: LocalDate
        ): HistoricalInstrumentValuationResult {
            if (degraded) {
                return HistoricalInstrumentValuationResult.Failure(
                    type = InstrumentValuationFailureType.UNAVAILABLE,
                    reason = "Provider degraded."
                )
            }
            val prices = listOf(
                HistoricalPricePoint(date = from, closePricePln = BigDecimal("100.00")),
                HistoricalPricePoint(date = to, closePricePln = BigDecimal("110.00"))
            )
            snapshotCacheService.putSeries(
                identity = "route-test:history:${instrument.id}",
                from = from,
                to = to,
                prices = prices
            )
            return HistoricalInstrumentValuationResult.Success(prices = prices)
        }
    }

    private class CompleteReferenceSeriesProvider : ReferenceSeriesProvider {
        var degraded: Boolean = false

        override suspend fun usdPln(from: LocalDate, to: LocalDate) = coreSeries(from, to, "4.00", "4.00")

        override suspend fun goldPln(from: LocalDate, to: LocalDate) =
            coreSeries(from, to, "12000.00", "12100.00")

        override suspend fun equityBenchmarkPln(from: LocalDate, to: LocalDate) = success(from, to, "100.00", "102.00")

        override suspend fun bondBenchmarkPln(from: LocalDate, to: LocalDate) = success(from, to, "100.00", "101.00")

        override suspend fun benchmarkPln(symbol: String, from: LocalDate, to: LocalDate) =
            success(from, to, "100.00", "101.00")

        private fun coreSeries(from: LocalDate, to: LocalDate, first: String, last: String): ReferenceSeriesResult =
            if (degraded) {
                ReferenceSeriesResult.Failure("Reference provider degraded.")
            } else {
                success(from, to, first, last)
            }

        private fun success(from: LocalDate, to: LocalDate, first: String, last: String) =
            ReferenceSeriesResult.Success(
                prices = listOf(
                    HistoricalPricePoint(date = from, closePricePln = first.toBigDecimal()),
                    HistoricalPricePoint(date = to, closePricePln = last.toBigDecimal())
                )
            )
    }

    private class NoopEdoLotValuationProvider : EdoLotValuationProvider {
        override suspend fun value(lotTerms: net.bobinski.portfolio.api.domain.model.EdoLotTerms) =
            error("Unused EDO provider.")

        override suspend fun dailyPriceSeries(
            lotTerms: net.bobinski.portfolio.api.domain.model.EdoLotTerms,
            from: LocalDate,
            to: LocalDate
        ) = error("Unused EDO provider.")
    }

    private class NoopFxRateHistoryProvider : FxRateHistoryProvider {
        override suspend fun dailyRateToPln(currency: String, from: LocalDate, to: LocalDate) =
            FxRateHistoryResult.Failure("Unused FX provider.")
    }

    private class NoopInflationAdjustmentProvider : InflationAdjustmentProvider {
        override suspend fun cumulativeSince(from: YearMonth) = InflationAdjustmentResult.Failure("Unused inflation provider.")

        override suspend fun monthlySeries(from: YearMonth, untilExclusive: YearMonth) =
            InflationSeriesResult.Failure("Unused inflation provider.")
    }

    private class MutableClock(var current: Instant) : Clock() {
        override fun getZone(): ZoneId = ZoneOffset.UTC

        override fun withZone(zone: ZoneId): Clock = this

        override fun instant(): Instant = current
    }

    companion object {
        private const val HISTORY_CACHE_KEY = "portfolio.daily-history"
        private val ACCOUNT_ID = UUID.fromString("11111111-1111-1111-1111-111111111112")
        private val INSTRUMENT_ID = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaab1")
        private val FROM = LocalDate.parse("2026-03-18")
        private val UNTIL = LocalDate.parse("2026-03-20")
        private val CANONICAL_UPDATED_AT = Instant.parse("2026-03-20T12:00:00Z")
    }
}
