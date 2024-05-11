package net.bobinski.logic

import net.bobinski.data.HistoricalPrice
import net.bobinski.data.monthly
import net.bobinski.data.toBarSeries
import net.bobinski.data.weekly
import org.ta4j.core.BarSeries
import org.ta4j.core.indicators.RSIIndicator
import org.ta4j.core.indicators.helpers.ClosePriceIndicator
import org.ta4j.core.utils.BarSeriesUtils
import java.time.Duration

object CalculateRsi {

    fun daily(data: Collection<HistoricalPrice>, period: Int = 14): Double {
        return forBars(data.toBarSeries(), period)
    }

    fun weekly(data: Collection<HistoricalPrice>, period: Int = 14): Double {
        return BarSeriesUtils.aggregateBars(
            data.toBarSeries(),
            Duration.ofDays(7),
            "weekly"
        ).let { forBars(it, period) }
    }

    fun weeklyWithManualSplit(data: Collection<HistoricalPrice>, period: Int = 14): Double {
        return data.weekly().toBarSeries().let { forBars(it, period) }
    }

    fun monthly(data: Collection<HistoricalPrice>, period: Int = 14): Double {
        return BarSeriesUtils.aggregateBars(
            data.toBarSeries(),
            Duration.ofDays(30),
            "monthly"
        ).let { forBars(it, period) }
    }

    fun monthlyWithManualSplit(data: Collection<HistoricalPrice>, period: Int = 14): Double {
        return data.monthly().toBarSeries().let { forBars(it, period) }
    }

    fun forBars(data: BarSeries, period: Int = 14): Double {
        return RSIIndicator(ClosePriceIndicator(data), period).getValue(data.endIndex)
            .doubleValue()
    }
}