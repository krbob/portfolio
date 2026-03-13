package net.bobinski.portfolio.api.domain.service

import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import net.bobinski.portfolio.api.domain.model.Transaction
import net.bobinski.portfolio.api.marketdata.model.HistoricalPricePoint
import net.bobinski.portfolio.api.marketdata.service.FxRateHistoryProvider
import net.bobinski.portfolio.api.marketdata.service.FxRateHistoryResult
import java.math.BigDecimal
import java.math.MathContext
import java.math.RoundingMode
import java.time.LocalDate
import java.util.TreeMap

class TransactionFxConversionService(
    private val fxRateHistoryProvider: FxRateHistoryProvider
) {
    internal suspend fun loadLookups(transactions: List<Transaction>): TransactionFxLookups = coroutineScope {
        val rangesByCurrency = transactions
            .asSequence()
            .filter { it.currency != "PLN" && it.fxRateToPln == null }
            .groupBy(Transaction::currency)
            .mapValues { (_, currencyTransactions) ->
                DateRange(
                    from = currencyTransactions.minOf(Transaction::tradeDate),
                    to = currencyTransactions.maxOf(Transaction::tradeDate)
                )
            }

        val results = rangesByCurrency
            .map { (currency, range) ->
                async { currency to fxRateHistoryProvider.dailyRateToPln(currency, range.from, range.to) }
            }
            .awaitAll()

        val lookups = buildMap<String, TreeMap<LocalDate, BigDecimal>> {
            results.forEach { (currency, result) ->
                if (result is FxRateHistoryResult.Success) {
                    put(currency, result.prices.toLookup())
                }
            }
        }

        TransactionFxLookups(lookups = lookups)
    }

    private data class DateRange(
        val from: LocalDate,
        val to: LocalDate
    )

    private fun List<HistoricalPricePoint>.toLookup(): TreeMap<LocalDate, BigDecimal> =
        associateTo(TreeMap()) { it.date to it.closePricePln.money() }

    private fun BigDecimal.money(): BigDecimal = setScale(2, RoundingMode.HALF_UP)
}

internal class TransactionFxLookups(
    private val lookups: Map<String, TreeMap<LocalDate, BigDecimal>>
) {
    fun convertedAmountsOrNull(transaction: Transaction): ConvertedTransactionAmounts? {
        val grossPln = convertToPlnOrNull(transaction, transaction.grossAmount) ?: return null
        val feePln = convertToPlnOrNull(transaction, transaction.feeAmount) ?: return null
        val taxPln = convertToPlnOrNull(transaction, transaction.taxAmount) ?: return null
        return ConvertedTransactionAmounts(
            grossPln = grossPln,
            feePln = feePln,
            taxPln = taxPln
        )
    }

    private fun convertToPlnOrNull(
        transaction: Transaction,
        amount: BigDecimal
    ): BigDecimal? = when {
        amount.signum() == 0 -> BigDecimal.ZERO.money()
        transaction.currency == "PLN" -> amount.money()
        transaction.fxRateToPln != null -> amount.multiply(transaction.fxRateToPln, MONEY_CONTEXT).money()
        else -> lookups[transaction.currency]
            ?.floorEntry(transaction.tradeDate)
            ?.value
            ?.let { rate -> amount.multiply(rate, MONEY_CONTEXT).money() }
    }

    private fun BigDecimal.money(): BigDecimal = setScale(2, RoundingMode.HALF_UP)

    private companion object {
        val MONEY_CONTEXT: MathContext = MathContext.DECIMAL64
    }
}

internal data class ConvertedTransactionAmounts(
    val grossPln: BigDecimal,
    val feePln: BigDecimal,
    val taxPln: BigDecimal
)
