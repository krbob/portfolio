package net.bobinski.portfolio.api.readmodel

import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import net.bobinski.portfolio.api.domain.model.Account
import net.bobinski.portfolio.api.domain.model.AccountType
import net.bobinski.portfolio.api.domain.model.AssetClass
import net.bobinski.portfolio.api.domain.model.AuditEventCategory
import net.bobinski.portfolio.api.domain.model.AuditEventOutcome
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
import net.bobinski.portfolio.api.marketdata.model.HistoricalPricePoint
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryAccountRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryAppPreferenceRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryAuditEventRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryInstrumentRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryOperationalStateRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryPortfolioTargetRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryReadModelCacheRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryTransactionRepository
import net.bobinski.portfolio.api.readmodel.config.ReadModelRefreshConfig
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.math.BigDecimal
import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.YearMonth
import java.util.UUID

class ReadModelRefreshServiceTest {

    @Test
    fun `failed refresh writes failure outcome to audit log`() = runBlocking {
        val fixture = refreshFixture { ThrowingHistoricalProvider() }
        fixture.seedStockPortfolio()

        val exception = assertThrows(RuntimeException::class.java) {
            runBlocking {
                fixture.service.runManualRefresh()
            }
        }

        assertEquals("History provider boom", exception.message)

        val auditEvent = fixture.auditLogService.list(limit = 1, category = AuditEventCategory.SYSTEM).single()
        assertEquals("READ_MODEL_REFRESH_FAILED", auditEvent.action)
        assertEquals(AuditEventOutcome.FAILURE, auditEvent.outcome)
        assertEquals("MANUAL", auditEvent.metadata["trigger"])
        assertNotNull(auditEvent.metadata["durationMs"])

        val status = fixture.service.status()
        assertNotNull(status.lastFailureAt)
        assertEquals("History provider boom", status.lastFailureMessage)
    }

    @Test
    fun `degraded bootstrap refresh stays usable without creating a last-good cache`() = runBlocking {
        lateinit var historyProvider: SwitchableHistoricalProvider
        val fixture = refreshFixture { snapshotCacheService ->
            SwitchableHistoricalProvider(snapshotCacheService).also { historyProvider = it }
        }
        fixture.seedStockPortfolio()
        historyProvider.failureMode = HistoricalFailureMode.ALL
        fixture.referenceProvider.degraded = true

        val result = fixture.service.runManualRefresh()

        assertEquals(2, result.refreshedModelCount)
        assertEquals(listOf("DAILY_HISTORY", "RETURNS"), result.modelNames)
        assertTrue(fixture.readModelCacheRepository.list().isEmpty())
        val status = fixture.service.status()
        assertNotNull(status.lastSuccessAt)
        assertNull(status.lastFailureAt)
        val auditEvent = fixture.auditLogService.list(limit = 1, category = AuditEventCategory.SYSTEM).single()
        assertEquals("false", auditEvent.metadata["snapshotsPersisted"])
    }

    @Test
    fun `degraded refresh preserves healthy history and returns snapshots`() = runBlocking {
        lateinit var historyProvider: SwitchableHistoricalProvider
        val fixture = refreshFixture { snapshotCacheService ->
            SwitchableHistoricalProvider(snapshotCacheService).also { historyProvider = it }
        }
        fixture.seedStockPortfolio()

        fixture.service.runStartupRefresh()

        val healthySnapshots = fixture.readModelCacheRepository.list().associateBy { it.cacheKey }
        assertEquals(setOf(HISTORY_CACHE_KEY, RETURNS_CACHE_KEY), healthySnapshots.keys)
        assertEquals(
            fixture.descriptorService.dailyHistoryDescriptor().sourceUpdatedAt,
            healthySnapshots.getValue(HISTORY_CACHE_KEY).sourceUpdatedAt,
            "The persisted descriptor must include market-data revisions produced during computation."
        )

        listOf(
            HistoricalFailureMode.ALL to "BOOK_ONLY",
            HistoricalFailureMode.PRIMARY_ONLY to "PARTIALLY_VALUED"
        ).forEach { (failureMode, expectedState) ->
            historyProvider.failureMode = failureMode
            val exception = assertThrows(IllegalStateException::class.java) {
                runBlocking {
                    fixture.service.runStartupRefresh()
                }
            }

            assertTrue(exception.message.orEmpty().contains(expectedState))
            val snapshotsAfterDegradedRefresh = fixture.readModelCacheRepository.list().associateBy { it.cacheKey }
            assertEquals(healthySnapshots.getValue(HISTORY_CACHE_KEY), snapshotsAfterDegradedRefresh[HISTORY_CACHE_KEY])
            assertEquals(healthySnapshots.getValue(RETURNS_CACHE_KEY), snapshotsAfterDegradedRefresh[RETURNS_CACHE_KEY])
        }

        historyProvider.failureMode = HistoricalFailureMode.NONE
        fixture.referenceProvider.degraded = true
        val referenceException = assertThrows(IllegalStateException::class.java) {
            runBlocking {
                fixture.service.runStartupRefresh()
            }
        }
        assertTrue(referenceException.message.orEmpty().contains("2 reference series issue(s)"))
        val snapshotsAfterReferenceFailure = fixture.readModelCacheRepository.list().associateBy { it.cacheKey }
        assertEquals(healthySnapshots.getValue(HISTORY_CACHE_KEY), snapshotsAfterReferenceFailure[HISTORY_CACHE_KEY])
        assertEquals(healthySnapshots.getValue(RETURNS_CACHE_KEY), snapshotsAfterReferenceFailure[RETURNS_CACHE_KEY])

        val status = fixture.service.status()
        assertNotNull(status.lastFailureAt)
        assertTrue(status.lastFailureMessage.orEmpty().contains("2 reference series issue(s)"))
    }

