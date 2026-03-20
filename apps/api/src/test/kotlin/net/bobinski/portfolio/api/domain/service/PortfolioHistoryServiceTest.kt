package net.bobinski.portfolio.api.domain.service

import kotlinx.coroutines.runBlocking
import net.bobinski.portfolio.api.domain.model.Account
import net.bobinski.portfolio.api.domain.model.AccountType
import net.bobinski.portfolio.api.domain.model.AssetClass
import net.bobinski.portfolio.api.domain.model.Instrument
import net.bobinski.portfolio.api.domain.model.InstrumentKind
import net.bobinski.portfolio.api.domain.model.PortfolioTarget
import net.bobinski.portfolio.api.domain.model.Transaction
import net.bobinski.portfolio.api.domain.model.TransactionType
import net.bobinski.portfolio.api.domain.model.ValuationSource
import net.bobinski.portfolio.api.marketdata.model.HistoricalPricePoint
import net.bobinski.portfolio.api.marketdata.service.FxRateHistoryProvider
import net.bobinski.portfolio.api.marketdata.service.FxRateHistoryResult
import net.bobinski.portfolio.api.marketdata.service.HistoricalInstrumentValuationProvider
import net.bobinski.portfolio.api.marketdata.service.HistoricalInstrumentValuationResult
import net.bobinski.portfolio.api.marketdata.service.InflationAdjustmentProvider
import net.bobinski.portfolio.api.marketdata.service.InflationAdjustmentResult
import net.bobinski.portfolio.api.marketdata.service.InflationSeriesResult
import net.bobinski.portfolio.api.marketdata.service.InstrumentValuationFailureType
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

class PortfolioHistoryServiceTest {

    @Test
    fun `daily history tracks current value and contributions`() = runBlocking {
        val fixture = historyFixture()
        val account = account()
        val instrument = etfInstrument()
        fixture.accountRepository.save(account)
        fixture.instrumentRepository.save(instrument)
        fixture.transactionRepository.save(depositTransaction())
        fixture.transactionRepository.save(buyTransaction(instrument.id))
        fixture.historyProvider.values[instrument.id] = HistoricalInstrumentValuationResult.Success(
            prices = listOf(
                pricePoint("2026-03-02", "105.00"),
                pricePoint("2026-03-03", "110.00")
            )
        )
        fixture.referenceProvider.usd = ReferenceSeriesResult.Success(
            prices = listOf(
                pricePoint("2026-03-01", "4.00"),
                pricePoint("2026-03-03", "4.10")
            )
        )
        fixture.referenceProvider.gold = ReferenceSeriesResult.Success(
            prices = listOf(
                pricePoint("2026-03-01", "12000.00"),
                pricePoint("2026-03-03", "12100.00")
            )
        )

        val history = fixture.service.dailyHistory()

        assertEquals(ValuationState.MARK_TO_MARKET, history.valuationState)
        assertEquals(3, history.points.size)
        assertEquals(BigDecimal("2000.00"), history.points[0].totalCurrentValuePln)
        assertEquals(BigDecimal("2045.00"), history.points[1].totalCurrentValuePln)
        assertEquals(BigDecimal("2095.00"), history.points[2].totalCurrentValuePln)
        assertEquals(BigDecimal("2000.00"), history.points[2].netContributionsPln)
        assertEquals(BigDecimal("500"), history.points[2].netContributionsUsd)
        assertEquals(BigDecimal("0.16666667"), history.points[2].netContributionsAu)
        assertEquals(BigDecimal("52.51"), history.points[2].equityAllocationPct)
        assertEquals(1, history.points[2].valuedHoldingCount)
        assertEquals(BigDecimal("510.97560976"), history.points[2].totalCurrentValueUsd)
        assertEquals(BigDecimal("0.1731405"), history.points[2].totalCurrentValueAu)
    }

