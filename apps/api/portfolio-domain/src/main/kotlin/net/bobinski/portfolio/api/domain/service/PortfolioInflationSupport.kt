package net.bobinski.portfolio.api.domain.service

import java.time.LocalDate
import java.time.YearMonth
import net.bobinski.portfolio.api.marketdata.service.InflationAdjustmentProvider
import net.bobinski.portfolio.api.marketdata.service.InflationSeriesResult

internal class PortfolioInflationSupport(
    private val inflationAdjustmentProvider: InflationAdjustmentProvider
) {
    fun alignedRealStartMonth(date: LocalDate): YearMonth = YearMonth.from(date)

    fun latestCompletePortfolioMonthExclusive(date: LocalDate): YearMonth =
        if (date.dayOfMonth == date.lengthOfMonth()) {
            YearMonth.from(date).plusMonths(1)
        } else {
            YearMonth.from(date)
        }

    suspend fun loadMonthlySeriesWithFallback(
        from: YearMonth,
        requestedUntil: YearMonth
    ): InflationSeriesResult.Success? {
        var candidateUntil = requestedUntil
        while (candidateUntil > from) {
            when (val result = inflationAdjustmentProvider.monthlySeries(from, candidateUntil)) {
                is InflationSeriesResult.Success -> return result
                is InflationSeriesResult.Failure -> candidateUntil = candidateUntil.minusMonths(1)
            }
        }
        return null
    }
}
