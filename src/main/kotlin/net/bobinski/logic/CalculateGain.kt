package net.bobinski.logic

import kotlinx.datetime.toKotlinLocalDate
import net.bobinski.data.HistoricalPrice
import net.bobinski.data.applyConversion
import net.bobinski.data.priceFor
import java.time.Clock
import java.time.LocalDate

object CalculateGain {

    fun daily(data: Collection<HistoricalPrice>, conversion: Collection<HistoricalPrice>?) =
        calculateFor(data, conversion, LocalDate.now(Clock.systemUTC()).minusDays(1))

    fun weekly(data: Collection<HistoricalPrice>, conversion: Collection<HistoricalPrice>?) =
        calculateFor(data, conversion, LocalDate.now(Clock.systemUTC()).minusWeeks(1))

    fun monthly(data: Collection<HistoricalPrice>, conversion: Collection<HistoricalPrice>?) =
        calculateFor(data, conversion, LocalDate.now(Clock.systemUTC()).minusMonths(1))

    fun quarterly(data: Collection<HistoricalPrice>, conversion: Collection<HistoricalPrice>?) =
        calculateFor(data, conversion, LocalDate.now(Clock.systemUTC()).minusMonths(3))

    fun yearly(data: Collection<HistoricalPrice>, conversion: Collection<HistoricalPrice>?) =
        calculateFor(data, conversion, LocalDate.now(Clock.systemUTC()).minusYears(1))
}

private fun calculateFor(
    data: Collection<HistoricalPrice>,
    conversion: Collection<HistoricalPrice>?,
    targetDate: LocalDate
): Double {
    val currentPrice = CalculateLastPrice(data, conversion)
    val oldPrice = data.priceFor(targetDate.toKotlinLocalDate())
        .applyConversion(conversion?.priceFor(targetDate.toKotlinLocalDate()))

    return (currentPrice - oldPrice) / oldPrice
}