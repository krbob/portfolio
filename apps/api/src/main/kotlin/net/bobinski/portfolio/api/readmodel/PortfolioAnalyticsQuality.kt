package net.bobinski.portfolio.api.readmodel

import net.bobinski.portfolio.api.domain.service.PortfolioDailyHistory
import net.bobinski.portfolio.api.domain.service.ValuationState

internal fun PortfolioDailyHistory.requireSafeToPublish() {
    check(isPreferredForCache()) {
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
        referenceViewsAvailable = hasCompleteReferenceViews()
    )

private fun PortfolioDailyHistory.hasCompleteReferenceViews(): Boolean =
    points.all { point ->
        point.totalCurrentValueUsd != null && point.totalCurrentValueAu != null
    }

internal fun isPortfolioAnalyticsHistoryPreferredForCache(
    valuationState: ValuationState?,
    missingFxTransactions: Int,
    referenceViewsAvailable: Boolean
): Boolean =
    isPortfolioAnalyticsHistoryCorePublishable(valuationState, missingFxTransactions) &&
        referenceViewsAvailable

private fun isPortfolioAnalyticsHistoryCorePublishable(
    valuationState: ValuationState?,
    missingFxTransactions: Int
): Boolean =
    (valuationState == ValuationState.MARK_TO_MARKET || valuationState == ValuationState.STALE) &&
        missingFxTransactions == 0