    private fun refreshFixture(
        historyProviderFactory: (MarketDataSnapshotCacheService) -> HistoricalInstrumentValuationProvider
    ): RefreshFixture {
        val clock = Clock.fixed(Instant.parse("2026-03-20T14:00:00Z"), ZoneOffset.UTC)
        val accountRepository = InMemoryAccountRepository()
        val instrumentRepository = InMemoryInstrumentRepository()
        val portfolioTargetRepository = InMemoryPortfolioTargetRepository()
        val transactionRepository = InMemoryTransactionRepository()
        val appPreferenceRepository = InMemoryAppPreferenceRepository()
        val auditEventRepository = InMemoryAuditEventRepository()
        val readModelCacheRepository = InMemoryReadModelCacheRepository()
        val operationalStateRepository = InMemoryOperationalStateRepository()
        val json = Json { ignoreUnknownKeys = true }
        val auditLogService = AuditLogService(auditEventRepository = auditEventRepository, clock = clock)
        val appPreferenceService = AppPreferenceService(repository = appPreferenceRepository, json = json, clock = clock)
        val benchmarkSettingsService = PortfolioBenchmarkSettingsService(
            appPreferenceService = appPreferenceService,
            auditLogService = auditLogService,
            clock = clock
        )
        val operationalStateService = OperationalStateService(
            repository = operationalStateRepository,
            json = json,
            clock = clock
        )
        val descriptorService = PortfolioReadModelCacheDescriptorService(
            accountRepository = accountRepository,
            appPreferenceRepository = appPreferenceRepository,
            operationalStateService = operationalStateService,
            instrumentRepository = instrumentRepository,
            portfolioTargetRepository = portfolioTargetRepository,
            transactionRepository = transactionRepository,
            marketDataCacheFingerprint = "qa-test",
            clock = clock
        )
        val referenceProvider = SwitchableReferenceSeriesProvider()
        val historyService = PortfolioHistoryService(
            accountRepository = accountRepository,
            instrumentRepository = instrumentRepository,
            portfolioTargetRepository = portfolioTargetRepository,
            transactionRepository = transactionRepository,
            historicalInstrumentValuationProvider = historyProviderFactory(
                MarketDataSnapshotCacheService(operationalStateService = operationalStateService, clock = clock)
            ),
            edoLotValuationProvider = NoopEdoLotValuationProvider(),
            referenceSeriesProvider = referenceProvider,
            inflationAdjustmentProvider = NoopInflationAdjustmentProvider(),
            transactionFxConversionService = TransactionFxConversionService(NoopFxRateHistoryProvider()),
            benchmarkSettingsService = benchmarkSettingsService,
            clock = clock
        )
        val returnsService = PortfolioReturnsService(
            transactionRepository = transactionRepository,
            portfolioHistoryService = historyService,
            transactionFxConversionService = TransactionFxConversionService(NoopFxRateHistoryProvider()),
            referenceSeriesProvider = referenceProvider,
            inflationAdjustmentProvider = NoopInflationAdjustmentProvider(),
            benchmarkSettingsService = benchmarkSettingsService,
            clock = clock
        )
        val readModelCacheService = ReadModelCacheService(
            repository = readModelCacheRepository,
            json = json,
            clock = clock
        )
        val service = ReadModelRefreshService(
            config = ReadModelRefreshConfig(enabled = false, intervalMinutes = 1440, runOnStart = false),
            readModelCacheService = readModelCacheService,
            descriptorService = descriptorService,
            portfolioHistoryService = historyService,
            portfolioReturnsService = returnsService,
            auditLogService = auditLogService,
            clock = clock
        )

        return RefreshFixture(
            service = service,
            auditLogService = auditLogService,
            readModelCacheRepository = readModelCacheRepository,
            descriptorService = descriptorService,
            referenceProvider = referenceProvider,
            accountRepository = accountRepository,
            instrumentRepository = instrumentRepository,
            transactionRepository = transactionRepository
        )
    }

