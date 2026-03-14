package net.bobinski.portfolio.api.domain.service

import kotlinx.coroutines.runBlocking
import net.bobinski.portfolio.api.domain.model.Account
import net.bobinski.portfolio.api.domain.model.AccountType
import net.bobinski.portfolio.api.domain.model.Transaction
import net.bobinski.portfolio.api.domain.model.TransactionType
import net.bobinski.portfolio.api.marketdata.service.FxRateHistoryProvider
import net.bobinski.portfolio.api.marketdata.service.FxRateHistoryResult
import net.bobinski.portfolio.api.marketdata.service.HistoricalInstrumentValuationProvider
import net.bobinski.portfolio.api.marketdata.service.HistoricalInstrumentValuationResult
import net.bobinski.portfolio.api.marketdata.service.InflationAdjustmentProvider
import net.bobinski.portfolio.api.marketdata.service.InflationAdjustmentResult
import net.bobinski.portfolio.api.marketdata.service.ReferenceSeriesProvider
import net.bobinski.portfolio.api.marketdata.service.ReferenceSeriesResult
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryAccountRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryInstrumentRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryPortfolioTargetRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryTransactionRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Test
import java.math.BigDecimal
import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.time.YearMonth
import java.time.ZoneOffset
import java.util.UUID

class PortfolioReturnsServiceTest {

    @Test
    fun `returns compute nominal and real mwrr for pln and usd`() = runBlocking {
        val fixture = returnsFixture()
        fixture.accountRepository.save(account())
        fixture.transactionRepository.save(depositTransaction())
        fixture.transactionRepository.save(interestTransaction())
        fixture.referenceProvider.usd = ReferenceSeriesResult.Success(
            prices = listOf(
                pricePoint("2025-03-01", "4.00"),
                pricePoint("2026-03-01", "4.00")
            )
        )
        fixture.referenceProvider.equity = ReferenceSeriesResult.Success(
            prices = listOf(
                pricePoint("2025-03-01", "100.00"),
                pricePoint("2026-03-01", "108.00")
            )
        )
        fixture.referenceProvider.gold = ReferenceSeriesResult.Failure("Gold not required.")
        fixture.inflationProvider.result = InflationAdjustmentResult.Success(
            from = YearMonth.parse("2025-03"),
            until = YearMonth.parse("2026-03"),
            multiplier = BigDecimal("1.05")
        )

        val returns = fixture.service.returns()

        val oneYear = returns.periods.first { it.key == ReturnPeriodKey.ONE_YEAR }
        val max = returns.periods.first { it.key == ReturnPeriodKey.MAX }

        assertEquals(LocalDate.parse("2026-03-01"), returns.asOf)
        assertEquals(LocalDate.parse("2025-03-01"), oneYear.from)
        assertEquals(BigDecimal("0.1"), oneYear.nominalPln!!.moneyWeightedReturn)
        assertEquals(BigDecimal("0.1"), oneYear.nominalPln.annualizedMoneyWeightedReturn)
        assertEquals(BigDecimal("0.1"), oneYear.nominalPln.timeWeightedReturn)
        assertEquals(BigDecimal("0.1"), oneYear.nominalPln.annualizedTimeWeightedReturn)
        assertEquals(BigDecimal("0.1"), oneYear.nominalUsd!!.moneyWeightedReturn)
        assertEquals(BigDecimal("0.1"), oneYear.nominalUsd.timeWeightedReturn)
        assertNotNull(oneYear.realPln)
        assertEquals(BigDecimal("0.0476190476"), oneYear.realPln!!.moneyWeightedReturn)
        assertEquals(BigDecimal("0.0476190476"), oneYear.realPln.timeWeightedReturn)
        assertEquals(BigDecimal("1.05"), oneYear.inflation!!.multiplier)
        assertEquals(BenchmarkKey.VWRA, oneYear.benchmarks.first().key)
        assertEquals(BigDecimal("0.08"), oneYear.benchmarks.first().nominalPln!!.timeWeightedReturn)
        assertEquals(BigDecimal("0.1"), max.nominalPln!!.moneyWeightedReturn)
    }

    private fun returnsFixture(): ReturnsFixture {
        val accountRepository = InMemoryAccountRepository()
        val instrumentRepository = InMemoryInstrumentRepository()
        val portfolioTargetRepository = InMemoryPortfolioTargetRepository()
        val transactionRepository = InMemoryTransactionRepository()
        val referenceProvider = FakeReferenceSeriesProvider()
        val historyProvider = FakeHistoricalInstrumentValuationProvider()
        val fxRateProvider = FakeFxRateHistoryProvider()
        val inflationProvider = FakeInflationAdjustmentProvider()
        val clock = Clock.fixed(Instant.parse("2026-03-01T12:00:00Z"), ZoneOffset.UTC)
        val historyService = PortfolioHistoryService(
            accountRepository = accountRepository,
            instrumentRepository = instrumentRepository,
            portfolioTargetRepository = portfolioTargetRepository,
            transactionRepository = transactionRepository,
            historicalInstrumentValuationProvider = historyProvider,
            referenceSeriesProvider = referenceProvider,
            inflationAdjustmentProvider = inflationProvider,
            transactionFxConversionService = TransactionFxConversionService(fxRateHistoryProvider = fxRateProvider),
            clock = clock
        )
        val service = PortfolioReturnsService(
            transactionRepository = transactionRepository,
            portfolioHistoryService = historyService,
            transactionFxConversionService = TransactionFxConversionService(fxRateHistoryProvider = fxRateProvider),
            referenceSeriesProvider = referenceProvider,
            inflationAdjustmentProvider = inflationProvider,
            clock = clock
        )

        return ReturnsFixture(
            service = service,
            accountRepository = accountRepository,
            transactionRepository = transactionRepository,
            referenceProvider = referenceProvider,
            inflationProvider = inflationProvider
        )
    }

