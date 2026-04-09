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
import net.bobinski.portfolio.api.domain.service.PortfolioBenchmarkSettingsService
import net.bobinski.portfolio.api.domain.service.PortfolioHistoryService
import net.bobinski.portfolio.api.domain.service.PortfolioReadModelCacheDescriptorService
import net.bobinski.portfolio.api.domain.service.PortfolioReturnsService
import net.bobinski.portfolio.api.domain.service.ReadModelCacheService
import net.bobinski.portfolio.api.domain.service.TransactionFxConversionService
import net.bobinski.portfolio.api.marketdata.service.FxRateHistoryProvider
import net.bobinski.portfolio.api.marketdata.service.FxRateHistoryResult
import net.bobinski.portfolio.api.marketdata.service.HistoricalInstrumentValuationProvider
import net.bobinski.portfolio.api.marketdata.service.InflationAdjustmentProvider
import net.bobinski.portfolio.api.marketdata.service.InflationAdjustmentResult
import net.bobinski.portfolio.api.marketdata.service.InflationSeriesResult
import net.bobinski.portfolio.api.marketdata.service.ReferenceSeriesProvider
import net.bobinski.portfolio.api.marketdata.service.ReferenceSeriesResult
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryAccountRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryAppPreferenceRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryAuditEventRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryInstrumentRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryPortfolioTargetRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryReadModelCacheRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryTransactionRepository
import net.bobinski.portfolio.api.readmodel.config.ReadModelRefreshConfig
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertThrows
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
        val clock = Clock.fixed(Instant.parse("2026-03-20T14:00:00Z"), ZoneOffset.UTC)
        val accountRepository = InMemoryAccountRepository()
        val instrumentRepository = InMemoryInstrumentRepository()
        val portfolioTargetRepository = InMemoryPortfolioTargetRepository()
        val transactionRepository = InMemoryTransactionRepository()
        val appPreferenceRepository = InMemoryAppPreferenceRepository()
        val auditEventRepository = InMemoryAuditEventRepository()
        val readModelCacheRepository = InMemoryReadModelCacheRepository()
        val json = Json { ignoreUnknownKeys = true }
        val auditLogService = AuditLogService(auditEventRepository = auditEventRepository, clock = clock)
        val appPreferenceService = AppPreferenceService(repository = appPreferenceRepository, json = json, clock = clock)
        val benchmarkSettingsService = PortfolioBenchmarkSettingsService(
            appPreferenceService = appPreferenceService,
            auditLogService = auditLogService,
            clock = clock
        )
        val readModelCacheService = ReadModelCacheService(repository = readModelCacheRepository, json = json, clock = clock)
        val descriptorService = PortfolioReadModelCacheDescriptorService(
            accountRepository = accountRepository,
            appPreferenceRepository = appPreferenceRepository,
            instrumentRepository = instrumentRepository,
            portfolioTargetRepository = portfolioTargetRepository,
            transactionRepository = transactionRepository,
            marketDataCacheFingerprint = "qa-test",
            json = json,
            clock = clock
        )
        val historyService = PortfolioHistoryService(
            accountRepository = accountRepository,
            instrumentRepository = instrumentRepository,
            portfolioTargetRepository = portfolioTargetRepository,
            transactionRepository = transactionRepository,
            historicalInstrumentValuationProvider = ThrowingHistoricalProvider(),
            edoLotValuationProvider = NoopEdoLotValuationProvider(),
            referenceSeriesProvider = NoopReferenceSeriesProvider(),
            inflationAdjustmentProvider = NoopInflationAdjustmentProvider(),
            transactionFxConversionService = TransactionFxConversionService(NoopFxRateHistoryProvider()),
            benchmarkSettingsService = benchmarkSettingsService,
            clock = clock
        )
        val returnsService = PortfolioReturnsService(
            transactionRepository = transactionRepository,
            portfolioHistoryService = historyService,
            transactionFxConversionService = TransactionFxConversionService(NoopFxRateHistoryProvider()),
            referenceSeriesProvider = NoopReferenceSeriesProvider(),
            inflationAdjustmentProvider = NoopInflationAdjustmentProvider(),
            benchmarkSettingsService = benchmarkSettingsService,
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

        accountRepository.save(
            Account(
                id = UUID.fromString("11111111-1111-1111-1111-111111111111"),
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
                id = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1"),
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
        transactionRepository.save(
            Transaction(
                id = UUID.fromString("c0000000-0000-0000-0000-000000000001"),
                accountId = UUID.fromString("11111111-1111-1111-1111-111111111111"),
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
                accountId = UUID.fromString("11111111-1111-1111-1111-111111111111"),
                instrumentId = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1"),
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

        val exception = assertThrows(RuntimeException::class.java) {
            runBlocking {
                service.runManualRefresh()
            }
        }

        assertEquals("History provider boom", exception.message)

        val auditEvent = auditLogService.list(limit = 1, category = AuditEventCategory.SYSTEM).single()
        assertEquals("READ_MODEL_REFRESH_FAILED", auditEvent.action)
        assertEquals(AuditEventOutcome.FAILURE, auditEvent.outcome)
        assertEquals("MANUAL", auditEvent.metadata["trigger"])
        assertNotNull(auditEvent.metadata["durationMs"])

        val status = service.status()
        assertNotNull(status.lastFailureAt)
        assertEquals("History provider boom", status.lastFailureMessage)
    }

    private class ThrowingHistoricalProvider : HistoricalInstrumentValuationProvider {
        override suspend fun dailyPriceSeries(
            instrument: Instrument,
            from: LocalDate,
            to: LocalDate
        ) = error("History provider boom")
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

    private class NoopReferenceSeriesProvider : ReferenceSeriesProvider {
        override suspend fun usdPln(from: LocalDate, to: LocalDate) =
            ReferenceSeriesResult.Failure("unused")

        override suspend fun goldPln(from: LocalDate, to: LocalDate) =
            ReferenceSeriesResult.Failure("unused")

        override suspend fun equityBenchmarkPln(from: LocalDate, to: LocalDate) =
            ReferenceSeriesResult.Failure("unused")

        override suspend fun bondBenchmarkPln(from: LocalDate, to: LocalDate) =
            ReferenceSeriesResult.Failure("unused")

        override suspend fun benchmarkPln(symbol: String, from: LocalDate, to: LocalDate) =
            ReferenceSeriesResult.Failure("unused")
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
        private val CREATED_AT: Instant = Instant.parse("2026-03-20T12:00:00Z")
    }
}
