package net.bobinski.portfolio.api.domain.service

import kotlinx.coroutines.runBlocking
import net.bobinski.portfolio.api.domain.model.Account
import net.bobinski.portfolio.api.domain.model.AccountType
import net.bobinski.portfolio.api.domain.model.AssetClass
import net.bobinski.portfolio.api.domain.model.EdoTerms
import net.bobinski.portfolio.api.domain.model.Instrument
import net.bobinski.portfolio.api.domain.model.InstrumentKind
import net.bobinski.portfolio.api.domain.model.Transaction
import net.bobinski.portfolio.api.domain.model.TransactionType
import net.bobinski.portfolio.api.domain.model.ValuationSource
import net.bobinski.portfolio.api.marketdata.model.HistoricalPricePoint
import net.bobinski.portfolio.api.marketdata.service.CurrentInstrumentValuationProvider
import net.bobinski.portfolio.api.marketdata.service.EdoLotValuationProvider
import net.bobinski.portfolio.api.marketdata.service.FxRateHistoryProvider
import net.bobinski.portfolio.api.marketdata.service.FxRateHistoryResult
import net.bobinski.portfolio.api.marketdata.service.HistoricalInstrumentValuationResult
import net.bobinski.portfolio.api.marketdata.service.InstrumentValuation
import net.bobinski.portfolio.api.marketdata.service.InstrumentValuationFailureType
import net.bobinski.portfolio.api.marketdata.service.InstrumentValuationResult
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryAccountRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryInstrumentRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryTransactionRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.math.BigDecimal
import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.time.YearMonth
import java.time.ZoneOffset
import java.util.UUID

class PortfolioReadModelServiceTest {

    @Test
    fun `overview uses current valuations when all holdings are valued`() = runBlocking {
        val fixture = portfolioFixture()
        fixture.accountRepository.save(account())
        val vwce = etfInstrument(name = "VWCE", symbol = "VWCE.DE")
        fixture.instrumentRepository.save(vwce)
        fixture.transactionRepository.save(depositTransaction())
        fixture.transactionRepository.save(
            buyTransaction(
                instrumentId = vwce.id,
                quantity = "10",
                grossAmount = "1000.00",
                feeAmount = "5.00"
            )
        )
        fixture.valuationProvider.values[vwce.id] = InstrumentValuationResult.Success(
            InstrumentValuation(
                pricePerUnitPln = BigDecimal("120.00"),
                valuedAt = LocalDate.parse("2026-03-10")
            )
        )

        val overview = fixture.service.overview()
        val holdings = fixture.service.holdings()

        assertEquals(ValuationState.MARK_TO_MARKET, overview.valuationState)
        assertEquals(BigDecimal("2000.00"), overview.totalBookValuePln)
        assertEquals(BigDecimal("2195.00"), overview.totalCurrentValuePln)
        assertEquals(BigDecimal("1200.00"), overview.investedCurrentValuePln)
        assertEquals(BigDecimal("195.00"), overview.totalUnrealizedGainPln)
        assertEquals(1, overview.valuedHoldingCount)
        assertEquals(0, overview.unvaluedHoldingCount)
        assertEquals(BigDecimal("120.00"), holdings.single().currentPricePln)
        assertEquals(BigDecimal("1200.00"), holdings.single().currentValuePln)
        assertEquals(BigDecimal("195.00"), holdings.single().unrealizedGainPln)
        assertEquals(HoldingValuationStatus.VALUED, holdings.single().valuationStatus)
    }

