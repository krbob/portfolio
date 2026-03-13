package net.bobinski.portfolio.api.domain.service

import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import net.bobinski.portfolio.api.domain.model.Account
import net.bobinski.portfolio.api.domain.model.AssetClass
import net.bobinski.portfolio.api.domain.model.Instrument
import net.bobinski.portfolio.api.domain.model.Transaction
import net.bobinski.portfolio.api.domain.model.TransactionType
import net.bobinski.portfolio.api.domain.repository.AccountRepository
import net.bobinski.portfolio.api.domain.repository.InstrumentRepository
import net.bobinski.portfolio.api.domain.repository.TransactionRepository
import net.bobinski.portfolio.api.marketdata.model.HistoricalPricePoint
import net.bobinski.portfolio.api.marketdata.service.HistoricalInstrumentValuationProvider
import net.bobinski.portfolio.api.marketdata.service.HistoricalInstrumentValuationResult
import net.bobinski.portfolio.api.marketdata.service.InstrumentValuationFailureType
import java.math.BigDecimal
import java.math.MathContext
import java.math.RoundingMode
import java.time.Clock
import java.time.LocalDate
import java.util.TreeMap
import java.util.UUID

class PortfolioHistoryService(
    private val accountRepository: AccountRepository,
    private val instrumentRepository: InstrumentRepository,
    private val transactionRepository: TransactionRepository,
    private val historicalInstrumentValuationProvider: HistoricalInstrumentValuationProvider,
    private val clock: Clock
) {
    suspend fun dailyHistory(): PortfolioDailyHistory {
        val accounts = accountRepository.list()
        val instruments = instrumentRepository.list()
        val transactions = transactionRepository.list()
            .sortedWith(compareBy<Transaction>({ it.tradeDate }, { it.createdAt }))

        if (transactions.isEmpty()) {
            val today = LocalDate.now(clock)
            return PortfolioDailyHistory(
                from = today,
                until = today,
                valuationState = ValuationState.MARK_TO_MARKET,
                instrumentHistoryIssueCount = 0,
                missingFxTransactions = 0,
                unsupportedCorrectionTransactions = 0,
                points = emptyList()
            )
        }

        val from = transactions.minOf(Transaction::tradeDate)
        val until = LocalDate.now(clock)
        val historyLoads = loadInstrumentHistories(
            instruments = instruments,
            transactions = transactions,
            from = from,
            until = until
        )
        val accountsById = accounts.associateBy(Account::id)
        val instrumentsById = instruments.associateBy(Instrument::id)
        val transactionsByDate = transactions.groupBy(Transaction::tradeDate)
        val holdings = linkedMapOf<HoldingKey, MutableHolding>()

        var cashBalancePln = BigDecimal.ZERO
        var netContributionsPln = BigDecimal.ZERO
        var missingFxTransactions = 0
        var unsupportedCorrectionTransactions = 0
        val points = mutableListOf<PortfolioDailyHistoryPoint>()

        var date = from
        while (!date.isAfter(until)) {
            transactionsByDate[date].orEmpty().forEach { transaction ->
                val converted = transaction.toConvertedAmountsOrNull()
                if (converted == null) {
                    missingFxTransactions += 1
                    return@forEach
                }

                when (transaction.type) {
                    TransactionType.BUY -> {
                        val instrument = instrumentsById[transaction.instrumentId] ?: return@forEach
                        val account = accountsById[transaction.accountId] ?: return@forEach
                        val holding = holdings.getOrPut(HoldingKey(account.id, instrument.id)) {
                            MutableHolding(account = account, instrument = instrument)
                        }
                        holding.quantity = holding.quantity.add(transaction.quantity ?: BigDecimal.ZERO, MONEY_CONTEXT)
                        holding.costBasisPln = holding.costBasisPln
                            .add(converted.grossPln, MONEY_CONTEXT)
                            .add(converted.feePln, MONEY_CONTEXT)
                            .add(converted.taxPln, MONEY_CONTEXT)
                        holding.transactionCount += 1

                        cashBalancePln = cashBalancePln
                            .subtract(converted.grossPln, MONEY_CONTEXT)
                            .subtract(converted.feePln, MONEY_CONTEXT)
                            .subtract(converted.taxPln, MONEY_CONTEXT)
                    }

                    TransactionType.SELL -> {
                        val instrument = instrumentsById[transaction.instrumentId] ?: return@forEach
                        val account = accountsById[transaction.accountId] ?: return@forEach
                        val holding = holdings.getOrPut(HoldingKey(account.id, instrument.id)) {
                            MutableHolding(account = account, instrument = instrument)
                        }
                        val sellQuantity = transaction.quantity ?: BigDecimal.ZERO
                        val quantityBefore = holding.quantity
                        val costBasisBefore = holding.costBasisPln

                        if (quantityBefore.signum() > 0 && sellQuantity.signum() > 0) {
                            val reducedCostBasis = if (sellQuantity >= quantityBefore) {
                                costBasisBefore
                            } else {
                                costBasisBefore
                                    .divide(quantityBefore, 12, RoundingMode.HALF_UP)
                                    .multiply(sellQuantity, MONEY_CONTEXT)
                            }
                            holding.quantity = quantityBefore.subtract(sellQuantity, MONEY_CONTEXT).max(BigDecimal.ZERO)
                            holding.costBasisPln = costBasisBefore
                                .subtract(reducedCostBasis, MONEY_CONTEXT)
                                .max(BigDecimal.ZERO)
                        }
                        holding.transactionCount += 1

                        cashBalancePln = cashBalancePln
                            .add(converted.grossPln, MONEY_CONTEXT)
                            .subtract(converted.feePln, MONEY_CONTEXT)
                            .subtract(converted.taxPln, MONEY_CONTEXT)
                    }

                    TransactionType.DEPOSIT -> {
                        cashBalancePln = cashBalancePln.add(converted.grossPln, MONEY_CONTEXT)
                        netContributionsPln = netContributionsPln.add(converted.grossPln, MONEY_CONTEXT)
                    }

                    TransactionType.WITHDRAWAL -> {
                        cashBalancePln = cashBalancePln.subtract(converted.grossPln, MONEY_CONTEXT)
                        netContributionsPln = netContributionsPln.subtract(converted.grossPln, MONEY_CONTEXT)
                    }

                    TransactionType.FEE,
                    TransactionType.TAX -> {
                        cashBalancePln = cashBalancePln.subtract(converted.grossPln, MONEY_CONTEXT)
                    }

                    TransactionType.INTEREST -> {
                        cashBalancePln = cashBalancePln.add(converted.grossPln, MONEY_CONTEXT)
                    }

                    TransactionType.CORRECTION -> {
                        unsupportedCorrectionTransactions += 1
                    }
                }
            }

            val activeHoldings = holdings.values.filter { it.quantity.signum() > 0 }
            val valuedHoldingCount = activeHoldings.count { holding ->
                historyLoads.priceLookup(holding.instrument.id).floorEntry(date)?.value != null
            }

            val equityCurrentValuePln = activeHoldings
                .filter { it.instrument.assetClass == AssetClass.EQUITIES }
                .sumOf { holding -> holding.currentValueOn(date, historyLoads).money() }
            val bondCurrentValuePln = activeHoldings
                .filter { it.instrument.assetClass == AssetClass.BONDS }
                .sumOf { holding -> holding.currentValueOn(date, historyLoads).money() }
            val investedBookValuePln = activeHoldings.sumOf { it.costBasisPln.money() }
            val investedCurrentValuePln = activeHoldings.sumOf { it.currentValueOn(date, historyLoads).money() }
            val cashCurrentValuePln = cashBalancePln.money()
            val totalBookValuePln = investedBookValuePln.add(cashCurrentValuePln, MONEY_CONTEXT).money()
            val totalCurrentValuePln = investedCurrentValuePln.add(cashCurrentValuePln, MONEY_CONTEXT).money()

            points += PortfolioDailyHistoryPoint(
                date = date,
                totalBookValuePln = totalBookValuePln,
                totalCurrentValuePln = totalCurrentValuePln,
                netContributionsPln = netContributionsPln.money(),
                cashBalancePln = cashCurrentValuePln,
                equityCurrentValuePln = equityCurrentValuePln.money(),
                bondCurrentValuePln = bondCurrentValuePln.money(),
                cashCurrentValuePln = cashCurrentValuePln,
                equityAllocationPct = totalCurrentValuePln.ratioOf(equityCurrentValuePln),
                bondAllocationPct = totalCurrentValuePln.ratioOf(bondCurrentValuePln),
                cashAllocationPct = totalCurrentValuePln.ratioOf(cashCurrentValuePln),
                activeHoldingCount = activeHoldings.size,
                valuedHoldingCount = valuedHoldingCount
            )

            date = date.plusDays(1)
        }

        return PortfolioDailyHistory(
            from = from,
            until = until,
            valuationState = historyLoads.valuationState,
            instrumentHistoryIssueCount = historyLoads.issueCount,
            missingFxTransactions = missingFxTransactions,
            unsupportedCorrectionTransactions = unsupportedCorrectionTransactions,
            points = points
        )
    }

    private suspend fun loadInstrumentHistories(
        instruments: List<Instrument>,
        transactions: List<Transaction>,
        from: LocalDate,
        until: LocalDate
    ): HistoricalLoads = coroutineScope {
        val usedInstrumentIds = transactions.mapNotNull(Transaction::instrumentId).toSet()
        val usedInstruments = instruments.filter { it.id in usedInstrumentIds }

        val results = usedInstruments
            .map { instrument ->
                async { instrument.id to historicalInstrumentValuationProvider.dailyPriceSeries(instrument, from, until) }
            }
            .awaitAll()
            .toMap()

        val lookups = results.mapValues { (_, result) ->
            when (result) {
                is HistoricalInstrumentValuationResult.Success -> result.prices.toLookup()
                is HistoricalInstrumentValuationResult.Failure -> TreeMap()
            }
        }
        val issueCount = results.values.count { it is HistoricalInstrumentValuationResult.Failure }
        val successCount = results.values.count { it is HistoricalInstrumentValuationResult.Success }
        val valuationState = when {
            usedInstrumentIds.isEmpty() -> ValuationState.MARK_TO_MARKET
            successCount == usedInstrumentIds.size -> ValuationState.MARK_TO_MARKET
            successCount == 0 -> ValuationState.BOOK_ONLY
            else -> ValuationState.PARTIALLY_VALUED
        }

        HistoricalLoads(
            lookups = lookups,
            issueCount = issueCount,
            valuationState = valuationState
        )
    }

    private fun List<HistoricalPricePoint>.toLookup(): TreeMap<LocalDate, BigDecimal> =
        associateTo(TreeMap()) { it.date to it.closePricePln.money() }

    private fun HistoricalLoads.priceLookup(instrumentId: UUID): TreeMap<LocalDate, BigDecimal> =
        lookups[instrumentId] ?: TreeMap()

    private fun MutableHolding.currentValueOn(date: LocalDate, historyLoads: HistoricalLoads): BigDecimal {
        val price = historyLoads.priceLookup(instrument.id).floorEntry(date)?.value
        return if (price != null) {
            price.multiply(quantity, MONEY_CONTEXT).money()
        } else {
            costBasisPln.money()
        }
    }

    private fun Transaction.toConvertedAmountsOrNull(): ConvertedTransactionAmounts? {
        val grossPln = convertToPln(grossAmount) ?: return null
        val feePln = convertToPln(feeAmount) ?: return null
        val taxPln = convertToPln(taxAmount) ?: return null
        return ConvertedTransactionAmounts(grossPln = grossPln, feePln = feePln, taxPln = taxPln)
    }

    private fun Transaction.convertToPln(amount: BigDecimal): BigDecimal? =
        when {
            currency == "PLN" -> amount.money()
            fxRateToPln != null -> amount.multiply(fxRateToPln, MONEY_CONTEXT).money()
            else -> null
        }

    private fun BigDecimal.money(): BigDecimal = setScale(2, RoundingMode.HALF_UP)

    private fun BigDecimal.ratioOf(part: BigDecimal): BigDecimal =
        if (signum() <= 0 || part.signum() <= 0) {
            BigDecimal.ZERO.money()
        } else {
            part.divide(this, 6, RoundingMode.HALF_UP)
                .multiply(BigDecimal(100), MONEY_CONTEXT)
                .money()
        }

    private data class HoldingKey(
        val accountId: UUID,
        val instrumentId: UUID
    )

    private data class MutableHolding(
        val account: Account,
        val instrument: Instrument,
        var quantity: BigDecimal = BigDecimal.ZERO,
        var costBasisPln: BigDecimal = BigDecimal.ZERO,
        var transactionCount: Int = 0
    )

    private data class ConvertedTransactionAmounts(
        val grossPln: BigDecimal,
        val feePln: BigDecimal,
        val taxPln: BigDecimal
    )

    private data class HistoricalLoads(
        val lookups: Map<UUID, TreeMap<LocalDate, BigDecimal>>,
        val issueCount: Int,
        val valuationState: ValuationState
    )

    private companion object {
        val MONEY_CONTEXT: MathContext = MathContext.DECIMAL64
    }
}

data class PortfolioDailyHistory(
    val from: LocalDate,
    val until: LocalDate,
    val valuationState: ValuationState,
    val instrumentHistoryIssueCount: Int,
    val missingFxTransactions: Int,
    val unsupportedCorrectionTransactions: Int,
    val points: List<PortfolioDailyHistoryPoint>
)

data class PortfolioDailyHistoryPoint(
    val date: LocalDate,
    val totalBookValuePln: BigDecimal,
    val totalCurrentValuePln: BigDecimal,
    val netContributionsPln: BigDecimal,
    val cashBalancePln: BigDecimal,
    val equityCurrentValuePln: BigDecimal,
    val bondCurrentValuePln: BigDecimal,
    val cashCurrentValuePln: BigDecimal,
    val equityAllocationPct: BigDecimal,
    val bondAllocationPct: BigDecimal,
    val cashAllocationPct: BigDecimal,
    val activeHoldingCount: Int,
    val valuedHoldingCount: Int
)