    private suspend fun RefreshFixture.seedStockPortfolio() {
        accountRepository.save(
            Account(
                id = ACCOUNT_ID,
                name = "QA brokerage",
                institution = "QA",
                type = AccountType.BROKERAGE,
                baseCurrency = "PLN",
                isActive = true,
                createdAt = CREATED_AT,
                updatedAt = CREATED_AT
            )
        )
        instrumentRepository.save(
            Instrument(
                id = INSTRUMENT_ID,
                name = "QA ETF",
                kind = InstrumentKind.ETF,
                assetClass = AssetClass.EQUITIES,
                symbol = "QAETF",
                currency = "PLN",
                valuationSource = ValuationSource.STOCK_ANALYST,
                isActive = true,
                createdAt = CREATED_AT,
                updatedAt = CREATED_AT
            )
        )
        instrumentRepository.save(
            Instrument(
                id = SECONDARY_INSTRUMENT_ID,
                name = "QA ETF 2",
                kind = InstrumentKind.ETF,
                assetClass = AssetClass.EQUITIES,
                symbol = "QAETF2",
                currency = "PLN",
                valuationSource = ValuationSource.STOCK_ANALYST,
                isActive = true,
                createdAt = CREATED_AT,
                updatedAt = CREATED_AT
            )
        )
        transactionRepository.save(
            Transaction(
                id = UUID.fromString("c0000000-0000-0000-0000-000000000001"),
                accountId = ACCOUNT_ID,
                instrumentId = null,
                type = TransactionType.DEPOSIT,
                tradeDate = LocalDate.parse("2026-03-19"),
                settlementDate = LocalDate.parse("2026-03-19"),
                quantity = null,
                unitPrice = null,
                grossAmount = BigDecimal("1000.00"),
                feeAmount = BigDecimal.ZERO,
                taxAmount = BigDecimal.ZERO,
                currency = "PLN",
                fxRateToPln = null,
                notes = "QA funding",
                createdAt = CREATED_AT,
                updatedAt = CREATED_AT
            )
        )
        transactionRepository.save(
            Transaction(
                id = UUID.fromString("c0000000-0000-0000-0000-000000000002"),
                accountId = ACCOUNT_ID,
                instrumentId = INSTRUMENT_ID,
                type = TransactionType.BUY,
                tradeDate = LocalDate.parse("2026-03-20"),
                settlementDate = LocalDate.parse("2026-03-20"),
                quantity = BigDecimal.ONE,
                unitPrice = BigDecimal("100.00"),
                grossAmount = BigDecimal("100.00"),
                feeAmount = BigDecimal.ZERO,
                taxAmount = BigDecimal.ZERO,
                currency = "PLN",
                fxRateToPln = null,
                notes = "QA buy",
                createdAt = CREATED_AT,
                updatedAt = CREATED_AT
            )
        )
        transactionRepository.save(
            Transaction(
                id = UUID.fromString("c0000000-0000-0000-0000-000000000003"),
                accountId = ACCOUNT_ID,
                instrumentId = SECONDARY_INSTRUMENT_ID,
                type = TransactionType.BUY,
                tradeDate = LocalDate.parse("2026-03-20"),
                settlementDate = LocalDate.parse("2026-03-20"),
                quantity = BigDecimal.ONE,
                unitPrice = BigDecimal("100.00"),
                grossAmount = BigDecimal("100.00"),
                feeAmount = BigDecimal.ZERO,
                taxAmount = BigDecimal.ZERO,
                currency = "PLN",
                fxRateToPln = null,
                notes = "QA buy 2",
                createdAt = CREATED_AT,
                updatedAt = CREATED_AT
            )
        )
    }

    private data class RefreshFixture(
        val service: ReadModelRefreshService,
        val auditLogService: AuditLogService,
        val readModelCacheRepository: InMemoryReadModelCacheRepository,
        val descriptorService: PortfolioReadModelCacheDescriptorService,
        val referenceProvider: SwitchableReferenceSeriesProvider,
        val accountRepository: InMemoryAccountRepository,
        val instrumentRepository: InMemoryInstrumentRepository,
        val transactionRepository: InMemoryTransactionRepository
    )