    @Test
    fun `overview falls back to book basis for unvalued holdings`() = runBlocking {
        val fixture = portfolioFixture()
        fixture.accountRepository.save(account())
        val vwce = etfInstrument(name = "VWCE", symbol = "VWCE.DE")
        val spyl = etfInstrument(name = "SPYL", symbol = "SPYL.DE")
        fixture.instrumentRepository.save(vwce)
        fixture.instrumentRepository.save(spyl)
        fixture.transactionRepository.save(depositTransaction())
        fixture.transactionRepository.save(
            buyTransaction(
                instrumentId = vwce.id,
                quantity = "10",
                grossAmount = "1000.00",
                feeAmount = "5.00"
            )
        )
        fixture.transactionRepository.save(
            buyTransaction(
                instrumentId = spyl.id,
                quantity = "5",
                grossAmount = "500.00",
                feeAmount = "0.00",
                tradeDate = LocalDate.parse("2026-03-03")
            )
        )
        fixture.valuationProvider.values[vwce.id] = InstrumentValuationResult.Success(
            InstrumentValuation(
                pricePerUnitPln = BigDecimal("120.00"),
                valuedAt = LocalDate.parse("2026-03-10")
            )
        )
        fixture.valuationProvider.values[spyl.id] = InstrumentValuationResult.Failure(
            type = InstrumentValuationFailureType.UNAVAILABLE,
            reason = "Quote service unavailable."
        )

        val overview = fixture.service.overview()
        val holdings = fixture.service.holdings().associateBy { it.instrumentName }

        assertEquals(ValuationState.PARTIALLY_VALUED, overview.valuationState)
        assertEquals(BigDecimal("2000.00"), overview.totalBookValuePln)
        assertEquals(BigDecimal("2195.00"), overview.totalCurrentValuePln)
        assertEquals(BigDecimal("1700.00"), overview.investedCurrentValuePln)
        assertEquals(BigDecimal("195.00"), overview.totalUnrealizedGainPln)
        assertEquals(1, overview.valuedHoldingCount)
        assertEquals(1, overview.unvaluedHoldingCount)
        assertEquals(1, overview.valuationIssueCount)
        assertEquals(HoldingValuationStatus.UNAVAILABLE, holdings.getValue("SPYL").valuationStatus)
        assertEquals("Quote service unavailable.", holdings.getValue("SPYL").valuationIssue)
        assertEquals(null, holdings.getValue("SPYL").currentValuePln)
    }

    @Test
    fun `overview marks stale market valuations without falling back to book basis`() = runBlocking {
        val fixture = portfolioFixture()
        fixture.accountRepository.save(account())
        val vwce = etfInstrument(name = "VWCE", symbol = "VWCE.DE")
        fixture.instrumentRepository.save(vwce)
        fixture.transactionRepository.save(depositTransaction())
        fixture.transactionRepository.save(
            buyTransaction(
                instrumentId = vwce.id,
                quantity = "10",
                grossAmount = "1000.00",
                feeAmount = "5.00"
            )
        )
        fixture.valuationProvider.values[vwce.id] = InstrumentValuationResult.Success(
            InstrumentValuation(
                pricePerUnitPln = BigDecimal("120.00"),
                valuedAt = LocalDate.parse("2026-03-09")
            )
        )

        val overview = fixture.service.overview()
        val holding = fixture.service.holdings().single()
        val account = fixture.service.accounts().single()

        assertEquals(ValuationState.STALE, overview.valuationState)
        assertEquals(1, overview.valuedHoldingCount)
        assertEquals(0, overview.unvaluedHoldingCount)
        assertEquals(BigDecimal("2195.00"), overview.totalCurrentValuePln)
        assertEquals(HoldingValuationStatus.STALE, holding.valuationStatus)
        assertEquals("Last market valuation is from 2026-03-09.", holding.valuationIssue)
        assertEquals(ValuationState.STALE, account.valuationState)
    }

    @Test
    fun `overview marks cached market valuations as stale with cache-specific issue`() = runBlocking {
        val fixture = portfolioFixture()
        fixture.accountRepository.save(account())
        val vwce = etfInstrument(name = "VWCE", symbol = "VWCE.DE")
        fixture.instrumentRepository.save(vwce)
        fixture.transactionRepository.save(depositTransaction())
        fixture.transactionRepository.save(
            buyTransaction(
                instrumentId = vwce.id,
                quantity = "10",
                grossAmount = "1000.00",
                feeAmount = "5.00"
            )
        )
        fixture.valuationProvider.values[vwce.id] = InstrumentValuationResult.Success(
            valuation = InstrumentValuation(
                pricePerUnitPln = BigDecimal("120.00"),
                valuedAt = LocalDate.parse("2026-03-10")
            ),
            fromCache = true
        )

        val overview = fixture.service.overview()
        val holding = fixture.service.holdings().single()

        assertEquals(ValuationState.STALE, overview.valuationState)
        assertEquals(HoldingValuationStatus.STALE, holding.valuationStatus)
        assertEquals("Using cached market valuation from 2026-03-10.", holding.valuationIssue)
        assertEquals(BigDecimal("2195.00"), overview.totalCurrentValuePln)
    }

