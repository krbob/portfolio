package net.bobinski.logic

import kotlinx.datetime.toJavaLocalDate
import net.bobinski.data.HistoricalPrice
import java.time.Clock
import java.time.LocalDate

object CalculateGain {

    fun monthly(data: Collection<HistoricalPrice>) =
        calculateFor(data, LocalDate.now(Clock.systemUTC()).minusMonths(1))

    fun quarterly(data: Collection<HistoricalPrice>) =
        calculateFor(data, LocalDate.now(Clock.systemUTC()).minusMonths(3))

    fun yearly(data: Collection<HistoricalPrice>) =
        calculateFor(data, LocalDate.now(Clock.systemUTC()).minusYears(1))
}

private fun calculateFor(data: Collection<HistoricalPrice>, targetDate: LocalDate): Double {
    val currentPrice = data.maxBy { it.date }.close
    val oldPrice = data.filter { it.date.toJavaLocalDate() <= targetDate }
        .run {
            takeIf { it.isNotEmpty() }?.maxBy { it.date }
                ?: data.minBy { it.date }
        }.close

    return (currentPrice - oldPrice) / oldPrice
}