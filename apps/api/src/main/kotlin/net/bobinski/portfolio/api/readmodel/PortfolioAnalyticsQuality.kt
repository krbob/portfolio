package net.bobinski.portfolio.api.readmodel

import net.bobinski.portfolio.api.domain.service.PortfolioDailyHistory
import net.bobinski.portfolio.api.domain.service.ValuationState

internal fun PortfolioDailyHistory.requireCoreSafeToServe() {
    check(
        isPortfolioAnalyticsHistoryCorePublishable(
            valuationState = valuationState,
            missingFxTransactions = missingFxTransactions
        )
    ) {
        "Refusing to replace cached portfolio analytics with ${valuationState.name} history " +
            "($instrumentHistoryIssueCount instrument history issue(s), " +
            "$missingFxTransactions missing FX conversion(s), " +
            "$referenceSeriesIssueCount reference series issue(s))."
    }
}

internal fun PortfolioDailyHistory.requireSafeToPublish() {
    requireCoreSafeToServe()
    check(referenceSeriesIssueCount == 0) {
        "Refusing to replace cached portfolio analytics with ${valuationState.name} history " +
            "($instrumentHistoryIssueCount instrument history issue(s), " +
            "$missingFxTransactions missing FX conversion(s), " +
            "$referenceSeriesIssueCount reference series issue(s))."
    }
}

internal fun PortfolioDailyHistory.isPreferredForCache(): Boolean =
    isPortfolioAnalyticsHistoryPreferredForCache(
        valuationState = valuationState,
        missingFxTransactions = missingFxTransactions,
        referenceSeriesIssueCount = referenceSeriesIssueCount
    )

internal fun isPortfolioAnalyticsHistoryPreferredForCache(
    valuationState: ValuationState?,
    missingFxTransactions: Int,
    referenceSeriesIssueCount: Int
): Boolean =
    isPortfolioAnalyticsHistoryCorePublishable(valuationState, missingFxTransactions) &&
        referenceSeriesIssueCount == 0

private fun isPortfolioAnalyticsHistoryCorePublishable(
    valuationState: ValuationState?,
    missingFxTransactions: Int
): Boolean =
    (valuationState == ValuationState.MARK_TO_MARKET || valuationState == ValuationState.STALE) &&
        missingFxTransactions == 0