    @Test
    fun `overview resolves missing fx from historical rates`() = runBlocking {
        val fixture = portfolioFixture()
        fixture.accountRepository.save(account(baseCurrency = "USD"))
        fixture.transactionRepository.save(
            depositTransaction(
                grossAmount = "100.00",
                currency = "USD"
            )
        )
        fixture.fxRateProvider.values["USD"] = FxRateHistoryResult.Success(
            prices = listOf(
                pricePoint(date = "2026-03-01", closePricePln = "4.00")
            )
        )

        val overview = fixture.service.overview()

        assertEquals(BigDecimal("400.00"), overview.totalBookValuePln)
        assertEquals(BigDecimal("400.00"), overview.totalCurrentValuePln)
        assertEquals(BigDecimal("400.00"), overview.cashBalancePln)
        assertEquals(BigDecimal("400.00"), overview.netContributionsPln)
        assertEquals(1, overview.cashBalances.size)
        assertEquals("USD", overview.cashBalances.single().currency)
        assertEquals(0, overview.cashBalances.single().amount.compareTo(BigDecimal("100")))
        assertEquals(BigDecimal("400.00"), overview.cashBalances.single().bookValuePln)
        assertEquals(1, overview.netContributionBalances.size)
        assertEquals("USD", overview.netContributionBalances.single().currency)
        assertEquals(0, overview.missingFxTransactions)
    }

    @Test
    fun `overview removes redeemed EDO lots from holdings and leaves redemption cash`() = runBlocking {
        val fixture = portfolioFixture()
        fixture.accountRepository.save(account())
        val edo = edoInstrument()
        fixture.instrumentRepository.save(edo)
        fixture.transactionRepository.save(depositTransaction())
        fixture.transactionRepository.save(
            buyTransaction(
                instrumentId = edo.id,
                quantity = "10",
                grossAmount = "1000.00",
                feeAmount = "0.00"
            )
        )
        fixture.transactionRepository.save(
            redeemTransaction(
                instrumentId = edo.id,
                quantity = "10",
                grossAmount = "1080.00",
                taxAmount = "15.20",
                tradeDate = LocalDate.parse("2026-03-03")
            )
        )

        val overview = fixture.service.overview()
        val holdings = fixture.service.holdings()

        assertEquals(BigDecimal("2064.80"), overview.totalCurrentValuePln)
        assertEquals(BigDecimal("2064.80"), overview.cashBalancePln)
        assertEquals(0, overview.investedCurrentValuePln.compareTo(BigDecimal.ZERO))
        assertTrue(holdings.isEmpty())
    }

    @Test
    fun `holdings expose EDO lots grouped by purchase date`() = runBlocking {
        val fixture = portfolioFixture()
        fixture.accountRepository.save(account())
        val edo = edoInstrument()
        fixture.instrumentRepository.save(edo)
        fixture.transactionRepository.save(depositTransaction(grossAmount = "15000.00"))
        fixture.transactionRepository.save(
            buyTransaction(
                instrumentId = edo.id,
                quantity = "70",
                grossAmount = "7000.00",
                feeAmount = "0.00",
                tradeDate = LocalDate.parse("2026-03-02")
            )
        )
        fixture.transactionRepository.save(
            buyTransaction(
                instrumentId = edo.id,
                quantity = "30",
                grossAmount = "3000.00",
                feeAmount = "0.00",
                tradeDate = LocalDate.parse("2026-03-22")
            )
        )
        fixture.edoLotValuationProvider.values[LocalDate.parse("2026-03-02")] = InstrumentValuationResult.Success(
            InstrumentValuation(
                pricePerUnitPln = BigDecimal("102.10"),
                valuedAt = LocalDate.parse("2026-03-13")
            )
        )
        fixture.edoLotValuationProvider.values[LocalDate.parse("2026-03-22")] = InstrumentValuationResult.Success(
            InstrumentValuation(
                pricePerUnitPln = BigDecimal("100.40"),
                valuedAt = LocalDate.parse("2026-03-13")
            )
        )

        val holding = fixture.service.holdings().single()

        assertEquals("EDO0336", holding.instrumentName)
        assertEquals(0, holding.quantity.compareTo(BigDecimal("100")))
        assertEquals(BigDecimal("101.59"), holding.currentPricePln)
        assertEquals(BigDecimal("10159.00"), holding.currentValuePln)
        assertEquals(2, holding.edoLots.size)
        assertEquals(LocalDate.parse("2026-03-02"), holding.edoLots[0].purchaseDate)
        assertEquals(0, holding.edoLots[0].quantity.compareTo(BigDecimal("70")))
        assertEquals(BigDecimal("7147.00"), holding.edoLots[0].currentValuePln)
        assertEquals(LocalDate.parse("2026-03-22"), holding.edoLots[1].purchaseDate)
        assertEquals(0, holding.edoLots[1].quantity.compareTo(BigDecimal("30")))
        assertEquals(BigDecimal("3012.00"), holding.edoLots[1].currentValuePln)
    }

