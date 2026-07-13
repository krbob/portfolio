package net.bobinski.portfolio.api.readmodel

import java.math.BigDecimal
import java.time.LocalDate
import net.bobinski.portfolio.api.domain.service.PortfolioDailyHistory
import net.bobinski.portfolio.api.domain.service.PortfolioDailyHistoryPoint
import net.bobinski.portfolio.api.domain.service.ValuationState
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows

class PortfolioAnalyticsQualityTest {

    @Test
    fun `cached reference series remain publishable when USD and gold views are complete`() {
        val history = history(usd = BigDecimal("25.00"), gold = BigDecimal("0.01"))

        history.requireSafeToPublish()

        assertTrue(history.isPreferredForCache())
    }

    @Test
    fun `missing reference view cannot replace a complete analytics snapshot`() {
        val history = history(usd = null, gold = BigDecimal("0.01"))

        assertThrows<IllegalStateException> { history.requireSafeToPublish() }
        assertFalse(history.isPreferredForCache())
    }

    private fun history(usd: BigDecimal?, gold: BigDecimal?) = PortfolioDailyHistory(
        from = DATE,
        until = DATE,
        valuationState = ValuationState.MARK_TO_MARKET,
        instrumentHistoryIssueCount = 0,
        referenceSeriesIssueCount = 1,
        benchmarkSeriesIssueCount = 0,
        missingFxTransactions = 0,
        unsupportedCorrectionTransactions = 0,
        points = listOf(
            PortfolioDailyHistoryPoint(
                date = DATE,
                totalBookValuePln = BigDecimal("100.00"),
                totalCurrentValuePln = BigDecimal("100.00"),
                netContributionsPln = BigDecimal("100.00"),
                cashBalancePln = BigDecimal.ZERO,
                totalCurrentValueUsd = usd,
                netContributionsUsd = usd,
                cashBalanceUsd = usd?.let { BigDecimal.ZERO },
                totalCurrentValueAu = gold,
                netContributionsAu = gold,
                cashBalanceAu = gold?.let { BigDecimal.ZERO },
                equityCurrentValuePln = BigDecimal("100.00"),
                bondCurrentValuePln = BigDecimal.ZERO,
                cashCurrentValuePln = BigDecimal.ZERO,
                equityAllocationPct = BigDecimal("100.00"),
                bondAllocationPct = BigDecimal.ZERO,
                cashAllocationPct = BigDecimal.ZERO,
                portfolioPerformanceIndex = BigDecimal("100.00"),
                activeHoldingCount = 1,
                valuedHoldingCount = 1
            )
        )
    )

    private companion object {
        val DATE: LocalDate = LocalDate.parse("2026-07-13")
    }
}
