package net.bobinski.portfolio.api.domain.service

import kotlin.math.pow
import java.math.BigDecimal
import java.math.RoundingMode
import java.time.LocalDate
import java.time.temporal.ChronoUnit

internal data class ValuationPoint(
    val date: LocalDate,
    val value: BigDecimal
)

internal data class MoneyWeightedCashFlow(
    val date: LocalDate,
    val amount: BigDecimal
)

internal object PortfolioReturnCalculator {
    fun calculateMetric(
        start: LocalDate,
        end: LocalDate,
        values: List<ValuationPoint>,
        cashFlows: List<MoneyWeightedCashFlow>
    ): ReturnMetric? {
        if (values.isEmpty()) {
            return null
        }

        val endValue = values.valueOnOrBefore(end) ?: return null
        val sinceInception = values.none { it.date < start }
        val periodCashFlows = buildPeriodCashFlows(
            start = start,
            end = end,
            endValue = endValue,
            values = values,
            cashFlows = cashFlows,
            sinceInception = sinceInception
        ) ?: return null
        val annualizedReturn = XirrCalculator.calculate(periodCashFlows) ?: return null
        val dayCount = ChronoUnit.DAYS.between(periodCashFlows.first().date, periodCashFlows.last().date)
        val moneyWeightedReturn = annualizedReturn.toPeriodReturn(dayCount)
        val timeWeighted = calculateTimeWeightedMetric(
            start = start,
            end = end,
            values = values,
            cashFlows = cashFlows
        )

        return ReturnMetric(
            moneyWeightedReturn = moneyWeightedReturn.toRate(),
            annualizedMoneyWeightedReturn = annualizedReturn.toRate(),
            timeWeightedReturn = timeWeighted?.totalReturn,
            annualizedTimeWeightedReturn = timeWeighted?.annualizedReturn
        )
    }

    fun calculateBenchmarkMetric(
        start: LocalDate,
        end: LocalDate,
        values: List<ValuationPoint>
    ): ReturnMetric? {
        if (values.isEmpty()) {
            return null
        }

        val startValue = values.valueOnOrBefore(start) ?: return null
        val endValue = values.valueOnOrBefore(end) ?: return null
        val benchmarkCashFlows = listOf(
            MoneyWeightedCashFlow(date = start, amount = startValue.negate()),
            MoneyWeightedCashFlow(date = end, amount = endValue)
        )
        val annualizedReturn = XirrCalculator.calculate(benchmarkCashFlows) ?: return null
        val dayCount = ChronoUnit.DAYS.between(start, end)
        val timeWeighted = calculateTimeWeightedMetric(
            start = start,
            end = end,
            values = values,
            cashFlows = emptyList()
        )

        return ReturnMetric(
            moneyWeightedReturn = annualizedReturn.toPeriodReturn(dayCount).toRate(),
            annualizedMoneyWeightedReturn = annualizedReturn.toRate(),
            timeWeightedReturn = timeWeighted?.totalReturn,
            annualizedTimeWeightedReturn = timeWeighted?.annualizedReturn
        )
    }

    fun adjustForInflation(
        metric: ReturnMetric,
        inflation: InflationWindow?,
        periodDayCount: Long
    ): ReturnMetric? {
        if (inflation == null || inflation.multiplier.signum() <= 0) {
            return null
        }

        val nominalTotal = 1.0 + metric.moneyWeightedReturn.toDouble()
        val realTotal = nominalTotal / inflation.multiplier.toDouble() - 1.0
        val realAnnualized = metric.annualizedMoneyWeightedReturn?.let {
            annualize(realTotal, periodDayCount)
        }
        val realTimeWeighted = metric.timeWeightedReturn?.let { value ->
            (1.0 + value.toDouble()) / inflation.multiplier.toDouble() - 1.0
        }
        val realAnnualizedTimeWeighted = metric.annualizedTimeWeightedReturn?.let {
            realTimeWeighted?.let { value -> annualize(value, periodDayCount) }
        }

        return ReturnMetric(
            moneyWeightedReturn = realTotal.toRate(),
            annualizedMoneyWeightedReturn = realAnnualized?.toRate(),
            timeWeightedReturn = realTimeWeighted?.toRate(),
            annualizedTimeWeightedReturn = realAnnualizedTimeWeighted?.toRate()
        )
    }