    @Test
    fun `accounts expose per-account cash weights and gains`() = runBlocking {
        val fixture = portfolioFixture()
        val primary = account()
        val reserve = account(
            id = UUID.fromString("10000000-0000-0000-0000-000000000002"),
            name = "Reserve"
        )
        fixture.accountRepository.save(primary)
        fixture.accountRepository.save(reserve)
        val vwce = etfInstrument(name = "VWCE", symbol = "VWCE.DE")
        fixture.instrumentRepository.save(vwce)
        fixture.transactionRepository.save(
            depositTransaction(
                accountId = primary.id,
                grossAmount = "2000.00"
            )
        )
        fixture.transactionRepository.save(
            buyTransaction(
                accountId = primary.id,
                instrumentId = vwce.id,
                quantity = "10",
                grossAmount = "1000.00",
                feeAmount = "5.00"
            )
        )
        fixture.transactionRepository.save(
            depositTransaction(
                accountId = reserve.id,
                grossAmount = "500.00",
                tradeDate = LocalDate.parse("2026-03-03")
            )
        )
        fixture.valuationProvider.values[vwce.id] = InstrumentValuationResult.Success(
            InstrumentValuation(
                pricePerUnitPln = BigDecimal("120.00"),
                valuedAt = LocalDate.parse("2026-03-10")
            )
        )

        val accounts = fixture.service.accounts()

        val primarySummary = accounts.first { it.accountId == primary.id }
        val reserveSummary = accounts.first { it.accountId == reserve.id }

        assertEquals(ValuationState.MARK_TO_MARKET, primarySummary.valuationState)
        assertEquals(BigDecimal("995.00"), primarySummary.cashBalancePln)
        assertEquals(BigDecimal("1200.00"), primarySummary.investedCurrentValuePln)
        assertEquals(BigDecimal("2195.00"), primarySummary.totalCurrentValuePln)
        assertEquals(BigDecimal("195.00"), primarySummary.totalUnrealizedGainPln)
        assertEquals(BigDecimal("81.45"), primarySummary.portfolioWeightPct)
        assertEquals(listOf("PLN"), primarySummary.cashBalances.map { it.currency })
        assertEquals(BigDecimal("995"), primarySummary.cashBalances.single().amount)
        assertEquals(BigDecimal("500.00"), reserveSummary.cashBalancePln)
        assertEquals(BigDecimal("18.55"), reserveSummary.portfolioWeightPct)
        assertEquals(listOf("PLN"), reserveSummary.cashBalances.map { it.currency })
        assertEquals(0, reserveSummary.activeHoldingCount)
    }

