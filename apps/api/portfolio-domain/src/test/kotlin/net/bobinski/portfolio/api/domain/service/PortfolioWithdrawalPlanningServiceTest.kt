package net.bobinski.portfolio.api.domain.service

import java.math.BigDecimal
import java.time.Instant
import java.time.LocalDate
import java.util.UUID
import net.bobinski.portfolio.api.domain.model.AssetClass
import net.bobinski.portfolio.api.domain.model.PortfolioTarget
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class PortfolioWithdrawalPlanningServiceTest {
    private val service = PortfolioWithdrawalPlanningService()

    @Test
    fun `percentage withdrawal uses prioritized cash then sells the overweight class with a manual tax buffer`() {
        val plan = service.plan(
            command = PortfolioWithdrawalPlanCommand(portfolioPercentagePct = BigDecimal("10.00")),
            overview = overview(),
            accounts = accounts(),
            holdings = holdings(),
            targets = targets(),
            settings = settings()
        )

        assertTrue(plan.feasible)
        assertEquals(BigDecimal("10000.00"), plan.requestedWithdrawalPln)
        assertEquals(BigDecimal("5000.00"), plan.cashUsedPln)
        assertEquals(BigDecimal("6250.00"), plan.grossSalesPln)
        assertEquals(BigDecimal("1250.00"), plan.estimatedTaxBufferPln)
        assertEquals(BigDecimal("88750.00"), plan.projectedTotalValuePln)
        assertEquals(1, plan.accountPlans.size)
        assertEquals(BigDecimal("6250.00"), plan.accountPlans.first().sales.single {
            it.assetClass == AssetClass.EQUITIES
        }.amountPln)
        assertEquals(BigDecimal("0.00"), plan.accountPlans.first().sales.single {
            it.assetClass == AssetClass.BONDS
        }.amountPln)
        assertEquals(BigDecimal("53750.00"), plan.buckets.single {
            it.assetClass == AssetClass.EQUITIES
        }.projectedValuePln)
        assertEquals(BigDecimal("0.00"), plan.buckets.single {
            it.assetClass == AssetClass.CASH
        }.projectedValuePln)
        assertTrue(plan.warnings.isEmpty())
    }

    @Test
    fun `plan reports a shortfall instead of creating negative holdings`() {
        val plan = service.plan(
            command = PortfolioWithdrawalPlanCommand(amountPln = BigDecimal("120000.00")),
            overview = overview(),
            accounts = accounts(),
            holdings = holdings(),
            targets = targets(),
            settings = settings()
        )

        assertFalse(plan.feasible)
        assertEquals(BigDecimal("32000.00"), plan.shortfallPln)
        assertEquals(BigDecimal("88000.00"), plan.plannedWithdrawalPln)
        assertEquals(BigDecimal("95000.00"), plan.grossSalesPln)
        assertEquals(BigDecimal("12000.00"), plan.estimatedTaxBufferPln)
        assertEquals(BigDecimal("0.00"), plan.projectedTotalValuePln)
        assertTrue(WithdrawalPlanWarning.INSUFFICIENT_LIQUIDITY in plan.warnings)
        assertTrue(plan.buckets.all { it.projectedValuePln >= BigDecimal.ZERO })
    }

    @Test
    fun `negative cash is covered before withdrawal and bucket sum remains invariant`() {
        val plan = service.plan(
            command = PortfolioWithdrawalPlanCommand(amountPln = BigDecimal("50.00")),
            overview = negativeCashOverview(),
            accounts = listOf(negativeCashAccount()),
            holdings = listOf(negativeCashHolding()),
            targets = equityOnlyTargets(),
            settings = negativeCashSettings(taxBufferRatePct = "0.00")
        )

        assertFalse(plan.feasible)
        assertEquals(BigDecimal("10.00"), plan.plannedWithdrawalPln)
        assertEquals(BigDecimal("40.00"), plan.shortfallPln)
        assertEquals(BigDecimal("100.00"), plan.grossSalesPln)
        assertEquals(BigDecimal("0.00"), plan.projectedTotalValuePln)
        assertEquals(BigDecimal("0.00"), plan.accountPlans.single().projectedValuePln)
        assertEquals(
            plan.projectedTotalValuePln,
            plan.buckets.sumOf(PortfolioWithdrawalPlanBucket::projectedValuePln)
        )
        assertTrue(plan.buckets.all { it.projectedWeightPct == null && it.projectedDriftPctPoints == null })
        assertTrue(WithdrawalPlanWarning.NEGATIVE_CASH_BALANCE in plan.warnings)
        assertTrue(WithdrawalPlanWarning.INSUFFICIENT_LIQUIDITY in plan.warnings)
    }

    @Test
    fun `negative projected values are not clamped to zero`() {
        val plan = service.plan(
            command = PortfolioWithdrawalPlanCommand(amountPln = BigDecimal("50.00")),
            overview = negativeCashOverview(),
            accounts = listOf(negativeCashAccount()),
            holdings = listOf(negativeCashHolding()),
            targets = equityOnlyTargets(),
            settings = negativeCashSettings(taxBufferRatePct = "20.00")
        )

        assertEquals(BigDecimal("0.00"), plan.plannedWithdrawalPln)
        assertEquals(BigDecimal("20.00"), plan.estimatedTaxBufferPln)
        assertEquals(BigDecimal("-10.00"), plan.projectedTotalValuePln)
        assertEquals(BigDecimal("-10.00"), plan.accountPlans.single().projectedValuePln)
        assertEquals(
            plan.projectedTotalValuePln,
            plan.buckets.sumOf(PortfolioWithdrawalPlanBucket::projectedValuePln)
        )
        assertTrue(plan.buckets.all { it.projectedWeightPct == null && it.projectedDriftPctPoints == null })
    }

    @Test
    fun `weights are unavailable when a projected bucket is negative despite a positive total`() {
        val settings = negativeCashSettings(taxBufferRatePct = "0.00", enabled = false)

        val plan = service.plan(
            command = PortfolioWithdrawalPlanCommand(amountPln = BigDecimal("1.00")),
            overview = negativeCashOverview(),
            accounts = listOf(negativeCashAccount()),
            holdings = listOf(negativeCashHolding()),
            targets = equityOnlyTargets(),
            settings = settings
        )

        assertEquals(BigDecimal("10.00"), plan.projectedTotalValuePln)
        assertEquals(BigDecimal("-90.00"), plan.buckets.single {
            it.assetClass == AssetClass.CASH
        }.projectedValuePln)
        assertTrue(plan.buckets.all { it.projectedWeightPct == null && it.projectedDriftPctPoints == null })
    }

    @Test
    fun `request must contain exactly one withdrawal input`() {
        assertThrows(IllegalArgumentException::class.java) {
            service.plan(
                command = PortfolioWithdrawalPlanCommand(),
                overview = overview(),
                accounts = accounts(),
                holdings = holdings(),
                targets = targets(),
                settings = settings()
            )
        }
        assertThrows(IllegalArgumentException::class.java) {
            service.plan(
                command = PortfolioWithdrawalPlanCommand(
                    amountPln = BigDecimal("1000.00"),
                    portfolioPercentagePct = BigDecimal("4.00")
                ),
                overview = overview(),
                accounts = accounts(),
                holdings = holdings(),
                targets = targets(),
                settings = settings()
            )
        }
    }

    private fun settings() = WithdrawalPlanningSettings(
        accountRules = listOf(
            WithdrawalPlanningAccountRule(
                accountId = BROKERAGE_ACCOUNT_ID,
                enabled = true,
                taxWrapper = WithdrawalTaxWrapper.STANDARD,
                taxBufferRatePct = BigDecimal("20.00")
            ),
            WithdrawalPlanningAccountRule(
                accountId = BOND_ACCOUNT_ID,
                enabled = true,
                taxWrapper = WithdrawalTaxWrapper.NONE,
                taxBufferRatePct = BigDecimal.ZERO
            )
        )
    )

    private fun targets() = listOf(
        target(AssetClass.EQUITIES, "0.60"),
        target(AssetClass.BONDS, "0.35"),
        target(AssetClass.CASH, "0.05")
    )

    private fun equityOnlyTargets() = listOf(
        target(AssetClass.EQUITIES, "1.00"),
        target(AssetClass.BONDS, "0.00"),
        target(AssetClass.CASH, "0.00")
    )

    private fun negativeCashSettings(
        taxBufferRatePct: String,
        enabled: Boolean = true
    ) = WithdrawalPlanningSettings(
        accountRules = listOf(
            WithdrawalPlanningAccountRule(
                accountId = BROKERAGE_ACCOUNT_ID,
                enabled = enabled,
                taxWrapper = WithdrawalTaxWrapper.STANDARD,
                taxBufferRatePct = BigDecimal(taxBufferRatePct)
            )
        )
    )

    private fun target(assetClass: AssetClass, weight: String) = PortfolioTarget(
        id = UUID.randomUUID(),
        assetClass = assetClass,
        targetWeight = BigDecimal(weight),
        createdAt = NOW,
        updatedAt = NOW
    )

    private fun accounts() = listOf(
        account(
            id = BROKERAGE_ACCOUNT_ID,
            name = "Brokerage",
            totalValue = "65000.00",
            investedValue = "60000.00",
            cash = "5000.00"
        ),
        account(
            id = BOND_ACCOUNT_ID,
            name = "Bonds",
            totalValue = "35000.00",
            investedValue = "35000.00",
            cash = "0.00"
        )
    )

    private fun account(
        id: UUID,
        name: String,
        totalValue: String,
        investedValue: String,
        cash: String
    ) = PortfolioAccountSummary(
        accountId = id,
        accountName = name,
        institution = "Institution",
        type = "BROKERAGE",
        baseCurrency = "PLN",
        valuationState = ValuationState.MARK_TO_MARKET,
        totalBookValuePln = BigDecimal(totalValue),
        totalCurrentValuePln = BigDecimal(totalValue),
        investedBookValuePln = BigDecimal(investedValue),
        investedCurrentValuePln = BigDecimal(investedValue),
        cashBalancePln = BigDecimal(cash),
        netContributionsPln = BigDecimal(totalValue),
        totalUnrealizedGainPln = BigDecimal.ZERO,
        portfolioWeightPct = BigDecimal.ZERO,
        activeHoldingCount = 1,
        valuedHoldingCount = 1,
        valuationIssueCount = 0
    )

    private fun holdings() = listOf(
        holding(BROKERAGE_ACCOUNT_ID, "Brokerage", EQUITY_ID, "EQUITIES", "60000.00"),
        holding(BOND_ACCOUNT_ID, "Bonds", BOND_ID, "BONDS", "35000.00")
    )

    private fun negativeCashAccount() = account(
        id = BROKERAGE_ACCOUNT_ID,
        name = "Brokerage",
        totalValue = "10.00",
        investedValue = "100.00",
        cash = "-90.00"
    )

    private fun negativeCashHolding() = holding(
        accountId = BROKERAGE_ACCOUNT_ID,
        accountName = "Brokerage",
        instrumentId = EQUITY_ID,
        assetClass = "EQUITIES",
        value = "100.00"
    )

    private fun holding(
        accountId: UUID,
        accountName: String,
        instrumentId: UUID,
        assetClass: String,
        value: String
    ) = HoldingSnapshot(
        accountId = accountId,
        accountName = accountName,
        instrumentId = instrumentId,
        instrumentName = instrumentId.toString(),
        kind = "ETF",
        assetClass = assetClass,
        currency = "PLN",
        quantity = BigDecimal.ONE,
        averageCostPerUnitPln = BigDecimal(value),
        costBasisPln = BigDecimal(value),
        bookValuePln = BigDecimal(value),
        currentPriceNative = BigDecimal(value),
        currentPricePln = BigDecimal(value),
        currentValuePln = BigDecimal(value),
        unrealizedGainPln = BigDecimal.ZERO,
        valuedAt = AS_OF,
        valuationStatus = HoldingValuationStatus.VALUED,
        valuationIssue = null,
        transactionCount = 1
    )

    private fun overview() = PortfolioOverview(
        asOf = AS_OF,
        valuationState = ValuationState.MARK_TO_MARKET,
        totalBookValuePln = BigDecimal("100000.00"),
        totalCurrentValuePln = BigDecimal("100000.00"),
        investedBookValuePln = BigDecimal("95000.00"),
        investedCurrentValuePln = BigDecimal("95000.00"),
        cashBalancePln = BigDecimal("5000.00"),
        netContributionsPln = BigDecimal("100000.00"),
        equityBookValuePln = BigDecimal("60000.00"),
        equityCurrentValuePln = BigDecimal("60000.00"),
        bondBookValuePln = BigDecimal("35000.00"),
        bondCurrentValuePln = BigDecimal("35000.00"),
        cashBookValuePln = BigDecimal("5000.00"),
        cashCurrentValuePln = BigDecimal("5000.00"),
        totalUnrealizedGainPln = BigDecimal.ZERO,
        accountCount = 2,
        instrumentCount = 2,
        activeHoldingCount = 2,
        valuedHoldingCount = 2,
        unvaluedHoldingCount = 0,
        valuationIssueCount = 0,
        missingFxTransactions = 0,
        unsupportedCorrectionTransactions = 0
    )

    private fun negativeCashOverview() = overview().copy(
        totalBookValuePln = BigDecimal("10.00"),
        totalCurrentValuePln = BigDecimal("10.00"),
        investedBookValuePln = BigDecimal("100.00"),
        investedCurrentValuePln = BigDecimal("100.00"),
        cashBalancePln = BigDecimal("-90.00"),
        netContributionsPln = BigDecimal("10.00"),
        equityBookValuePln = BigDecimal("100.00"),
        equityCurrentValuePln = BigDecimal("100.00"),
        bondBookValuePln = BigDecimal("0.00"),
        bondCurrentValuePln = BigDecimal("0.00"),
        cashBookValuePln = BigDecimal("-90.00"),
        cashCurrentValuePln = BigDecimal("-90.00"),
        accountCount = 1,
        instrumentCount = 1,
        activeHoldingCount = 1,
        valuedHoldingCount = 1
    )

    private companion object {
        val AS_OF: LocalDate = LocalDate.parse("2026-07-18")
        val NOW: Instant = Instant.parse("2026-07-18T10:00:00Z")
        val BROKERAGE_ACCOUNT_ID: UUID = UUID.fromString("10000000-0000-0000-0000-000000000001")
        val BOND_ACCOUNT_ID: UUID = UUID.fromString("10000000-0000-0000-0000-000000000002")
        val EQUITY_ID: UUID = UUID.fromString("20000000-0000-0000-0000-000000000001")
        val BOND_ID: UUID = UUID.fromString("20000000-0000-0000-0000-000000000002")
    }
}