    private fun buildPeriodCashFlows(
        start: LocalDate,
        end: LocalDate,
        endValue: BigDecimal,
        values: List<ValuationPoint>,
        cashFlows: List<MoneyWeightedCashFlow>,
        sinceInception: Boolean
    ): List<MoneyWeightedCashFlow>? {
        val periodCashFlows = mutableListOf<MoneyWeightedCashFlow>()
        if (!sinceInception) {
            val startValue = values.valueOnOrBefore(start) ?: return null
            periodCashFlows += MoneyWeightedCashFlow(date = start, amount = startValue.negate())
        }
        periodCashFlows += cashFlows.filter { cashFlow ->
            cashFlow.isWithinPeriod(start = start, end = end, sinceInception = sinceInception)
        }
        periodCashFlows += MoneyWeightedCashFlow(date = end, amount = endValue)
        return periodCashFlows.sortedBy(MoneyWeightedCashFlow::date)
    }

    private fun calculateTimeWeightedMetric(
        start: LocalDate,
        end: LocalDate,
        values: List<ValuationPoint>,
        cashFlows: List<MoneyWeightedCashFlow>
    ): TimeWeightedMetric? {
        val orderedValues = values.sortedBy(ValuationPoint::date)
        val startValue = orderedValues.valueOnOrBefore(start) ?: return null
        val periodValuations = orderedValues.filter { valuation -> valuation.isWithinPeriod(start, end) }
        if (periodValuations.isEmpty()) {
            return TimeWeightedMetric.zero()
        }

        val totalFactor = TimeWeightedReturnCalculator.totalFactor(
            buildTimeWeightedPoints(
                start = start,
                startValue = startValue,
                valuations = periodValuations,
                cashFlows = cashFlows
            )
        ) ?: return null
        val totalReturn = totalFactor - 1.0
        return TimeWeightedMetric(
            totalReturn = totalReturn.toRate(),
            annualizedReturn = annualizedTimeWeightedReturn(
                totalFactor = totalFactor,
                totalReturn = totalReturn,
                dayCount = ChronoUnit.DAYS.between(start, end)
            ).toRate()
        )
    }

    private fun buildTimeWeightedPoints(
        start: LocalDate,
        startValue: BigDecimal,
        valuations: List<ValuationPoint>,
        cashFlows: List<MoneyWeightedCashFlow>
    ): List<TimeWeightedReturnCalculator.Point> {
        val cashFlowsByDate = cashFlows.groupBy(MoneyWeightedCashFlow::date)
            .mapValues { (_, items) -> items.sumOf(MoneyWeightedCashFlow::amount) }
        return listOf(TimeWeightedReturnCalculator.Point(date = start, value = startValue)) +
            valuations.map { valuation ->
                TimeWeightedReturnCalculator.Point(
                    date = valuation.date,
                    value = valuation.value,
                    externalFlowIntoPortfolio = cashFlowsByDate[valuation.date]?.negate() ?: BigDecimal.ZERO
                )
            }
    }

    private fun MoneyWeightedCashFlow.isWithinPeriod(
        start: LocalDate,
        end: LocalDate,
        sinceInception: Boolean
    ): Boolean = if (sinceInception) {
        !date.isBefore(start) && !date.isAfter(end)
    } else {
        date.isAfter(start) && !date.isAfter(end)
    }

    private fun ValuationPoint.isWithinPeriod(start: LocalDate, end: LocalDate): Boolean =
        date.isAfter(start) && !date.isAfter(end)

    private fun Double.toPeriodReturn(dayCount: Long): Double = if (dayCount <= 0) {
        this
    } else {
        (1.0 + this).pow(dayCount.toDouble() / 365.0) - 1.0
    }

    private fun annualize(totalReturn: Double, dayCount: Long): Double = if (dayCount <= 0) {
        totalReturn
    } else {
        (1.0 + totalReturn).pow(365.0 / dayCount.toDouble()) - 1.0
    }

    private fun annualizedTimeWeightedReturn(
        totalFactor: Double,
        totalReturn: Double,
        dayCount: Long
    ): Double = when {
        dayCount <= 0 -> totalReturn
        totalFactor <= 0.0 -> -1.0
        else -> totalFactor.pow(365.0 / dayCount.toDouble()) - 1.0
    }

    private fun Double.toRate(): BigDecimal =
        BigDecimal.valueOf(this).setScale(10, RoundingMode.HALF_UP).stripTrailingZeros()

    private data class TimeWeightedMetric(
        val totalReturn: BigDecimal,
        val annualizedReturn: BigDecimal?
    ) {
        companion object {
            fun zero(): TimeWeightedMetric = TimeWeightedMetric(
                totalReturn = BigDecimal.ZERO.toRate(),
                annualizedReturn = BigDecimal.ZERO.toRate()
            )

            private fun BigDecimal.toRate(): BigDecimal =
                setScale(10, RoundingMode.HALF_UP).stripTrailingZeros()
        }
    }
}

internal fun List<ValuationPoint>.valueOnOrBefore(date: LocalDate): BigDecimal? =
    lastOrNull { it.date <= date }?.value
