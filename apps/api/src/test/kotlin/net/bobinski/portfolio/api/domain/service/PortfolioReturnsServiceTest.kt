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
import net.bobinski.portfolio.api.marketdata.service.InflationSeriesResult
import net.bobinski.portfolio.api.marketdata.service.MonthlyInflationPoint
import net.bobinski.portfolio.api.marketdata.service.ReferenceSeriesProvider
import net.bobinski.portfolio.api.marketdata.service.ReferenceSeriesResult
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryAccountRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryInstrumentRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryPortfolioTargetRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryTransactionRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertTrue
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
        fixture.inflationProvider.monthlySeries = fixedMonthlySeries(
            from = YearMonth.parse("2025-03"),
            until = YearMonth.parse("2026-03"),
            firstMultiplier = BigDecimal("1.05")
        )

        val returns = fixture.service.returns()

        val oneYear = returns.periods.first { it.key == ReturnPeriodKey.ONE_YEAR }
        val max = returns.periods.first { it.key == ReturnPeriodKey.MAX }
        val oneYearNominalPln = requireNotNull(oneYear.nominalPln)
        val oneYearNominalUsd = requireNotNull(oneYear.nominalUsd)
        val oneYearRealPln = requireNotNull(oneYear.realPln)
        val oneYearInflation = requireNotNull(oneYear.inflation)
        val vwraBenchmark = oneYear.benchmarks.first()
        val vwraBenchmarkNominalPln = requireNotNull(vwraBenchmark.nominalPln)

        assertEquals(LocalDate.parse("2026-03-01"), returns.asOf)
        assertEquals(LocalDate.parse("2025-03-01"), oneYear.from)
        assertEquals(BigDecimal("0.1"), oneYearNominalPln.moneyWeightedReturn)
        assertEquals(BigDecimal("0.1"), oneYearNominalPln.annualizedMoneyWeightedReturn)
        assertEquals(BigDecimal("0.1"), oneYearNominalPln.timeWeightedReturn)
        assertEquals(BigDecimal("0.1"), oneYearNominalPln.annualizedTimeWeightedReturn)
        assertEquals(BigDecimal("0.1"), oneYearNominalUsd.moneyWeightedReturn)
        assertEquals(BigDecimal("0.1"), oneYearNominalUsd.timeWeightedReturn)
        assertNotNull(oneYear.realPln)
        assertEquals(BigDecimal("-0.0476190476"), oneYearRealPln.moneyWeightedReturn)
        assertEquals(BigDecimal("-0.0476190476"), oneYearRealPln.timeWeightedReturn)
        assertEquals(BigDecimal("1.05"), oneYearInflation.multiplier)
        assertEquals(BenchmarkKey.VWRA, vwraBenchmark.key)
        assertEquals(BigDecimal("0.08"), vwraBenchmarkNominalPln.timeWeightedReturn)
        assertEquals(BigDecimal("0.1"), max.nominalPln!!.moneyWeightedReturn)
    }

    @Test
    fun `returns expose multi-asset benchmark family when series are available`() = runBlocking {
        val fixture = returnsFixture()
        fixture.accountRepository.save(account())
        fixture.transactionRepository.save(depositTransaction(tradeDate = "2024-03-01"))
        fixture.transactionRepository.save(interestTransaction())
        fixture.referenceProvider.usd = ReferenceSeriesResult.Success(
            prices = listOf(
                pricePoint("2025-03-01", "4.00"),
                pricePoint("2026-03-01", "4.00")
            )
        )
        fixture.referenceProvider.equity = ReferenceSeriesResult.Failure("Equity benchmark not required.")
        fixture.referenceProvider.gold = ReferenceSeriesResult.Failure("Gold not required.")
        fixture.referenceProvider.benchmarksBySymbol["V80A.DE"] = ReferenceSeriesResult.Success(
            prices = listOf(
                pricePoint("2025-03-01", "100.00"),
                pricePoint("2026-03-01", "109.00")
            )
        )
        fixture.referenceProvider.benchmarksBySymbol["V60A.DE"] = ReferenceSeriesResult.Success(
            prices = listOf(
                pricePoint("2025-03-01", "100.00"),
                pricePoint("2026-03-01", "107.00")
            )
        )
        fixture.referenceProvider.benchmarksBySymbol["V40A.DE"] = ReferenceSeriesResult.Success(
            prices = listOf(
                pricePoint("2025-03-01", "100.00"),
                pricePoint("2026-03-01", "105.00")
            )
        )
        fixture.referenceProvider.benchmarksBySymbol["V20A.DE"] = ReferenceSeriesResult.Success(
            prices = listOf(
                pricePoint("2025-03-01", "100.00"),
                pricePoint("2026-03-01", "103.00")
            )
        )
        fixture.inflationProvider.result = InflationAdjustmentResult.Success(
            from = YearMonth.parse("2025-03"),
            until = YearMonth.parse("2026-03"),
            multiplier = BigDecimal("1.02")
        )
        fixture.inflationProvider.monthlySeries = fixedMonthlySeries(
            from = YearMonth.parse("2025-03"),
            until = YearMonth.parse("2026-03"),
            firstMultiplier = BigDecimal("1.02")
        )

        val returns = fixture.service.returns()
        val oneYear = returns.periods.first { it.key == ReturnPeriodKey.ONE_YEAR }
        val benchmarkKeys = oneYear.benchmarks.map { it.key }.toSet()

        assertEquals(
            setOf(BenchmarkKey.V80A, BenchmarkKey.V60A, BenchmarkKey.V40A, BenchmarkKey.V20A, BenchmarkKey.INFLATION),
            benchmarkKeys
        )
    }

    @Test
    fun `real pln aligns to CPI-covered full months only`() = runBlocking {
        val fixture = returnsFixture(
            clock = Clock.fixed(Instant.parse("2026-03-19T12:00:00Z"), ZoneOffset.UTC)
        )
        fixture.accountRepository.save(account())
        fixture.transactionRepository.save(depositTransaction(tradeDate = "2024-03-01"))
        fixture.transactionRepository.save(interestTransaction(tradeDate = "2026-03-01"))
        fixture.referenceProvider.usd = ReferenceSeriesResult.Success(
            prices = listOf(
                pricePoint("2025-03-19", "4.00"),
                pricePoint("2026-03-19", "4.00")
            )
        )
        fixture.referenceProvider.equity = ReferenceSeriesResult.Success(
            prices = listOf(
                pricePoint("2025-03-19", "100.00"),
                pricePoint("2026-03-19", "110.00")
            )
        )
        fixture.referenceProvider.gold = ReferenceSeriesResult.Failure("Gold not required.")
        fixture.inflationProvider.result = InflationAdjustmentResult.Success(
            from = YearMonth.parse("2025-04"),
            until = YearMonth.parse("2026-03"),
            multiplier = BigDecimal("1.05")
        )
        fixture.inflationProvider.monthlySeries = fixedMonthlySeries(
            from = YearMonth.parse("2025-04"),
            until = YearMonth.parse("2026-03"),
            firstMultiplier = BigDecimal("1.05")
        )

        val returns = fixture.service.returns()
        val oneYear = returns.periods.first { it.key == ReturnPeriodKey.ONE_YEAR }
        val oneYearRealPln = requireNotNull(oneYear.realPln)
        val oneYearInflation = requireNotNull(oneYear.inflation)

        assertEquals(BigDecimal("0.1"), oneYear.nominalPln!!.moneyWeightedReturn)
        assertEquals(BigDecimal("-0.0476190476"), oneYearRealPln.moneyWeightedReturn)
        assertEquals(YearMonth.parse("2025-04"), oneYearInflation.from)
        assertEquals(YearMonth.parse("2026-03"), oneYearInflation.until)
    }

    private fun returnsFixture(
        clock: Clock = Clock.fixed(Instant.parse("2026-03-01T12:00:00Z"), ZoneOffset.UTC)
    ): ReturnsFixture {
        val accountRepository = InMemoryAccountRepository()
        val instrumentRepository = InMemoryInstrumentRepository()
        val portfolioTargetRepository = InMemoryPortfolioTargetRepository()
        val transactionRepository = InMemoryTransactionRepository()
        val referenceProvider = FakeReferenceSeriesProvider()
        val historyProvider = FakeHistoricalInstrumentValuationProvider()
        val fxRateProvider = FakeFxRateHistoryProvider()
        val inflationProvider = FakeInflationAdjustmentProvider()
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

    private fun depositTransaction(
        tradeDate: String = "2025-03-01",
        amount: String = "1000.00"
    ): Transaction = Transaction(
        id = UUID.nameUUIDFromBytes("returns-deposit".toByteArray()),
        accountId = ACCOUNT_ID,
        instrumentId = null,
        type = TransactionType.DEPOSIT,
        tradeDate = LocalDate.parse(tradeDate),
        settlementDate = LocalDate.parse(tradeDate),
        quantity = null,
        unitPrice = null,
        grossAmount = BigDecimal(amount),
        feeAmount = BigDecimal.ZERO,
        taxAmount = BigDecimal.ZERO,
        currency = "PLN",
        fxRateToPln = null,
        notes = "",
        createdAt = CREATED_AT,
        updatedAt = CREATED_AT
    )

    private fun interestTransaction(
        tradeDate: String = "2026-03-01",
        amount: String = "100.00"
    ): Transaction = Transaction(
        id = UUID.nameUUIDFromBytes("returns-interest".toByteArray()),
        accountId = ACCOUNT_ID,
        instrumentId = null,
        type = TransactionType.INTEREST,
        tradeDate = LocalDate.parse(tradeDate),
        settlementDate = LocalDate.parse(tradeDate),
        quantity = null,
        unitPrice = null,
        grossAmount = BigDecimal(amount),
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
        var bond: ReferenceSeriesResult = ReferenceSeriesResult.Failure("Bond benchmark not set.")
        val benchmarksBySymbol: MutableMap<String, ReferenceSeriesResult> = linkedMapOf()

        override suspend fun usdPln(from: LocalDate, to: LocalDate): ReferenceSeriesResult = usd

        override suspend fun goldPln(from: LocalDate, to: LocalDate): ReferenceSeriesResult = gold

        override suspend fun equityBenchmarkPln(from: LocalDate, to: LocalDate): ReferenceSeriesResult = equity

        override suspend fun bondBenchmarkPln(from: LocalDate, to: LocalDate): ReferenceSeriesResult = bond

        override suspend fun benchmarkPln(symbol: String, from: LocalDate, to: LocalDate): ReferenceSeriesResult =
            benchmarksBySymbol[symbol] ?: ReferenceSeriesResult.Failure("No fake benchmark for $symbol.")
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
        var monthlySeries: InflationSeriesResult = InflationSeriesResult.Failure("Monthly inflation not set.")

        override suspend fun cumulativeSince(from: YearMonth): InflationAdjustmentResult = result

        override suspend fun monthlySeries(from: YearMonth, untilExclusive: YearMonth): InflationSeriesResult = monthlySeries
    }

    private fun fixedMonthlySeries(
        from: YearMonth,
        until: YearMonth,
        firstMultiplier: BigDecimal
    ): InflationSeriesResult.Success {
        val months = generateSequence(from) { current -> current.plusMonths(1) }
            .takeWhile { month -> month.isBefore(until) }
            .toList()
        val points = months.mapIndexed { index, month ->
            MonthlyInflationPoint(
                month = month,
                multiplier = if (index == 0) firstMultiplier else BigDecimal.ONE
            )
        }
        return InflationSeriesResult.Success(
            from = from,
            until = until,
            points = points
        )
    }

    private companion object {
        val ACCOUNT_ID: UUID = UUID.fromString("10000000-0000-0000-0000-000000000001")
        val CREATED_AT: Instant = Instant.parse("2025-03-01T12:00:00Z")
    }
}