    @Test
    fun `daily history falls back to book basis when price history is unavailable`() = runBlocking {
        val fixture = historyFixture()
        val account = account()
        val instrument = etfInstrument()
        fixture.accountRepository.save(account)
        fixture.instrumentRepository.save(instrument)
        fixture.transactionRepository.save(depositTransaction())
        fixture.transactionRepository.save(buyTransaction(instrument.id))
        fixture.historyProvider.values[instrument.id] = HistoricalInstrumentValuationResult.Failure(
            type = InstrumentValuationFailureType.UNAVAILABLE,
            reason = "History API unavailable."
        )
        fixture.referenceProvider.usd = ReferenceSeriesResult.Failure("USD series unavailable.")
        fixture.referenceProvider.gold = ReferenceSeriesResult.Failure("Gold series unavailable.")

        val history = fixture.service.dailyHistory()

        assertEquals(ValuationState.BOOK_ONLY, history.valuationState)
        assertEquals(1, history.instrumentHistoryIssueCount)
        assertEquals(2, history.referenceSeriesIssueCount)
        assertEquals(BigDecimal("2000.00"), history.points[1].totalCurrentValuePln)
        assertEquals(0, history.points[1].valuedHoldingCount)
        assertEquals(null, history.points[1].totalCurrentValueUsd)
    }

    @Test
    fun `daily history resolves missing fx from historical rates`() = runBlocking {
        val fixture = historyFixture()
        fixture.accountRepository.save(account())
        fixture.transactionRepository.save(
            depositTransaction(
                grossAmount = "100.00",
                currency = "USD"
            )
        )
        fixture.fxRateProvider.values["USD"] = FxRateHistoryResult.Success(
            prices = listOf(
                pricePoint("2026-03-01", "4.00")
            )
        )

        val history = fixture.service.dailyHistory()

        assertEquals(0, history.missingFxTransactions)
        assertEquals(3, history.points.size)
        assertEquals(BigDecimal("400.00"), history.points[0].totalCurrentValuePln)
        assertEquals(BigDecimal("400.00"), history.points[2].netContributionsPln)
    }

    @Test
    fun `daily history exposes portfolio and benchmark indices`() = runBlocking {
        val fixture = historyFixture()
        val instrument = etfInstrument()
        fixture.accountRepository.save(account())
        fixture.instrumentRepository.save(instrument)
        fixture.transactionRepository.save(depositTransaction())
        fixture.transactionRepository.save(buyTransaction(instrument.id))
        fixture.historyProvider.values[instrument.id] = HistoricalInstrumentValuationResult.Success(
            prices = listOf(
                pricePoint("2026-03-02", "105.00"),
                pricePoint("2026-03-03", "110.00")
            )
        )
        fixture.referenceProvider.usd = ReferenceSeriesResult.Success(prices = listOf(pricePoint("2026-03-01", "4.00")))
        fixture.referenceProvider.gold = ReferenceSeriesResult.Success(prices = listOf(pricePoint("2026-03-01", "12000.00")))
        fixture.referenceProvider.equity = ReferenceSeriesResult.Success(
            prices = listOf(
                pricePoint("2026-03-01", "100.00"),
                pricePoint("2026-03-02", "110.00"),
                pricePoint("2026-03-03", "121.00")
            )
        )
        fixture.referenceProvider.bond = ReferenceSeriesResult.Success(
            prices = listOf(
                pricePoint("2026-03-01", "100.00"),
                pricePoint("2026-03-02", "105.00"),
                pricePoint("2026-03-03", "110.25")
            )
        )
        fixture.inflationProvider.resultByMonth = mapOf(
            YearMonth.parse("2026-03") to InflationAdjustmentResult.Success(
                from = YearMonth.parse("2026-03"),
                until = YearMonth.parse("2026-03"),
                multiplier = BigDecimal("1.02")
            )
        )
        fixture.portfolioTargetRepository.replaceAll(
            listOf(
                PortfolioTarget(
                    id = UUID.nameUUIDFromBytes("equities-target".toByteArray()),
                    assetClass = AssetClass.EQUITIES,
                    targetWeight = BigDecimal("0.80"),
                    createdAt = CREATED_AT,
                    updatedAt = CREATED_AT
                ),
                PortfolioTarget(
                    id = UUID.nameUUIDFromBytes("bonds-target".toByteArray()),
                    assetClass = AssetClass.BONDS,
                    targetWeight = BigDecimal("0.20"),
                    createdAt = CREATED_AT,
                    updatedAt = CREATED_AT
                )
            )
        )

        val history = fixture.service.dailyHistory()
        val lastPoint = history.points.last()

        assertEquals(0, history.benchmarkSeriesIssueCount)
        assertTrue(history.points.first().portfolioPerformanceIndex!!.compareTo(BigDecimal("100")) == 0)
        assertNotNull(lastPoint.equityBenchmarkIndex)
        assertNotNull(lastPoint.inflationBenchmarkIndex)
        assertNotNull(lastPoint.targetMixBenchmarkIndex)
        assertTrue(lastPoint.equityBenchmarkIndex!!.compareTo(BigDecimal("121")) == 0)
        assertTrue(lastPoint.targetMixBenchmarkIndex!!.compareTo(BigDecimal("118.81")) == 0)
    }

