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
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryAppPreferenceRepository
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
        val vwraBenchmark = oneYear.benchmarks.first { it.key == BenchmarkKey.VWRA }
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
            setOf(
                BenchmarkKey.VWRA,
                BenchmarkKey.V80A,
                BenchmarkKey.V60A,
                BenchmarkKey.V40A,
                BenchmarkKey.V20A,
                BenchmarkKey.VAGF,
                BenchmarkKey.INFLATION
            ),
            benchmarkKeys
        )
    }

    @Test
    fun `returns respect benchmark settings and include custom benchmark`() = runBlocking {
        val fixture = returnsFixture()
        fixture.benchmarkSettingsService.update(
            SavePortfolioBenchmarkSettingsCommand(
                enabledKeys = listOf(BenchmarkKey.V80A, BenchmarkKey.CUSTOM_1),
                pinnedKeys = listOf(BenchmarkKey.CUSTOM_1),
                customBenchmarks = listOf(
                    SaveCustomBenchmarkCommand(
                        key = BenchmarkKey.CUSTOM_1,
                        label = "Europe 600",
                        symbol = "EXSA.DE"
                    )
                )
            )
        )
        fixture.accountRepository.save(account())
        fixture.transactionRepository.save(depositTransaction(tradeDate = "2024-03-01"))
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
        fixture.referenceProvider.benchmarksBySymbol["V80A.DE"] = ReferenceSeriesResult.Success(
            prices = listOf(
                pricePoint("2025-03-01", "100.00"),
                pricePoint("2026-03-01", "109.00")
            )
        )
        fixture.referenceProvider.benchmarksBySymbol["EXSA.DE"] = ReferenceSeriesResult.Success(
            prices = listOf(
                pricePoint("2025-03-01", "100.00"),
                pricePoint("2026-03-01", "111.00")
            )
        )
        fixture.referenceProvider.gold = ReferenceSeriesResult.Failure("Gold not required.")
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

        assertEquals(listOf(BenchmarkKey.CUSTOM_1, BenchmarkKey.V80A), oneYear.benchmarks.map { it.key })
        assertEquals("Europe 600", oneYear.benchmarks.first().label)
        assertTrue(oneYear.benchmarks.first().pinned)
    }

    @Test
    fun `returns keep unavailable configured benchmarks with explicit status`() = runBlocking {
        val fixture = returnsFixture()
        fixture.benchmarkSettingsService.update(
            SavePortfolioBenchmarkSettingsCommand(
                enabledKeys = listOf(BenchmarkKey.CUSTOM_1),
                pinnedKeys = emptyList(),
                customBenchmarks = listOf(
                    SaveCustomBenchmarkCommand(
                        key = BenchmarkKey.CUSTOM_1,
                        label = "Europe 600",
                        symbol = "EXSA.DE"
                    )
                )
            )
        )
        fixture.accountRepository.save(account())
        fixture.transactionRepository.save(depositTransaction(tradeDate = "2024-03-01"))
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
        fixture.referenceProvider.benchmarksBySymbol["EXSA.DE"] = ReferenceSeriesResult.Failure("Upstream timeout.")
        fixture.referenceProvider.gold = ReferenceSeriesResult.Failure("Gold not required.")
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
        val customBenchmark = oneYear.benchmarks.first { it.key == BenchmarkKey.CUSTOM_1 }

        assertEquals(BenchmarkSeriesStatus.UNAVAILABLE, customBenchmark.status)
        assertEquals(null, customBenchmark.nominalPln)
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
        val oneYearRealPln = requireNotNull(oneYear.realPln)
        val oneYearInflation = requireNotNull(oneYear.inflation)

        assertEquals(BigDecimal("0.1"), oneYear.nominalPln!!.moneyWeightedReturn)
        assertEquals(BigDecimal("-0.0476190476"), oneYearRealPln.moneyWeightedReturn)
        assertEquals(YearMonth.parse("2025-03"), oneYearInflation.from)
        assertEquals(YearMonth.parse("2026-03"), oneYearInflation.until)
    }

    @Test
    fun `returns expose period breakdown across flows income and costs`() = runBlocking {
        val fixture = returnsFixture()
        fixture.accountRepository.save(account())
        fixture.transactionRepository.save(depositTransaction())
        fixture.transactionRepository.save(interestTransaction(amount = "100.00"))
        fixture.transactionRepository.save(feeTransaction())
        fixture.transactionRepository.save(taxTransaction())
        fixture.referenceProvider.usd = ReferenceSeriesResult.Success(
            prices = listOf(
                pricePoint("2025-03-01", "4.00"),
                pricePoint("2026-03-01", "4.00")
            )
        )
        fixture.referenceProvider.equity = ReferenceSeriesResult.Failure("Equity benchmark not required.")
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
        val breakdown = requireNotNull(oneYear.breakdown)

        assertBigDecimalValue("0.00", breakdown.openingValuePln)
        assertBigDecimalValue("1075.00", breakdown.closingValuePln)
        assertBigDecimalValue("1075.00", breakdown.netChangePln)
        assertBigDecimalValue("1000.00", breakdown.netExternalFlowsPln)
        assertBigDecimalValue("100.00", breakdown.interestAndCouponsPln)
        assertBigDecimalValue("-10.00", breakdown.feesPln)
        assertBigDecimalValue("-15.00", breakdown.taxesPln)
        assertBigDecimalValue("0.00", breakdown.marketAndFxPln)
        assertBigDecimalValue("75.00", breakdown.netInvestmentResultPln)
    }

    private fun assertBigDecimalValue(expected: String, actual: BigDecimal) {
        assertTrue(
            actual.compareTo(BigDecimal(expected)) == 0,
            "Expected <$expected> but was <${actual.toPlainString()}>"
        )
    }

    private fun returnsFixture(
        clock: Clock = Clock.fixed(Instant.parse("2026-03-01T12:00:00Z"), ZoneOffset.UTC)
    ): ReturnsFixture {
        val accountRepository = InMemoryAccountRepository()
        val instrumentRepository = InMemoryInstrumentRepository()
        val portfolioTargetRepository = InMemoryPortfolioTargetRepository()
        val appPreferenceRepository = InMemoryAppPreferenceRepository()
        val transactionRepository = InMemoryTransactionRepository()
        val referenceProvider = FakeReferenceSeriesProvider()
        val historyProvider = FakeHistoricalInstrumentValuationProvider()
        val edoLotValuationProvider = FakeEdoLotValuationProvider()
        val fxRateProvider = FakeFxRateHistoryProvider()
        val inflationProvider = FakeInflationAdjustmentProvider()
        val auditLogService = AuditLogService(
            auditEventRepository = net.bobinski.portfolio.api.persistence.inmemory.InMemoryAuditEventRepository(),
            clock = clock
        )
        val benchmarkSettingsService = PortfolioBenchmarkSettingsService(
            appPreferenceService = AppPreferenceService(
                repository = appPreferenceRepository,
                json = net.bobinski.portfolio.api.config.AppJsonFactory.create(),
                clock = clock
            ),
            auditLogService = auditLogService,
            clock = clock
        )
        val historyService = PortfolioHistoryService(
            accountRepository = accountRepository,
            instrumentRepository = instrumentRepository,
            portfolioTargetRepository = portfolioTargetRepository,
            transactionRepository = transactionRepository,
            historicalInstrumentValuationProvider = historyProvider,
            edoLotValuationProvider = edoLotValuationProvider,
            referenceSeriesProvider = referenceProvider,
            inflationAdjustmentProvider = inflationProvider,
            transactionFxConversionService = TransactionFxConversionService(fxRateHistoryProvider = fxRateProvider),
            benchmarkSettingsService = benchmarkSettingsService,
            clock = clock
        )
        val service = PortfolioReturnsService(
            transactionRepository = transactionRepository,
            portfolioHistoryService = historyService,
            transactionFxConversionService = TransactionFxConversionService(fxRateHistoryProvider = fxRateProvider),
            referenceSeriesProvider = referenceProvider,
            inflationAdjustmentProvider = inflationProvider,
            benchmarkSettingsService = benchmarkSettingsService,
            clock = clock
        )

        return ReturnsFixture(
            service = service,
            accountRepository = accountRepository,
            transactionRepository = transactionRepository,
            referenceProvider = referenceProvider,
            inflationProvider = inflationProvider,
            benchmarkSettingsService = benchmarkSettingsService
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

    private fun feeTransaction(
        tradeDate: String = "2026-03-01",
        amount: String = "10.00"
    ): Transaction = Transaction(
        id = UUID.nameUUIDFromBytes("returns-fee".toByteArray()),
        accountId = ACCOUNT_ID,
        instrumentId = null,
        type = TransactionType.FEE,
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
        createdAt = CREATED_AT.plusSeconds(2),
        updatedAt = CREATED_AT.plusSeconds(2)
    )

    private fun taxTransaction(
        tradeDate: String = "2026-03-01",
        amount: String = "15.00"
    ): Transaction = Transaction(
        id = UUID.nameUUIDFromBytes("returns-tax".toByteArray()),
        accountId = ACCOUNT_ID,
        instrumentId = null,
        type = TransactionType.TAX,
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
        createdAt = CREATED_AT.plusSeconds(3),
        updatedAt = CREATED_AT.plusSeconds(3)
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
        val inflationProvider: FakeInflationAdjustmentProvider,
        val benchmarkSettingsService: PortfolioBenchmarkSettingsService
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

    private class FakeEdoLotValuationProvider : net.bobinski.portfolio.api.marketdata.service.EdoLotValuationProvider {
        override suspend fun value(lotTerms: net.bobinski.portfolio.api.domain.model.EdoLotTerms) =
            throw UnsupportedOperationException("Not used in returns tests.")

        override suspend fun dailyPriceSeries(
            lotTerms: net.bobinski.portfolio.api.domain.model.EdoLotTerms,
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
