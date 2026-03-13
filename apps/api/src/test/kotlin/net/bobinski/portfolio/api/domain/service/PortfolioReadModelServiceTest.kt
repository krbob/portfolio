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
import net.bobinski.portfolio.api.marketdata.service.CurrentInstrumentValuationProvider
import net.bobinski.portfolio.api.marketdata.service.InstrumentValuation
import net.bobinski.portfolio.api.marketdata.service.InstrumentValuationFailureType
import net.bobinski.portfolio.api.marketdata.service.InstrumentValuationResult
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

    private fun portfolioFixture(): PortfolioFixture {
        val accountRepository = InMemoryAccountRepository()
        val instrumentRepository = InMemoryInstrumentRepository()
        val transactionRepository = InMemoryTransactionRepository()
        val valuationProvider = FakeCurrentInstrumentValuationProvider()
        val service = PortfolioReadModelService(
            accountRepository = accountRepository,
            instrumentRepository = instrumentRepository,
            transactionRepository = transactionRepository,
            currentInstrumentValuationProvider = valuationProvider,
            clock = Clock.fixed(Instant.parse("2026-03-13T12:00:00Z"), ZoneOffset.UTC)
        )
        return PortfolioFixture(
            service = service,
            accountRepository = accountRepository,
            instrumentRepository = instrumentRepository,
            transactionRepository = transactionRepository,
            valuationProvider = valuationProvider
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

    private fun depositTransaction(): Transaction = Transaction(
        id = UUID.nameUUIDFromBytes("deposit".toByteArray()),
        accountId = ACCOUNT_ID,
        instrumentId = null,
        type = TransactionType.DEPOSIT,
        tradeDate = LocalDate.parse("2026-03-01"),
        settlementDate = LocalDate.parse("2026-03-01"),
        quantity = null,
        unitPrice = null,
        grossAmount = BigDecimal("2000.00"),
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
        quantity: String,
        grossAmount: String,
        feeAmount: String,
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
        feeAmount = BigDecimal(feeAmount),
        taxAmount = BigDecimal.ZERO,
        currency = "PLN",
        fxRateToPln = null,
        notes = "",
        createdAt = CREATED_AT.plusSeconds(tradeDate.dayOfMonth.toLong()),
        updatedAt = CREATED_AT.plusSeconds(tradeDate.dayOfMonth.toLong())
    )

    private data class PortfolioFixture(
        val service: PortfolioReadModelService,
        val accountRepository: InMemoryAccountRepository,
        val instrumentRepository: InMemoryInstrumentRepository,
        val transactionRepository: InMemoryTransactionRepository,
        val valuationProvider: FakeCurrentInstrumentValuationProvider
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

    private companion object {
        val ACCOUNT_ID: UUID = UUID.fromString("10000000-0000-0000-0000-000000000001")
        val CREATED_AT: Instant = Instant.parse("2026-03-01T12:00:00Z")
    }
}
