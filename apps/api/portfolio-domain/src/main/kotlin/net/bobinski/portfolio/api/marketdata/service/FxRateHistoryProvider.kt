package net.bobinski.portfolio.api.marketdata.service

import net.bobinski.portfolio.api.marketdata.model.HistoricalPricePoint
import java.time.LocalDate

interface FxRateHistoryProvider {
    suspend fun dailyRateToPln(currency: String, from: LocalDate, to: LocalDate): FxRateHistoryResult
}

sealed interface FxRateHistoryResult {
    data class Success(
        val prices: List<HistoricalPricePoint>,
        val fromCache: Boolean = false
    ) : FxRateHistoryResult

    data class Failure(
        val reason: String
    ) : FxRateHistoryResult
}
