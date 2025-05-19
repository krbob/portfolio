package net.bobinski.logic

import net.bobinski.data.HistoricalPrice
import net.bobinski.data.monthly
import net.bobinski.data.toBarSeries
import net.bobinski.data.weekly
import org.ta4j.core.BarSeries
import org.ta4j.core.indicators.RSIIndicator
import org.ta4j.core.indicators.helpers.ClosePriceIndicator

object CalculateRsi {

    fun daily(
        data: Collection<HistoricalPrice>,
        conversion: Collection<HistoricalPrice>?,
        period: Int = 14
    ): Double {
        return forBars(data.toBarSeries(conversion), period)
    }

    fun weekly(
        data: Collection<HistoricalPrice>,
        conversion: Collection<HistoricalPrice>?,
        period: Int = 14
    ): Double {
        return data.weekly().toBarSeries(conversion).let { forBars(it, period) }
    }

    fun monthly(
        data: Collection<HistoricalPrice>,
        conversion: Collection<HistoricalPrice>?,
        period: Int = 14
    ): Double {
        return data.monthly().toBarSeries(conversion).let { forBars(it, period) }
    }

    private fun forBars(data: BarSeries, period: Int = 14): Double {
        return RSIIndicator(ClosePriceIndicator(data), period).getValue(data.endIndex)
            .doubleValue()
    }
}