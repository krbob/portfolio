package net.bobinski.portfolio.api.domain.service

import kotlin.math.abs
import kotlin.math.pow
import java.time.temporal.ChronoUnit

internal object XirrCalculator {
    fun calculate(cashFlows: List<MoneyWeightedCashFlow>): Double? {
        if (cashFlows.size < 2) {
            return null
        }

        val problem = XirrProblem.from(cashFlows)
        if (!problem.hasPositiveAndNegativeAmounts()) {
            return null
        }
        return solveWithNewton(problem) ?: solveWithBisection(problem)
    }

    private fun solveWithNewton(problem: XirrProblem): Double? {
        var guess = problem.initialGuess()
        repeat(NEWTON_ITERATIONS) {
            val value = problem.npv(guess)
            val derivative = problem.derivative(guess)
            if (!value.isFinite() || !derivative.isFinite() || abs(derivative) < MIN_DERIVATIVE) {
                return@repeat
            }
            val next = guess - value / derivative
            if (!next.isFinite()) {
                return@repeat
            }
            if (abs(next - guess) < TOLERANCE) {
                return next
            }
            guess = next
        }
        return null
    }

    private fun solveWithBisection(problem: XirrProblem): Double? {
        var low = MIN_BRACKET_RATE
        var high = INITIAL_MAX_BRACKET_RATE
        var lowValue = problem.npv(low)
        var highValue = problem.npv(high)
        repeat(BRACKET_EXPANSIONS) {
            if (lowValue * highValue <= 0.0) {
                return@repeat
            }
            high *= 2.0
            highValue = problem.npv(high)
        }
        if (lowValue * highValue > 0.0) {
            return null
        }

        repeat(BISECTION_ITERATIONS) {
            val mid = (low + high) / 2.0
            val midValue = problem.npv(mid)
            if (!midValue.isFinite() || abs(midValue) < TOLERANCE) {
                return mid
            }
            if (lowValue * midValue < 0.0) {
                high = mid
                highValue = midValue
            } else {
                low = mid
                lowValue = midValue
            }
        }
        return (low + high) / 2.0
    }

    private data class XirrProblem(
        val amounts: List<Double>,
        val days: List<Double>
    ) {
        fun hasPositiveAndNegativeAmounts(): Boolean =
            amounts.any { it > 0.0 } && amounts.any { it < 0.0 }

        fun initialGuess(): Double = if (
            amounts.filter { it > 0.0 }.sum() / -amounts.filter { it < 0.0 }.sum() - 1.0 < 0.0
        ) {
            -0.5
        } else {
            0.1
        }

        fun npv(rate: Double): Double {
            val normalizedRate = safeRate(rate)
            return amounts.indices.sumOf { index ->
                amounts[index] / (1.0 + normalizedRate).pow(days[index] / 365.0)
            }
        }

        fun derivative(rate: Double): Double {
            val normalizedRate = safeRate(rate)
            return amounts.indices.sumOf { index ->
                val exponent = days[index] / 365.0
                -(exponent * amounts[index]) / (1.0 + normalizedRate).pow(exponent + 1.0)
            }
        }

        companion object {
            fun from(cashFlows: List<MoneyWeightedCashFlow>): XirrProblem {
                val ordered = cashFlows.sortedBy(MoneyWeightedCashFlow::date)
                val t0 = ordered.first().date
                return XirrProblem(
                    amounts = ordered.map { it.amount.toDouble() },
                    days = ordered.map { ChronoUnit.DAYS.between(t0, it.date).toDouble() }
                )
            }

            private fun safeRate(rate: Double): Double = maxOf(rate, MIN_SAFE_RATE)
        }
    }

    private const val NEWTON_ITERATIONS = 50
    private const val BRACKET_EXPANSIONS = 20
    private const val BISECTION_ITERATIONS = 100
    private const val MIN_DERIVATIVE = 1e-20
    private const val TOLERANCE = 1e-10
    private const val MIN_SAFE_RATE = -0.9999999
    private const val MIN_BRACKET_RATE = -0.9999
    private const val INITIAL_MAX_BRACKET_RATE = 10.0
}
