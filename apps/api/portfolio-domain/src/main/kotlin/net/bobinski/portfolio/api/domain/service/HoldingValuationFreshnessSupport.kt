package net.bobinski.portfolio.api.domain.service

import net.bobinski.portfolio.api.marketdata.service.InstrumentValuationResult

internal class HoldingValuationFreshnessSupport(
    private val freshnessPolicy: MarketDataFreshnessPolicy
) {
    fun statusFor(
        valuation: InstrumentValuationResult.Success,
        symbolHint: String?
    ): HoldingValuationStatus =
        if (isStale(valuation, symbolHint)) HoldingValuationStatus.STALE else HoldingValuationStatus.VALUED

    fun issueFor(
        valuation: InstrumentValuationResult.Success,
        symbolHint: String?
    ): String? = when {
        valuation.fromCache -> "Using cached market valuation from ${valuation.valuation.valuedAt}."
        freshnessPolicy.isQuoteStale(
            valuedAt = valuation.valuation.valuedAt,
            symbolHint = symbolHint
        ) -> "Last market valuation is from ${valuation.valuation.valuedAt}."
        else -> null
    }

    fun isStale(
        valuation: InstrumentValuationResult.Success,
        symbolHint: String?
    ): Boolean = valuation.fromCache || freshnessPolicy.isQuoteStale(
        valuedAt = valuation.valuation.valuedAt,
        symbolHint = symbolHint
    )
}
