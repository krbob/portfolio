package net.bobinski.data

import kotlinx.datetime.LocalDate
import kotlinx.datetime.toJavaLocalDate
import kotlinx.serialization.Serializable
import org.ta4j.core.Bar
import org.ta4j.core.BarSeries
import org.ta4j.core.BaseBar
import org.ta4j.core.BaseBarSeriesBuilder
import java.math.BigDecimal
import java.time.DayOfWeek
import java.time.Duration
import java.time.ZoneId
import java.time.temporal.WeekFields

@Serializable
data class HistoricalPrice(
    val date: LocalDate,
    val open: Double,
    val close: Double,
    val low: Double,
    val high: Double,
    val volume: Long,
    val dividend: Double
)

fun Collection<HistoricalPrice>.toBarSeries(): BarSeries =
    BaseBarSeriesBuilder().withBars(sortedBy { it.date }.mapNotNull { it.toBar() }).build()

private fun HistoricalPrice.toBar(): Bar? {
    if (setOf(open, close, low, high).any { it.isNaN() }) {
        return null
    }
    return BaseBar(
        /* timePeriod = */ Duration.ofDays(1),
        /* endTime = */ date.toJavaLocalDate().atStartOfDay(ZoneId.systemDefault()),
        /* openPrice = */ BigDecimal(open),
        /* highPrice = */ BigDecimal(high),
        /* lowPrice = */ BigDecimal(low),
        /* closePrice = */ BigDecimal(close),
        /* volume = */ BigDecimal(volume)
    )
}

fun Collection<HistoricalPrice>.daily() = sortedByDescending { it.date }

fun Collection<HistoricalPrice>.weekly(): List<HistoricalPrice> =
    daily().intervalBy { it.date.weekNumber }

fun Collection<HistoricalPrice>.monthly(): List<HistoricalPrice> =
    daily().intervalBy { it.date.monthNumber }

private fun List<HistoricalPrice>.intervalBy(comparator: (HistoricalPrice) -> Int): List<HistoricalPrice> {
    val ret = mutableListOf(first())
    while (true) {
        subList(indexOf(ret.last()), size).find { comparator(it) != comparator(ret.last()) }
            ?.let { ret.add(it) }
            ?: break
    }
    return ret
}

fun Collection<HistoricalPrice>.weeklyBars(): BarSeries =
    groupBy {
        "${it.date.year}${String.format("%02d", it.date.monthNumber)}${
            String.format("%02d", it.date.weekNumber)
        }".toInt()
    }
        .run { keys.sorted().map { get(it).orEmpty() } }
        .map { prices ->
            BaseBar(
                /* timePeriod = */ Duration.ofDays(7),
                /* endTime = */
                prices.maxOf { it.date.toJavaLocalDate().atStartOfDay(ZoneId.systemDefault()) },
                /* openPrice = */
                BigDecimal(prices.minByOrNull { it.date }!!.open),
                /* highPrice = */
                BigDecimal(prices.maxOf { it.close }),
                /* lowPrice = */
                BigDecimal(prices.minOf { it.close }),
                /* closePrice = */
                BigDecimal(prices.maxByOrNull { it.date }!!.open),
                /* volume = */
                BigDecimal(prices.sumOf { it.volume })
            )
        }.run { BaseBarSeriesBuilder().withBars(this).build() }

fun Collection<HistoricalPrice>.monthlyBars(): BarSeries =
    groupBy { "${it.date.year}${String.format("%02d", it.date.monthNumber)}".toInt() }
        .run { keys.sorted().map { get(it).orEmpty() } }
        .map { prices ->
            BaseBar(
                /* timePeriod = */ Duration.ofDays(7),
                /* endTime = */
                prices.maxOf { it.date.toJavaLocalDate().atStartOfDay(ZoneId.systemDefault()) },
                /* openPrice = */
                BigDecimal(prices.minByOrNull { it.date }!!.open),
                /* highPrice = */
                BigDecimal(prices.maxOf { it.close }),
                /* lowPrice = */
                BigDecimal(prices.minOf { it.close }),
                /* closePrice = */
                BigDecimal(prices.maxByOrNull { it.date }!!.open),
                /* volume = */
                BigDecimal(prices.sumOf { it.volume })
            )
        }.run { BaseBarSeriesBuilder().withBars(this).build() }

val LocalDate.weekNumber: Int
    get() = java.time.LocalDate.of(year, month, dayOfMonth)
        .get(WeekFields.of(DayOfWeek.MONDAY, 1).weekOfYear())