    private class ThrowingHistoricalProvider : HistoricalInstrumentValuationProvider {
        override suspend fun dailyPriceSeries(
            instrument: Instrument,
            from: LocalDate,
            to: LocalDate
        ) = error("History provider boom")
    }

    private class SwitchableHistoricalProvider(
        private val snapshotCacheService: MarketDataSnapshotCacheService
    ) : HistoricalInstrumentValuationProvider {
        var failureMode: HistoricalFailureMode = HistoricalFailureMode.NONE

        override suspend fun dailyPriceSeries(
            instrument: Instrument,
            from: LocalDate,
            to: LocalDate
        ): HistoricalInstrumentValuationResult {
            val unavailable = failureMode == HistoricalFailureMode.ALL ||
                (failureMode == HistoricalFailureMode.PRIMARY_ONLY && instrument.id == INSTRUMENT_ID)
            if (unavailable) {
                return HistoricalInstrumentValuationResult.Failure(
                    type = InstrumentValuationFailureType.UNAVAILABLE,
                    reason = "History API unavailable."
                )
            }

            val prices = listOf(
                HistoricalPricePoint(date = to, closePricePln = BigDecimal("110.00"))
            )
            snapshotCacheService.putSeries(
                identity = "test-history:${instrument.id}",
                from = from,
                to = to,
                prices = prices
            )
            return HistoricalInstrumentValuationResult.Success(prices = prices)
        }
    }

    private enum class HistoricalFailureMode {
        NONE,
        ALL,
        PRIMARY_ONLY
    }

    private class NoopEdoLotValuationProvider : net.bobinski.portfolio.api.marketdata.service.EdoLotValuationProvider {
        override suspend fun value(lotTerms: net.bobinski.portfolio.api.domain.model.EdoLotTerms) =
            error("EDO lot provider boom")

        override suspend fun dailyPriceSeries(
            lotTerms: net.bobinski.portfolio.api.domain.model.EdoLotTerms,
            from: LocalDate,
            to: LocalDate
        ) = error("EDO lot provider boom")
    }

    private class SwitchableReferenceSeriesProvider : ReferenceSeriesProvider {
        var degraded: Boolean = false

        override suspend fun usdPln(from: LocalDate, to: LocalDate) =
            coreSeriesOrFailure(from = from, to = to, value = "4.00")

        override suspend fun goldPln(from: LocalDate, to: LocalDate) =
            coreSeriesOrFailure(from = from, to = to, value = "12000.00")

        override suspend fun equityBenchmarkPln(from: LocalDate, to: LocalDate) =
            ReferenceSeriesResult.Failure("unused")

        override suspend fun bondBenchmarkPln(from: LocalDate, to: LocalDate) =
            ReferenceSeriesResult.Failure("unused")

        override suspend fun benchmarkPln(symbol: String, from: LocalDate, to: LocalDate) =
            ReferenceSeriesResult.Failure("unused")

        private fun coreSeriesOrFailure(from: LocalDate, to: LocalDate, value: String): ReferenceSeriesResult =
            if (degraded) {
                ReferenceSeriesResult.Failure("Reference provider degraded.")
            } else {
                ReferenceSeriesResult.Success(
                    prices = listOf(
                        HistoricalPricePoint(date = from, closePricePln = value.toBigDecimal()),
                        HistoricalPricePoint(date = to, closePricePln = value.toBigDecimal())
                    )
                )
            }
    }

    private class NoopInflationAdjustmentProvider : InflationAdjustmentProvider {
        override suspend fun cumulativeSince(from: YearMonth) =
            InflationAdjustmentResult.Failure("unused")

        override suspend fun monthlySeries(from: YearMonth, untilExclusive: YearMonth) =
            InflationSeriesResult.Failure("unused")
    }

    private class NoopFxRateHistoryProvider : FxRateHistoryProvider {
        override suspend fun dailyRateToPln(currency: String, from: LocalDate, to: LocalDate) =
            FxRateHistoryResult.Failure("unused")
    }

    companion object {
        private const val HISTORY_CACHE_KEY = "portfolio.daily-history"
        private const val RETURNS_CACHE_KEY = "portfolio.returns"
        private val ACCOUNT_ID = UUID.fromString("11111111-1111-1111-1111-111111111111")
        private val INSTRUMENT_ID = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1")
        private val SECONDARY_INSTRUMENT_ID = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2")
        private val CREATED_AT: Instant = Instant.parse("2026-03-20T12:00:00Z")
    }
}
