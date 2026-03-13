package net.bobinski.portfolio.api.marketdata.service

import java.math.BigDecimal
import java.time.YearMonth

interface InflationAdjustmentProvider {
    suspend fun cumulativeSince(from: YearMonth): InflationAdjustmentResult
}

sealed interface InflationAdjustmentResult {
    data class Success(
        val from: YearMonth,
        val until: YearMonth,
        val multiplier: BigDecimal
    ) : InflationAdjustmentResult

    data class Failure(
        val reason: String
    ) : InflationAdjustmentResult
}
