package net.bobinski.portfolio.api.domain.service

import net.bobinski.portfolio.api.domain.model.Transaction
import net.bobinski.portfolio.api.domain.model.TransactionType
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Test
import java.math.BigDecimal
import java.time.Instant
import java.time.LocalDate
import java.time.YearMonth
import java.util.UUID

class PortfolioReturnsServiceCalculatorTest {
    @Test
    fun `metric keeps cash-flow adjusted time weighted return`() {
        val metric = PortfolioReturnCalculator.calculateMetric(
            start = date("2025-01-01"),
            end = date("2026-01-01"),
            values = listOf(
                valuation("2024-12-31", "100"),
                valuation("2025-01-01", "100"),
                valuation("2025-07-01", "160"),
                valuation("2026-01-01", "170")
            ),
            cashFlows = listOf(cashFlow("2025-07-01", "-50"))
        )

        assertNotNull(metric)
        assertEquals(0, metric?.timeWeightedReturn?.compareTo(BigDecimal("0.16875")))
        assertNotNull(metric?.moneyWeightedReturn)
        assertNotNull(metric?.annualizedMoneyWeightedReturn)
    }

    @Test
    fun `xirr keeps the annual return for a one year investment`() {
        val result = XirrCalculator.calculate(
            listOf(
                cashFlow("2025-01-01", "-100"),
                cashFlow("2026-01-01", "110")
            )
        )

        assertNotNull(result)
        assertEquals(0.1, result ?: Double.NaN, 1e-10)
    }

    @Test
    fun `breakdown separates flows income costs and market result`() {
        val breakdown = PortfolioReturnBreakdownCalculator.calculate(
            start = date("2025-01-01"),
            end = date("2026-01-01"),
            values = listOf(
                valuation("2024-12-31", "100"),
                valuation("2026-01-01", "180")
            ),
            transactions = listOf(
                transaction(TransactionType.DEPOSIT, "2025-01-01", gross = "999"),
                transaction(TransactionType.DEPOSIT, "2025-02-01", gross = "50"),
                transaction(TransactionType.INTEREST, "2025-03-01", gross = "10", fee = "1", tax = "2")
            ),
            fxLookups = TransactionFxLookups(emptyMap())
        )

        assertNotNull(breakdown)
        assertAmount("100", breakdown?.openingValuePln)
        assertAmount("180", breakdown?.closingValuePln)
        assertAmount("50", breakdown?.netExternalFlowsPln)
        assertAmount("10", breakdown?.interestAndCouponsPln)
        assertAmount("-1", breakdown?.feesPln)
        assertAmount("-2", breakdown?.taxesPln)
        assertAmount("23", breakdown?.marketAndFxPln)
        assertAmount("30", breakdown?.netInvestmentResultPln)
    }

    @Test
    fun `inflation adjustment keeps nominal metric components aligned`() {
        val adjusted = PortfolioReturnCalculator.adjustForInflation(
            metric = ReturnMetric(
                moneyWeightedReturn = BigDecimal("0.21"),
                annualizedMoneyWeightedReturn = BigDecimal("0.21"),
                timeWeightedReturn = BigDecimal("0.21"),
                annualizedTimeWeightedReturn = BigDecimal("0.21")
            ),
            inflation = InflationWindow(
                from = YearMonth.of(2025, 1),
                until = YearMonth.of(2026, 1),
                multiplier = BigDecimal("1.1")
            ),
            periodDayCount = 365
        )

        assertNotNull(adjusted)
        assertAmount("0.1", adjusted?.moneyWeightedReturn)
        assertAmount("0.1", adjusted?.annualizedMoneyWeightedReturn)
        assertAmount("0.1", adjusted?.timeWeightedReturn)
        assertAmount("0.1", adjusted?.annualizedTimeWeightedReturn)
    }

    private fun transaction(
        type: TransactionType,
        tradeDate: String,
        gross: String,
        fee: String = "0",
        tax: String = "0"
    ): Transaction = Transaction(
        id = UUID.randomUUID(),
        accountId = ACCOUNT_ID,
        instrumentId = null,
        type = type,
        tradeDate = date(tradeDate),
        settlementDate = null,
        quantity = null,
        unitPrice = null,
        grossAmount = BigDecimal(gross),
        feeAmount = BigDecimal(fee),
        taxAmount = BigDecimal(tax),
        currency = "PLN",
        fxRateToPln = null,
        notes = "",
        createdAt = CREATED_AT,
        updatedAt = CREATED_AT
    )

    private fun valuation(date: String, value: String): ValuationPoint =
        ValuationPoint(date = date(date), value = BigDecimal(value))

    private fun cashFlow(date: String, amount: String): MoneyWeightedCashFlow =
        MoneyWeightedCashFlow(date = date(date), amount = BigDecimal(amount))

    private fun date(value: String): LocalDate = LocalDate.parse(value)

    private fun assertAmount(expected: String, actual: BigDecimal?) {
        assertEquals(0, actual?.compareTo(BigDecimal(expected)))
    }

    private companion object {
        val ACCOUNT_ID: UUID = UUID.fromString("11111111-1111-1111-1111-111111111111")
        val CREATED_AT: Instant = Instant.parse("2025-01-01T00:00:00Z")
    }
}
