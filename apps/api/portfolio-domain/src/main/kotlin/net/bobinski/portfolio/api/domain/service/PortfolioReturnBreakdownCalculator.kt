package net.bobinski.portfolio.api.domain.service

import net.bobinski.portfolio.api.domain.model.Transaction
import net.bobinski.portfolio.api.domain.model.TransactionType
import java.math.BigDecimal
import java.math.RoundingMode
import java.time.LocalDate

internal object PortfolioReturnBreakdownCalculator {
    fun calculate(
        start: LocalDate,
        end: LocalDate,
        values: List<ValuationPoint>,
        transactions: List<Transaction>,
        fxLookups: TransactionFxLookups
    ): ReturnBreakdown? {
        if (values.isEmpty()) {
            return null
        }

        val closingValue = values.valueOnOrBefore(end)?.money() ?: return null
        val sinceInception = values.none { it.date < start }
        val openingValue = openingValue(values, start, sinceInception) ?: return null
        val accumulator = BreakdownAccumulator()
        transactions
            .filter { transaction -> transaction.isWithinPeriod(start, end, sinceInception) }
            .forEach { transaction -> accumulator.add(transaction, fxLookups) }

        return accumulator.toBreakdown(openingValue = openingValue, closingValue = closingValue)
    }

    private fun openingValue(
        values: List<ValuationPoint>,
        start: LocalDate,
        sinceInception: Boolean
    ): BigDecimal? = if (sinceInception) {
        BigDecimal.ZERO.money()
    } else {
        values.valueOnOrBefore(start)?.money()
    }

    private fun Transaction.isWithinPeriod(
        start: LocalDate,
        end: LocalDate,
        sinceInception: Boolean
    ): Boolean = if (sinceInception) {
        !tradeDate.isBefore(start) && !tradeDate.isAfter(end)
    } else {
        tradeDate.isAfter(start) && !tradeDate.isAfter(end)
    }

    private data class BreakdownAccumulator(
        var netExternalFlows: BigDecimal = BigDecimal.ZERO.money(),
        var interestAndCoupons: BigDecimal = BigDecimal.ZERO.money(),
        var fees: BigDecimal = BigDecimal.ZERO.money(),
        var taxes: BigDecimal = BigDecimal.ZERO.money(),
        var skippedFxTransactionCount: Int = 0
    ) {
        fun add(transaction: Transaction, fxLookups: TransactionFxLookups) {
            val converted = fxLookups.convertedAmountsOrNull(transaction)
            if (converted == null) {
                skippedFxTransactionCount += 1
                return
            }

            addGrossAmount(transaction.type, converted.grossPln)
            if (converted.feePln.signum() > 0) {
                fees = fees.subtract(converted.feePln).money()
            }
            if (converted.taxPln.signum() > 0) {
                taxes = taxes.subtract(converted.taxPln).money()
            }
        }

        fun toBreakdown(openingValue: BigDecimal, closingValue: BigDecimal): ReturnBreakdown {
            val netChange = closingValue.subtract(openingValue).money()
            val marketAndFx = netChange
                .subtract(netExternalFlows)
                .subtract(interestAndCoupons)
                .subtract(fees)
                .subtract(taxes)
                .money()

            return ReturnBreakdown(
                openingValuePln = openingValue,
                closingValuePln = closingValue,
                netChangePln = netChange,
                netExternalFlowsPln = netExternalFlows,
                interestAndCouponsPln = interestAndCoupons,
                feesPln = fees,
                taxesPln = taxes,
                marketAndFxPln = marketAndFx,
                netInvestmentResultPln = netChange.subtract(netExternalFlows).money(),
                skippedFxTransactionCount = skippedFxTransactionCount
            )
        }

        private fun addGrossAmount(type: TransactionType, grossPln: BigDecimal) {
            when (type) {
                TransactionType.DEPOSIT -> netExternalFlows = netExternalFlows.add(grossPln).money()
                TransactionType.WITHDRAWAL -> netExternalFlows = netExternalFlows.subtract(grossPln).money()
                TransactionType.INTEREST -> interestAndCoupons = interestAndCoupons.add(grossPln).money()
                TransactionType.FEE -> fees = fees.subtract(grossPln).money()
                TransactionType.TAX -> taxes = taxes.subtract(grossPln).money()
                else -> Unit
            }
        }
    }
}

private fun BigDecimal.money(): BigDecimal =
    setScale(2, RoundingMode.HALF_UP).stripTrailingZeros()