    @Test
    fun `accounts keep native cash balances split by currency`() = runBlocking {
        val fixture = portfolioFixture()
        val account = account(baseCurrency = "USD")
        fixture.accountRepository.save(account)
        fixture.transactionRepository.save(
            depositTransaction(
                accountId = account.id,
                grossAmount = "1000.00",
                currency = "PLN"
            )
        )
        fixture.transactionRepository.save(
            depositTransaction(
                accountId = account.id,
                grossAmount = "100.00",
                currency = "USD"
            )
        )
        fixture.fxRateProvider.values["USD"] = FxRateHistoryResult.Success(
            prices = listOf(
                pricePoint(date = "2026-03-01", closePricePln = "4.00")
            )
        )

        val summary = fixture.service.accounts().single()

        assertEquals(BigDecimal("1400.00"), summary.cashBalancePln)
        assertEquals(listOf("PLN", "USD"), summary.cashBalances.map { it.currency })
        assertEquals(0, summary.cashBalances[0].amount.compareTo(BigDecimal("1000")))
        assertEquals(BigDecimal("1000.00"), summary.cashBalances[0].bookValuePln)
        assertEquals(0, summary.cashBalances[1].amount.compareTo(BigDecimal("100")))
        assertEquals(BigDecimal("400.00"), summary.cashBalances[1].bookValuePln)
        assertEquals(listOf("PLN", "USD"), summary.netContributionBalances.map { it.currency })
    }

    private fun portfolioFixture(
        clock: Clock = Clock.fixed(Instant.parse("2026-03-13T12:00:00Z"), ZoneOffset.UTC)
    ): PortfolioFixture {
        val accountRepository = InMemoryAccountRepository()
        val instrumentRepository = InMemoryInstrumentRepository()
        val transactionRepository = InMemoryTransactionRepository()
        val valuationProvider = FakeCurrentInstrumentValuationProvider()
        val edoLotValuationProvider = FakeEdoLotValuationProvider()
        val fxRateProvider = FakeFxRateHistoryProvider()
        val service = PortfolioReadModelService(
            accountRepository = accountRepository,
            instrumentRepository = instrumentRepository,
            transactionRepository = transactionRepository,
            currentInstrumentValuationProvider = valuationProvider,
            edoLotValuationProvider = edoLotValuationProvider,
            transactionFxConversionService = TransactionFxConversionService(fxRateHistoryProvider = fxRateProvider),
            clock = clock
        )
        return PortfolioFixture(
            service = service,
            accountRepository = accountRepository,
            instrumentRepository = instrumentRepository,
            transactionRepository = transactionRepository,
            valuationProvider = valuationProvider,
            edoLotValuationProvider = edoLotValuationProvider,
            fxRateProvider = fxRateProvider
        )
    }

    private fun account(
        id: UUID = ACCOUNT_ID,
        name: String = "Primary",
        baseCurrency: String = "PLN"
    ): Account = Account(
        id = id,
        name = name,
        institution = "Broker",
        type = AccountType.BROKERAGE,
        baseCurrency = baseCurrency,
        isActive = true,
        createdAt = CREATED_AT,
        updatedAt = CREATED_AT
    )

    private fun etfInstrument(name: String, symbol: String): Instrument {
        val id = UUID.nameUUIDFromBytes(name.toByteArray())
        return Instrument(
            id = id,
            name = name,
            kind = InstrumentKind.ETF,
            assetClass = AssetClass.EQUITIES,
            symbol = symbol,
            currency = "EUR",
            valuationSource = ValuationSource.STOCK_ANALYST,
            isActive = true,
            createdAt = CREATED_AT,
            updatedAt = CREATED_AT
        )
    }

    private fun edoInstrument(): Instrument = Instrument(
        id = UUID.fromString("30000000-0000-0000-0000-000000000001"),
        name = "EDO0336",
        kind = InstrumentKind.BOND_EDO,
        assetClass = AssetClass.BONDS,
        symbol = null,
        currency = "PLN",
        valuationSource = ValuationSource.EDO_CALCULATOR,
        edoTerms = EdoTerms(
            seriesMonth = YearMonth.parse("2026-03"),
            firstPeriodRateBps = 500,
            marginBps = 150
        ),
        isActive = true,
        createdAt = CREATED_AT,
        updatedAt = CREATED_AT
    )