    private fun account(): Account = Account(
        id = ACCOUNT_ID,
        name = "Primary",
        institution = "Broker",
        type = AccountType.BROKERAGE,
        baseCurrency = "PLN",
        isActive = true,
        createdAt = CREATED_AT,
        updatedAt = CREATED_AT
    )

    private fun depositTransaction(): Transaction = Transaction(
        id = UUID.nameUUIDFromBytes("returns-deposit".toByteArray()),
        accountId = ACCOUNT_ID,
        instrumentId = null,
        type = TransactionType.DEPOSIT,
        tradeDate = LocalDate.parse("2025-03-01"),
        settlementDate = LocalDate.parse("2025-03-01"),
        quantity = null,
        unitPrice = null,
        grossAmount = BigDecimal("1000.00"),
        feeAmount = BigDecimal.ZERO,
        taxAmount = BigDecimal.ZERO,
        currency = "PLN",
        fxRateToPln = null,
        notes = "",
        createdAt = CREATED_AT,
        updatedAt = CREATED_AT
    )

    private fun interestTransaction(): Transaction = Transaction(
        id = UUID.nameUUIDFromBytes("returns-interest".toByteArray()),
        accountId = ACCOUNT_ID,
        instrumentId = null,
        type = TransactionType.INTEREST,
        tradeDate = LocalDate.parse("2026-03-01"),
        settlementDate = LocalDate.parse("2026-03-01"),
        quantity = null,
        unitPrice = null,
        grossAmount = BigDecimal("100.00"),
        feeAmount = BigDecimal.ZERO,
        taxAmount = BigDecimal.ZERO,
        currency = "PLN",
        fxRateToPln = null,
        notes = "",
        createdAt = CREATED_AT.plusSeconds(1),
        updatedAt = CREATED_AT.plusSeconds(1)
    )

    private fun pricePoint(date: String, closePricePln: String) =
        net.bobinski.portfolio.api.marketdata.model.HistoricalPricePoint(
            date = LocalDate.parse(date),
            closePricePln = BigDecimal(closePricePln)
        )

    private data class ReturnsFixture(
        val service: PortfolioReturnsService,
        val accountRepository: InMemoryAccountRepository,
        val transactionRepository: InMemoryTransactionRepository,
        val referenceProvider: FakeReferenceSeriesProvider,
        val inflationProvider: FakeInflationAdjustmentProvider
    )

    private class FakeReferenceSeriesProvider : ReferenceSeriesProvider {
        var usd: ReferenceSeriesResult = ReferenceSeriesResult.Failure("USD not set.")
        var gold: ReferenceSeriesResult = ReferenceSeriesResult.Failure("Gold not set.")
        var equity: ReferenceSeriesResult = ReferenceSeriesResult.Failure("Equity benchmark not set.")

        override suspend fun usdPln(from: LocalDate, to: LocalDate): ReferenceSeriesResult = usd

        override suspend fun goldPln(from: LocalDate, to: LocalDate): ReferenceSeriesResult = gold

        override suspend fun equityBenchmarkPln(from: LocalDate, to: LocalDate): ReferenceSeriesResult = equity
    }

    private class FakeHistoricalInstrumentValuationProvider : HistoricalInstrumentValuationProvider {
        override suspend fun dailyPriceSeries(
            instrument: net.bobinski.portfolio.api.domain.model.Instrument,
            from: LocalDate,
            to: LocalDate
        ): HistoricalInstrumentValuationResult = HistoricalInstrumentValuationResult.Success(prices = emptyList())
    }

    private class FakeFxRateHistoryProvider : FxRateHistoryProvider {
        override suspend fun dailyRateToPln(
            currency: String,
            from: LocalDate,
            to: LocalDate
        ): FxRateHistoryResult = FxRateHistoryResult.Failure("FX not required.")
    }

    private class FakeInflationAdjustmentProvider : InflationAdjustmentProvider {
        var result: InflationAdjustmentResult = InflationAdjustmentResult.Failure("Inflation not set.")

        override suspend fun cumulativeSince(from: YearMonth): InflationAdjustmentResult = result
    }

    private companion object {
        val ACCOUNT_ID: UUID = UUID.fromString("10000000-0000-0000-0000-000000000001")
        val CREATED_AT: Instant = Instant.parse("2025-03-01T12:00:00Z")
    }
}
