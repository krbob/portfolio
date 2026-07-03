package net.bobinski.portfolio.api.domain.service

import java.math.BigDecimal
import java.math.MathContext
import java.math.RoundingMode
import java.time.LocalDate
import java.util.TreeMap

internal object TimeWeightedReturnCalculator {
    private val moneyContext: MathContext = MathContext.DECIMAL64
    private val baseIndex: BigDecimal = BigDecimal("100.0000")

    data class Point(
        val date: LocalDate,
        val value: BigDecimal,
        val externalFlowIntoPortfolio: BigDecimal = BigDecimal.ZERO
    )

    fun buildIndex(points: List<Point>): TreeMap<LocalDate, BigDecimal> {
        val lookup = TreeMap<LocalDate, BigDecimal>()
        if (points.isEmpty()) {
            return lookup
        }

        var currentIndex: BigDecimal? = null
        var previousPoint: Point? = null

        points.sortedBy(Point::date).forEach { point ->
            val index = currentIndex
            val previous = previousPoint

            when {
                index == null && point.value.signum() > 0 -> {
                    currentIndex = baseIndex
                    lookup[point.date] = baseIndex
                }

                index != null && previous != null -> {
                    dailyFactor(
                        previousValue = previous.value,
                        currentValue = point.value,
                        externalFlowIntoPortfolio = point.externalFlowIntoPortfolio,
                        allowFlatZero = false
                    )?.let { factor ->
                        currentIndex = index
                            .multiply(factor, moneyContext)
                            .index()
                        lookup[point.date] = currentIndex
                    }
                }
            }

            previousPoint = point
        }

        return lookup
    }

    fun totalFactor(points: List<Point>): Double? {
        val ordered = points.sortedBy(Point::date)
        if (ordered.size < 2) {
            return 1.0
        }

        var totalFactor = 1.0
        var previous = ordered.first()
        for (point in ordered.drop(1)) {
            val factor = dailyFactor(
                previousValue = previous.value,
                currentValue = point.value,
                externalFlowIntoPortfolio = point.externalFlowIntoPortfolio,
                allowFlatZero = true
            ) ?: return null
            val factorValue = factor.toDouble()
            if (!factorValue.isFinite()) {
                return null
            }
            totalFactor *= factorValue
            previous = point
        }

        return totalFactor
    }

    private fun dailyFactor(
        previousValue: BigDecimal,
        currentValue: BigDecimal,
        externalFlowIntoPortfolio: BigDecimal,
        allowFlatZero: Boolean
    ): BigDecimal? {
        val netGrowthValue = currentValue.subtract(externalFlowIntoPortfolio, moneyContext)
        return when {
            previousValue.signum() == 0 && allowFlatZero && netGrowthValue.signum() == 0 -> BigDecimal.ONE
            previousValue.signum() == 0 -> null
            else -> netGrowthValue.divide(previousValue, 12, RoundingMode.HALF_UP)
                .takeIf { factor -> factor.signum() >= 0 }
        }
    }

    private fun BigDecimal.index(): BigDecimal = setScale(4, RoundingMode.HALF_UP).stripTrailingZeros()
}
