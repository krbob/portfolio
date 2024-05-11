package net.bobinski.logic

import kotlinx.datetime.toJavaLocalDate
import net.bobinski.data.HistoricalPrice
import java.time.Clock
import java.time.LocalDate

object CalculateYield {

    fun yearly(data: Collection<HistoricalPrice>): Double {
        return data
            .filter { it.date.toJavaLocalDate() >= LocalDate.now(Clock.systemUTC()).minusYears(1) }
            .sumOf { it.dividend } / data.maxBy { it.date }.close
    }
}