    private fun depositTransaction(
        accountId: UUID = ACCOUNT_ID,
        grossAmount: String = "2000.00",
        currency: String = "PLN",
        fxRateToPln: BigDecimal? = null,
        tradeDate: LocalDate = LocalDate.parse("2026-03-01")
    ): Transaction = Transaction(
        id = UUID.nameUUIDFromBytes("deposit-$accountId-$tradeDate-$grossAmount-$currency".toByteArray()),
        accountId = accountId,
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

    private fun buyTransaction(
        accountId: UUID = ACCOUNT_ID,
        instrumentId: UUID,
        quantity: String,
        grossAmount: String,
        feeAmount: String,
        tradeDate: LocalDate = LocalDate.parse("2026-03-02")
    ): Transaction = Transaction(
        id = UUID.nameUUIDFromBytes("$accountId-$instrumentId-$tradeDate".toByteArray()),
        accountId = accountId,
        instrumentId = instrumentId,
        type = TransactionType.BUY,
        tradeDate = tradeDate,
        settlementDate = tradeDate,
        quantity = BigDecimal(quantity),
        unitPrice = BigDecimal("100.00"),
        grossAmount = BigDecimal(grossAmount),
        feeAmount = BigDecimal(feeAmount),
        taxAmount = BigDecimal.ZERO,
        currency = "PLN",
        fxRateToPln = null,
        notes = "",
        createdAt = CREATED_AT.plusSeconds(tradeDate.dayOfMonth.toLong()),
        updatedAt = CREATED_AT.plusSeconds(tradeDate.dayOfMonth.toLong())
    )

    private fun redeemTransaction(
        accountId: UUID = ACCOUNT_ID,
        instrumentId: UUID,
        quantity: String,
        grossAmount: String,
        taxAmount: String,
        tradeDate: LocalDate
    ): Transaction = Transaction(
        id = UUID.nameUUIDFromBytes("redeem-$accountId-$instrumentId-$tradeDate".toByteArray()),
        accountId = accountId,
        instrumentId = instrumentId,
        type = TransactionType.REDEEM,
        tradeDate = tradeDate,
        settlementDate = tradeDate,
        quantity = BigDecimal(quantity),
        unitPrice = BigDecimal("108.00"),
        grossAmount = BigDecimal(grossAmount),
        feeAmount = BigDecimal.ZERO,
        taxAmount = BigDecimal(taxAmount),
        currency = "PLN",
        fxRateToPln = null,
        notes = "",
        createdAt = CREATED_AT.plusSeconds(tradeDate.dayOfMonth.toLong()),
        updatedAt = CREATED_AT.plusSeconds(tradeDate.dayOfMonth.toLong())
    )

    private fun pricePoint(date: String, closePricePln: String): HistoricalPricePoint =
        HistoricalPricePoint(
            date = LocalDate.parse(date),
            closePricePln = BigDecimal(closePricePln)
        )

    private data class PortfolioFixture(
        val service: PortfolioReadModelService,
        val accountRepository: InMemoryAccountRepository,
        val instrumentRepository: InMemoryInstrumentRepository,
        val transactionRepository: InMemoryTransactionRepository,
        val valuationProvider: FakeCurrentInstrumentValuationProvider,
        val edoLotValuationProvider: FakeEdoLotValuationProvider,
        val fxRateProvider: FakeFxRateHistoryProvider
    )

    private class FakeCurrentInstrumentValuationProvider : CurrentInstrumentValuationProvider {
        val values: MutableMap<UUID, InstrumentValuationResult> = linkedMapOf()

        override suspend fun value(instrument: Instrument): InstrumentValuationResult =
            values[instrument.id]
                ?: InstrumentValuationResult.Failure(
                    type = InstrumentValuationFailureType.UNAVAILABLE,
                    reason = "No fake valuation for ${instrument.name}."
                )
    }

    private class FakeEdoLotValuationProvider : EdoLotValuationProvider {
        val values: MutableMap<LocalDate, InstrumentValuationResult> = linkedMapOf()

        override suspend fun value(lotTerms: net.bobinski.portfolio.api.domain.model.EdoLotTerms): InstrumentValuationResult =
            values[lotTerms.purchaseDate]
                ?: InstrumentValuationResult.Failure(
                    type = InstrumentValuationFailureType.UNAVAILABLE,
                    reason = "No fake EDO lot valuation for ${lotTerms.purchaseDate}."
                )

        override suspend fun dailyPriceSeries(
            lotTerms: net.bobinski.portfolio.api.domain.model.EdoLotTerms,
            from: LocalDate,
            to: LocalDate
        ): HistoricalInstrumentValuationResult =
            throw UnsupportedOperationException("Not used in read model tests.")
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