    @Test
    fun `daily history starts target mix when required benchmark leg becomes available`() = runBlocking {
        val fixture = historyFixture()
        val instrument = etfInstrument()
        fixture.accountRepository.save(account())
        fixture.instrumentRepository.save(instrument)
        fixture.transactionRepository.save(depositTransaction())
        fixture.transactionRepository.save(buyTransaction(instrument.id))
        fixture.historyProvider.values[instrument.id] = HistoricalInstrumentValuationResult.Success(
            prices = listOf(
                pricePoint("2026-03-02", "105.00"),
                pricePoint("2026-03-03", "110.00")
            )
        )
        fixture.referenceProvider.usd = ReferenceSeriesResult.Success(prices = listOf(pricePoint("2026-03-01", "4.00")))
        fixture.referenceProvider.gold = ReferenceSeriesResult.Success(prices = listOf(pricePoint("2026-03-01", "12000.00")))
        fixture.referenceProvider.equity = ReferenceSeriesResult.Success(
            prices = listOf(
                pricePoint("2026-03-01", "100.00"),
                pricePoint("2026-03-02", "110.00"),
                pricePoint("2026-03-03", "121.00")
            )
        )
        fixture.referenceProvider.bond = ReferenceSeriesResult.Success(
            prices = listOf(
                pricePoint("2026-03-02", "105.00"),
                pricePoint("2026-03-03", "110.25")
            )
        )
        fixture.portfolioTargetRepository.replaceAll(
            listOf(
                PortfolioTarget(
                    id = UUID.nameUUIDFromBytes("equities-target-delayed".toByteArray()),
                    assetClass = AssetClass.EQUITIES,
                    targetWeight = BigDecimal("0.80"),
                    createdAt = CREATED_AT,
                    updatedAt = CREATED_AT
                ),
                PortfolioTarget(
                    id = UUID.nameUUIDFromBytes("bonds-target-delayed".toByteArray()),
                    assetClass = AssetClass.BONDS,
                    targetWeight = BigDecimal("0.20"),
                    createdAt = CREATED_AT,
                    updatedAt = CREATED_AT
                )
            )
        )

        val history = fixture.service.dailyHistory()

        assertEquals(null, history.points.first().targetMixBenchmarkIndex)
        assertTrue(history.points[1].targetMixBenchmarkIndex!!.compareTo(BigDecimal("100")) == 0)
        assertNotNull(history.points.last().targetMixBenchmarkIndex)
    }

    @Test
    fun `daily history keeps inflation benchmark when latest CPI coverage lags current month`() = runBlocking {
        val fixture = historyFixture()
        fixture.accountRepository.save(account())
        fixture.transactionRepository.save(
            depositTransaction(tradeDate = LocalDate.parse("2025-12-01"))
        )
        fixture.referenceProvider.usd = ReferenceSeriesResult.Success(prices = listOf(pricePoint("2025-12-01", "4.00")))
        fixture.referenceProvider.gold = ReferenceSeriesResult.Success(prices = listOf(pricePoint("2025-12-01", "12000.00")))
        fixture.referenceProvider.equity = ReferenceSeriesResult.Failure("Equity benchmark not required.")
        fixture.referenceProvider.bond = ReferenceSeriesResult.Failure("Bond benchmark not required.")
        fixture.inflationProvider.resultByMonth = mapOf(
            YearMonth.parse("2025-12") to InflationAdjustmentResult.Success(
                from = YearMonth.parse("2025-12"),
                until = YearMonth.parse("2026-01"),
                multiplier = BigDecimal("1.02")
            )
        )

        val history = fixture.service.dailyHistory()
        val lastPoint = history.points.last()

        assertNotNull(lastPoint.inflationBenchmarkIndex)
        assertTrue(lastPoint.inflationBenchmarkIndex!!.compareTo(BigDecimal("100")) > 0)
    }

