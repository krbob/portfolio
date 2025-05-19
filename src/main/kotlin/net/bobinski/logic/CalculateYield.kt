package net.bobinski.logic

import kotlinx.datetime.toJavaLocalDate
import net.bobinski.data.HistoricalPrice
import net.bobinski.data.applyConversion
import net.bobinski.data.latestPrice
import net.bobinski.data.priceFor
import java.time.Clock
import java.time.LocalDate

object CalculateYield {

    fun yearly(
        data: Collection<HistoricalPrice>,
        conversion: Collection<HistoricalPrice>?
    ): Double {
        return data.filter {
            it.date.toJavaLocalDate() >= LocalDate.now(Clock.systemUTC()).minusYears(1)
        }.sumOf {
            it.dividend.applyConversion(conversion?.priceFor(it.date))
        } / data.latestPrice().applyConversion(conversion?.latestPrice())
    }
}