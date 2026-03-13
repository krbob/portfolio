package net.bobinski.portfolio.api.domain.service

import java.math.BigDecimal
import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import java.util.UUID
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
import net.bobinski.portfolio.api.marketdata.service.CurrentInstrumentValuationProvider
import net.bobinski.portfolio.api.marketdata.service.FxRateHistoryProvider
import net.bobinski.portfolio.api.marketdata.service.FxRateHistoryResult
import net.bobinski.portfolio.api.marketdata.service.InstrumentValuationResult
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryAccountRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryInstrumentRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryPortfolioTargetRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryTransactionRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

class PortfolioAllocationServiceTest {

    @Test
    fun `summary reports drift and deployable cash suggestions`() = runBlocking {
        val accountRepository = InMemoryAccountRepository()
        val instrumentRepository = InMemoryInstrumentRepository()
        val transactionRepository = InMemoryTransactionRepository()
        val targetRepository = InMemoryPortfolioTargetRepository()
        val readModelService = PortfolioReadModelService(
            accountRepository = accountRepository,
            instrumentRepository = instrumentRepository,
            transactionRepository = transactionRepository,
            currentInstrumentValuationProvider = NoopValuationProvider,
            transactionFxConversionService = TransactionFxConversionService(NoopFxRateProvider),
            clock = CLOCK
        )
        val targetService = PortfolioTargetService(
            portfolioTargetRepository = targetRepository,
            clock = CLOCK
        )
        val allocationService = PortfolioAllocationService(
            portfolioTargetRepository = targetRepository,
            portfolioReadModelService = readModelService
        )

        accountRepository.save(account())
        instrumentRepository.save(equityInstrument())
        instrumentRepository.save(bondInstrument())
        transactionRepository.save(depositTransaction("10000.00"))
        transactionRepository.save(buyTransaction(EQUITY_ID, "6000.00", "60"))
        transactionRepository.save(buyTransaction(BOND_ID, "2000.00", "20", tradeDate = LocalDate.parse("2026-03-03")))
        targetService.replace(
            ReplacePortfolioTargetsCommand(
                items = listOf(
                    ReplacePortfolioTargetItem(AssetClass.EQUITIES, BigDecimal("0.80")),
                    ReplacePortfolioTargetItem(AssetClass.BONDS, BigDecimal("0.20")),
                    ReplacePortfolioTargetItem(AssetClass.CASH, BigDecimal("0.00"))
                )
            )
        )

        val summary = allocationService.summary()
        val equities = summary.buckets.first { it.assetClass == AssetClass.EQUITIES }
        val bonds = summary.buckets.first { it.assetClass == AssetClass.BONDS }
        val cash = summary.buckets.first { it.assetClass == AssetClass.CASH }

        assertEquals(true, summary.configured)
        assertEquals(BigDecimal("100.00"), summary.targetWeightSumPct)
        assertEquals(BigDecimal("2000.00"), summary.availableCashPln)
        assertEquals(AllocationBucketStatus.UNDERWEIGHT, equities.status)
        assertEquals(BigDecimal("60.00"), equities.currentWeightPct)
        assertEquals(BigDecimal("80.00"), equities.targetWeightPct)
        assertEquals(BigDecimal("-20.00"), equities.driftPctPoints)
        assertEquals(BigDecimal("2000.00"), equities.gapValuePln)
        assertEquals(BigDecimal("2000.00"), equities.suggestedContributionPln)
        assertEquals(AllocationBucketStatus.ON_TARGET, bonds.status)
        assertEquals(BigDecimal("0.00"), bonds.gapValuePln)
        assertEquals(AllocationBucketStatus.OVERWEIGHT, cash.status)
        assertEquals(BigDecimal("-2000.00"), cash.gapValuePln)
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

    private fun equityInstrument(): Instrument = Instrument(
        id = EQUITY_ID,
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

    private fun bondInstrument(): Instrument = Instrument(
        id = BOND_ID,
        name = "EDO 2036",
        kind = InstrumentKind.BOND_EDO,
        assetClass = AssetClass.BONDS,
        symbol = null,
        currency = "PLN",
        valuationSource = ValuationSource.EDO_CALCULATOR,
        edoTerms = EdoTerms(
            purchaseDate = LocalDate.parse("2026-03-03"),
            firstPeriodRateBps = 500,
            marginBps = 150,
            principalUnits = 20,
            maturityDate = LocalDate.parse("2036-03-03")
        ),
        isActive = true,
        createdAt = CREATED_AT,
        updatedAt = CREATED_AT
    )

    private fun depositTransaction(amount: String): Transaction = Transaction(
        id = UUID.nameUUIDFromBytes("deposit".toByteArray()),
        accountId = ACCOUNT_ID,
        instrumentId = null,
        type = TransactionType.DEPOSIT,
        tradeDate = LocalDate.parse("2026-03-01"),
        settlementDate = LocalDate.parse("2026-03-01"),
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

    private fun buyTransaction(
        instrumentId: UUID,
        grossAmount: String,
        quantity: String,
        tradeDate: LocalDate = LocalDate.parse("2026-03-02")
    ): Transaction = Transaction(
        id = UUID.nameUUIDFromBytes("$instrumentId-$tradeDate".toByteArray()),
        accountId = ACCOUNT_ID,
        instrumentId = instrumentId,
        type = TransactionType.BUY,
        tradeDate = tradeDate,
        settlementDate = tradeDate,
        quantity = BigDecimal(quantity),
        unitPrice = BigDecimal("100.00"),
        grossAmount = BigDecimal(grossAmount),
        feeAmount = BigDecimal.ZERO,
        taxAmount = BigDecimal.ZERO,
        currency = "PLN",
        fxRateToPln = null,
        notes = "",
        createdAt = CREATED_AT.plusSeconds(tradeDate.dayOfMonth.toLong()),
        updatedAt = CREATED_AT.plusSeconds(tradeDate.dayOfMonth.toLong())
    )

    private object NoopValuationProvider : CurrentInstrumentValuationProvider {
        override suspend fun value(instrument: Instrument): InstrumentValuationResult =
            InstrumentValuationResult.Failure(
                type = net.bobinski.portfolio.api.marketdata.service.InstrumentValuationFailureType.UNAVAILABLE,
                reason = "No live quote in test."
            )
    }

    private object NoopFxRateProvider : FxRateHistoryProvider {
        override suspend fun dailyRateToPln(currency: String, from: LocalDate, to: LocalDate): FxRateHistoryResult =
            FxRateHistoryResult.Success(emptyList())
    }

    companion object {
        private val CLOCK = Clock.fixed(Instant.parse("2026-03-13T12:00:00Z"), ZoneOffset.UTC)
        private val CREATED_AT = Instant.parse("2026-03-01T10:00:00Z")
        private val ACCOUNT_ID = UUID.fromString("11111111-1111-1111-1111-111111111111")
        private val EQUITY_ID = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1")
        private val BOND_ID = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1")
    }
}