    private fun historyFixture(): HistoryFixture {
        val accountRepository = InMemoryAccountRepository()
        val instrumentRepository = InMemoryInstrumentRepository()
        val portfolioTargetRepository = InMemoryPortfolioTargetRepository()
        val transactionRepository = InMemoryTransactionRepository()
        val historyProvider = FakeHistoricalInstrumentValuationProvider()
        val referenceProvider = FakeReferenceSeriesProvider()
        val fxRateProvider = FakeFxRateHistoryProvider()
        val inflationProvider = FakeInflationAdjustmentProvider()
        val service = PortfolioHistoryService(
            accountRepository = accountRepository,
            instrumentRepository = instrumentRepository,
            portfolioTargetRepository = portfolioTargetRepository,
            transactionRepository = transactionRepository,
            historicalInstrumentValuationProvider = historyProvider,
            referenceSeriesProvider = referenceProvider,
            inflationAdjustmentProvider = inflationProvider,
            transactionFxConversionService = TransactionFxConversionService(fxRateHistoryProvider = fxRateProvider),
            clock = Clock.fixed(Instant.parse("2026-03-03T12:00:00Z"), ZoneOffset.UTC)
        )
        return HistoryFixture(
            service = service,
            accountRepository = accountRepository,
            instrumentRepository = instrumentRepository,
            portfolioTargetRepository = portfolioTargetRepository,
            transactionRepository = transactionRepository,
            historyProvider = historyProvider,
            referenceProvider = referenceProvider,
            fxRateProvider = fxRateProvider,
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

    private fun etfInstrument(): Instrument = Instrument(
        id = UUID.fromString("20000000-0000-0000-0000-000000000001"),
        name = "VWCE",
        kind = InstrumentKind.ETF,
        assetClass = AssetClass.EQUITIES,
        symbol = "VWCE.DE",
        currency = "EUR",
        valuationSource = ValuationSource.STOCK_ANALYST,
        isActive = true,
        createdAt = CREATED_AT,
        updatedAt = CREATED_AT
    )

    private fun depositTransaction(
        grossAmount: String = "2000.00",
        currency: String = "PLN",
        fxRateToPln: BigDecimal? = null,
        tradeDate: LocalDate = LocalDate.parse("2026-03-01")
    ): Transaction = Transaction(
        id = UUID.nameUUIDFromBytes("history-deposit".toByteArray()),
        accountId = ACCOUNT_ID,
        instrumentId = null,
        type = TransactionType.DEPOSIT,
        tradeDate = tradeDate,
        settlementDate = tradeDate,
        quantity = null,
        unitPrice = null,
        grossAmount = BigDecimal(grossAmount),
        feeAmount = BigDecimal.ZERO,
        taxAmount = BigDecimal.ZERO,
        currency = currency,
        fxRateToPln = fxRateToPln,
        notes = "",
        createdAt = CREATED_AT,
        updatedAt = CREATED_AT
    )

    private fun buyTransaction(instrumentId: UUID): Transaction = Transaction(
        id = UUID.nameUUIDFromBytes("history-buy".toByteArray()),
        accountId = ACCOUNT_ID,
        instrumentId = instrumentId,
        type = TransactionType.BUY,
        tradeDate = LocalDate.parse("2026-03-02"),
        settlementDate = LocalDate.parse("2026-03-02"),
        quantity = BigDecimal("10"),
        unitPrice = BigDecimal("100.00"),
        grossAmount = BigDecimal("1000.00"),
        feeAmount = BigDecimal("5.00"),
        taxAmount = BigDecimal.ZERO,
        currency = "PLN",
        fxRateToPln = null,
        notes = "",
        createdAt = CREATED_AT.plusSeconds(1),
        updatedAt = CREATED_AT.plusSeconds(1)
    )

    private fun pricePoint(date: String, closePricePln: String): HistoricalPricePoint =
        HistoricalPricePoint(
            date = LocalDate.parse(date),
            closePricePln = BigDecimal(closePricePln)
        )

    private data class HistoryFixture(
        val service: PortfolioHistoryService,
        val accountRepository: InMemoryAccountRepository,
        val instrumentRepository: InMemoryInstrumentRepository,
        val portfolioTargetRepository: InMemoryPortfolioTargetRepository,
        val transactionRepository: InMemoryTransactionRepository,
        val historyProvider: FakeHistoricalInstrumentValuationProvider,
        val referenceProvider: FakeReferenceSeriesProvider,
        val fxRateProvider: FakeFxRateHistoryProvider,
        val inflationProvider: FakeInflationAdjustmentProvider
    )

    private class FakeHistoricalInstrumentValuationProvider : HistoricalInstrumentValuationProvider {
        val values: MutableMap<UUID, HistoricalInstrumentValuationResult> = linkedMapOf()

        override suspend fun dailyPriceSeries(
            instrument: Instrument,
            from: LocalDate,
            to: LocalDate
        ): HistoricalInstrumentValuationResult = values[instrument.id]
            ?: HistoricalInstrumentValuationResult.Failure(
                type = InstrumentValuationFailureType.UNAVAILABLE,
                reason = "No fake history for ${instrument.name}."
            )
    }

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

    private class FakeFxRateHistoryProvider : FxRateHistoryProvider {
        val values: MutableMap<String, FxRateHistoryResult> = linkedMapOf()

        override suspend fun dailyRateToPln(
            currency: String,
            from: LocalDate,
            to: LocalDate
        ): FxRateHistoryResult = values[currency]
            ?: FxRateHistoryResult.Failure("No fake FX history for $currency.")
    }

    private class FakeInflationAdjustmentProvider : InflationAdjustmentProvider {
        var resultByMonth: Map<YearMonth, InflationAdjustmentResult> = emptyMap()
        var monthlySeriesByRange: Map<Pair<YearMonth, YearMonth>, InflationSeriesResult> = emptyMap()

        override suspend fun cumulativeSince(from: YearMonth): InflationAdjustmentResult =
            resultByMonth[from] ?: InflationAdjustmentResult.Failure("No fake inflation window for $from.")

        override suspend fun monthlySeries(from: YearMonth, untilExclusive: YearMonth): InflationSeriesResult {
            monthlySeriesByRange[from to untilExclusive]?.let { return it }

            val months = generateSequence(from) { current -> current.plusMonths(1) }
                .takeWhile { month -> month.isBefore(untilExclusive) }
                .toList()
            if (months.isEmpty()) {
                return InflationSeriesResult.Success(from = from, until = untilExclusive, points = emptyList())
            }

            val cumulative = months.associateWith { month ->
                resultByMonth[month] as? InflationAdjustmentResult.Success
                    ?: return InflationSeriesResult.Failure("No fake monthly inflation for $month.")
            }

            val points = months.mapIndexed { index, month ->
                val current = cumulative.getValue(month)
                val multiplier = if (index == months.lastIndex) {
                    current.multiplier
                } else {
                    val next = cumulative.getValue(months[index + 1])
                    current.multiplier.divide(next.multiplier, 12, java.math.RoundingMode.HALF_UP)
                }
                MonthlyInflationPoint(month = month, multiplier = multiplier)
            }

            return InflationSeriesResult.Success(
                from = from,
                until = untilExclusive,
                points = points
            )
        }
    }

    private companion object {
        val ACCOUNT_ID: UUID = UUID.fromString("10000000-0000-0000-0000-000000000001")
        val CREATED_AT: Instant = Instant.parse("2026-03-01T12:00:00Z")
    }
}
