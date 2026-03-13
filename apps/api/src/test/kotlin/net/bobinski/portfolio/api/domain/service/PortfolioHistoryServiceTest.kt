package net.bobinski.portfolio.api.domain.service

import kotlinx.coroutines.runBlocking
import net.bobinski.portfolio.api.domain.model.Account
import net.bobinski.portfolio.api.domain.model.AccountType
import net.bobinski.portfolio.api.domain.model.AssetClass
import net.bobinski.portfolio.api.domain.model.Instrument
import net.bobinski.portfolio.api.domain.model.InstrumentKind
import net.bobinski.portfolio.api.domain.model.Transaction
import net.bobinski.portfolio.api.domain.model.TransactionType
import net.bobinski.portfolio.api.domain.model.ValuationSource
import net.bobinski.portfolio.api.marketdata.model.HistoricalPricePoint
import net.bobinski.portfolio.api.marketdata.service.FxRateHistoryProvider
import net.bobinski.portfolio.api.marketdata.service.FxRateHistoryResult
import net.bobinski.portfolio.api.marketdata.service.HistoricalInstrumentValuationProvider
import net.bobinski.portfolio.api.marketdata.service.HistoricalInstrumentValuationResult
import net.bobinski.portfolio.api.marketdata.service.InstrumentValuationFailureType
import net.bobinski.portfolio.api.marketdata.service.ReferenceSeriesProvider
import net.bobinski.portfolio.api.marketdata.service.ReferenceSeriesResult
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryAccountRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryInstrumentRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryTransactionRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import java.math.BigDecimal
import java.time.Clock
import java.time.Instant
import java.time.LocalDate
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

    private fun historyFixture(): HistoryFixture {
        val accountRepository = InMemoryAccountRepository()
        val instrumentRepository = InMemoryInstrumentRepository()
        val transactionRepository = InMemoryTransactionRepository()
        val historyProvider = FakeHistoricalInstrumentValuationProvider()
        val referenceProvider = FakeReferenceSeriesProvider()
        val fxRateProvider = FakeFxRateHistoryProvider()
        val service = PortfolioHistoryService(
            accountRepository = accountRepository,
            instrumentRepository = instrumentRepository,
            transactionRepository = transactionRepository,
            historicalInstrumentValuationProvider = historyProvider,
            referenceSeriesProvider = referenceProvider,
            transactionFxConversionService = TransactionFxConversionService(fxRateHistoryProvider = fxRateProvider),
            clock = Clock.fixed(Instant.parse("2026-03-03T12:00:00Z"), ZoneOffset.UTC)
        )
        return HistoryFixture(
            service = service,
            accountRepository = accountRepository,
            instrumentRepository = instrumentRepository,
            transactionRepository = transactionRepository,
            historyProvider = historyProvider,
            referenceProvider = referenceProvider,
            fxRateProvider = fxRateProvider
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
        val transactionRepository: InMemoryTransactionRepository,
        val historyProvider: FakeHistoricalInstrumentValuationProvider,
        val referenceProvider: FakeReferenceSeriesProvider,
        val fxRateProvider: FakeFxRateHistoryProvider
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

        override suspend fun usdPln(from: LocalDate, to: LocalDate): ReferenceSeriesResult = usd

        override suspend fun goldPln(from: LocalDate, to: LocalDate): ReferenceSeriesResult = gold
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

    private companion object {
        val ACCOUNT_ID: UUID = UUID.fromString("10000000-0000-0000-0000-000000000001")
        val CREATED_AT: Instant = Instant.parse("2026-03-01T12:00:00Z")
    }
}
