package net.bobinski.portfolio.api.marketdata.client

import java.math.BigDecimal
import java.math.RoundingMode
import java.time.LocalDate
import java.time.temporal.ChronoUnit
import net.bobinski.portfolio.api.marketdata.model.HistoricalPricePoint

internal fun StockAnalystHistory.requirePlausibleSplitAdjustedSeries(symbol: String): StockAnalystHistory {
    splitAdjustedSeriesQualityIssue()?.let { issue ->
        throw implausibleSeriesException(symbol = symbol, reason = issue.description)
    }
    return this
}

internal fun StockAnalystHistory.splitAdjustedSeriesQualityIssue(): StockAnalystSeriesQualityIssue? {
    if (!provenance.adjustment.equals(SPLIT_ADJUSTED, ignoreCase = true)) {
        return null
    }

    return prices.seriesQualityIssue()
}

internal fun List<HistoricalPricePoint>.seriesQualityIssue(): StockAnalystSeriesQualityIssue? {
    firstOrNull { point -> point.closePricePln.signum() <= 0 }?.let { point ->
        return StockAnalystSeriesQualityIssue(
            firstDate = point.date,
            secondDate = point.date,
            description = "non-positive close on ${point.date}"
        )
    }

    return sortedBy { point -> point.date }
        .zipWithNext()
        .firstOrNull { (previous, current) ->
            val gapDays = ChronoUnit.DAYS.between(previous.date, current.date)
            gapDays in 1..MAX_COMPARISON_GAP_DAYS && hasOrderOfMagnitudeJump(
                previous = previous.closePricePln,
                current = current.closePricePln
            )
        }
        ?.let { (previous, current) ->
            val smaller = minOf(previous.closePricePln, current.closePricePln)
            val larger = maxOf(previous.closePricePln, current.closePricePln)
            val factor = larger.divide(smaller, 1, RoundingMode.HALF_UP).stripTrailingZeros()
            StockAnalystSeriesQualityIssue(
                firstDate = previous.date,
                secondDate = current.date,
                description = "${factor.toPlainString()}x close-price jump between ${previous.date} and ${current.date}"
            )
        }
}

internal data class StockAnalystSeriesQualityIssue(
    val firstDate: LocalDate,
    val secondDate: LocalDate,
    val description: String
)

private fun hasOrderOfMagnitudeJump(previous: BigDecimal, current: BigDecimal): Boolean {
    val smaller = minOf(previous, current)
    val larger = maxOf(previous, current)
    return smaller.signum() > 0 && larger >= smaller.multiply(MAX_PLAUSIBLE_ADJACENT_FACTOR)
}

internal fun implausibleSeriesException(symbol: String, reason: String) = MarketDataClientException(
    message = "stock-analyst returned an implausible split-adjusted history for $symbol: $reason.",
    upstream = STOCK_ANALYST,
    operation = HISTORY_OPERATION,
    symbol = symbol,
    errorCode = IMPLAUSIBLE_SERIES_ERROR_CODE,
    retryable = true
)

private const val SPLIT_ADJUSTED = "SPLIT_ADJUSTED"
private const val STOCK_ANALYST = "stock-analyst"
private const val HISTORY_OPERATION = "history"
private const val IMPLAUSIBLE_SERIES_ERROR_CODE = "IMPLAUSIBLE_SPLIT_ADJUSTED_SERIES"
private const val MAX_COMPARISON_GAP_DAYS = 14L
private val MAX_PLAUSIBLE_ADJACENT_FACTOR = BigDecimal("50")
