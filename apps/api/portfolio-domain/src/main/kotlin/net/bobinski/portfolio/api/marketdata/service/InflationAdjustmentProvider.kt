package net.bobinski.portfolio.api.marketdata.service

import java.math.BigDecimal
import java.time.YearMonth

interface InflationAdjustmentProvider {
    suspend fun cumulativeSince(from: YearMonth): InflationAdjustmentResult
    suspend fun monthlySeries(from: YearMonth, untilExclusive: YearMonth): InflationSeriesResult
}

sealed interface InflationAdjustmentResult {
    data class Success(
        val from: YearMonth,
        val until: YearMonth,
        val multiplier: BigDecimal,
        val fromCache: Boolean = false
    ) : InflationAdjustmentResult

    data class Failure(
        val reason: String
    ) : InflationAdjustmentResult
}

sealed interface InflationSeriesResult {
    data class Success(
        val from: YearMonth,
        val until: YearMonth,
        val points: List<MonthlyInflationPoint>,
        val fromCache: Boolean = false
    ) : InflationSeriesResult

    data class Failure(
        val reason: String
    ) : InflationSeriesResult
}

data class MonthlyInflationPoint(
    val month: YearMonth,
    val multiplier: BigDecimal
)
