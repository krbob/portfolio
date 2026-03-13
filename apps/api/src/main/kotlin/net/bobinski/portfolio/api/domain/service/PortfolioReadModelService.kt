package net.bobinski.portfolio.api.domain.service

import net.bobinski.portfolio.api.domain.model.Account
import net.bobinski.portfolio.api.domain.model.AssetClass
import net.bobinski.portfolio.api.domain.model.Instrument
import net.bobinski.portfolio.api.domain.model.Transaction
import net.bobinski.portfolio.api.domain.model.TransactionType
import net.bobinski.portfolio.api.domain.repository.AccountRepository
import net.bobinski.portfolio.api.domain.repository.InstrumentRepository
import net.bobinski.portfolio.api.domain.repository.TransactionRepository
import java.math.BigDecimal
import java.math.MathContext
import java.math.RoundingMode
import java.time.Clock
import java.time.LocalDate
import java.util.UUID

class PortfolioReadModelService(
    private val accountRepository: AccountRepository,
    private val instrumentRepository: InstrumentRepository,
    private val transactionRepository: TransactionRepository,
    private val clock: Clock
) {
    suspend fun overview(): PortfolioOverview {
        val snapshot = buildSnapshot()
        val investedBookValuePln = snapshot.holdings.sumOf { it.costBasisPln }
        val equityBookValuePln = snapshot.holdings
            .filter { it.instrument.assetClass == AssetClass.EQUITIES }
            .sumOf { it.costBasisPln }
        val bondBookValuePln = snapshot.holdings
            .filter { it.instrument.assetClass == AssetClass.BONDS }
            .sumOf { it.costBasisPln }
        val cashBookValuePln = snapshot.cashBalancePln
        val totalBookValuePln = investedBookValuePln.add(cashBookValuePln, MONEY_CONTEXT)

        return PortfolioOverview(
            asOf = LocalDate.now(clock),
            valuationState = ValuationState.BOOK_ONLY,
            totalBookValuePln = totalBookValuePln.money(),
            investedBookValuePln = investedBookValuePln.money(),
            cashBalancePln = cashBookValuePln.money(),
            netContributionsPln = snapshot.netContributionsPln.money(),
            equityBookValuePln = equityBookValuePln.money(),
            bondBookValuePln = bondBookValuePln.money(),
            cashBookValuePln = cashBookValuePln.money(),
            accountCount = snapshot.accounts.size,
            instrumentCount = snapshot.instruments.size,
            activeHoldingCount = snapshot.holdings.size,
            missingFxTransactions = snapshot.missingFxTransactions,
            unsupportedCorrectionTransactions = snapshot.unsupportedCorrectionTransactions
        )
    }

    suspend fun holdings(): List<HoldingSnapshot> {
        val snapshot = buildSnapshot()

        return snapshot.holdings
            .sortedWith(compareBy({ it.account.name.lowercase() }, { it.instrument.name.lowercase() }))
            .map { holding ->
                HoldingSnapshot(
                    accountId = holding.account.id,
                    accountName = holding.account.name,
                    instrumentId = holding.instrument.id,
                    instrumentName = holding.instrument.name,
                    kind = holding.instrument.kind.name,
                    assetClass = holding.instrument.assetClass.name,
                    currency = holding.instrument.currency,
                    quantity = holding.quantity.quantity(),
                    averageCostPerUnitPln = if (holding.quantity.signum() == 0) {
                        BigDecimal.ZERO.money()
                    } else {
                        holding.costBasisPln.divide(holding.quantity, 8, RoundingMode.HALF_UP).money()
                    },
                    costBasisPln = holding.costBasisPln.money(),
                    bookValuePln = holding.costBasisPln.money(),
                    transactionCount = holding.transactionCount
                )
            }
    }

    private suspend fun buildSnapshot(): PortfolioLedgerSnapshot {
        val accounts = accountRepository.list()
        val instruments = instrumentRepository.list()
        val transactions = transactionRepository.list()
            .sortedWith(compareBy<Transaction>({ it.tradeDate }, { it.createdAt }))

        val accountsById = accounts.associateBy(Account::id)
        val instrumentsById = instruments.associateBy(Instrument::id)
        val holdings = linkedMapOf<HoldingKey, MutableHolding>()

        var cashBalancePln = BigDecimal.ZERO
        var netContributionsPln = BigDecimal.ZERO
        var missingFxTransactions = 0
        var unsupportedCorrectionTransactions = 0

        transactions.forEach { transaction ->
            val converted = transaction.toConvertedAmountsOrNull()
            if (converted == null) {
                missingFxTransactions += 1
                return@forEach
            }

            when (transaction.type) {
                TransactionType.BUY -> {
                    val instrument = instrumentsById[transaction.instrumentId] ?: return@forEach
                    val account = accountsById[transaction.accountId] ?: return@forEach
                    val key = HoldingKey(account.id, instrument.id)
                    val holding = holdings.getOrPut(key) {
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
                    val key = HoldingKey(account.id, instrument.id)
                    val holding = holdings.getOrPut(key) {
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
                        holding.costBasisPln = costBasisBefore.subtract(reducedCostBasis, MONEY_CONTEXT).max(BigDecimal.ZERO)
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

        return PortfolioLedgerSnapshot(
            accounts = accounts,
            instruments = instruments,
            holdings = holdings.values
                .filter { it.quantity.signum() > 0 }
                .toList(),
            cashBalancePln = cashBalancePln,
            netContributionsPln = netContributionsPln,
            missingFxTransactions = missingFxTransactions,
            unsupportedCorrectionTransactions = unsupportedCorrectionTransactions
        )
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

    private fun BigDecimal.quantity(): BigDecimal = setScale(8, RoundingMode.HALF_UP).stripTrailingZeros()

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

    private data class PortfolioLedgerSnapshot(
        val accounts: List<Account>,
        val instruments: List<Instrument>,
        val holdings: List<MutableHolding>,
        val cashBalancePln: BigDecimal,
        val netContributionsPln: BigDecimal,
        val missingFxTransactions: Int,
        val unsupportedCorrectionTransactions: Int
    )

    private companion object {
        val MONEY_CONTEXT: MathContext = MathContext.DECIMAL64
    }
}

data class PortfolioOverview(
    val asOf: LocalDate,
    val valuationState: ValuationState,
    val totalBookValuePln: BigDecimal,
    val investedBookValuePln: BigDecimal,
    val cashBalancePln: BigDecimal,
    val netContributionsPln: BigDecimal,
    val equityBookValuePln: BigDecimal,
    val bondBookValuePln: BigDecimal,
    val cashBookValuePln: BigDecimal,
    val accountCount: Int,
    val instrumentCount: Int,
    val activeHoldingCount: Int,
    val missingFxTransactions: Int,
    val unsupportedCorrectionTransactions: Int
)

data class HoldingSnapshot(
    val accountId: UUID,
    val accountName: String,
    val instrumentId: UUID,
    val instrumentName: String,
    val kind: String,
    val assetClass: String,
    val currency: String,
    val quantity: BigDecimal,
    val averageCostPerUnitPln: BigDecimal,
    val costBasisPln: BigDecimal,
    val bookValuePln: BigDecimal,
    val transactionCount: Int
)

enum class ValuationState {
    BOOK_ONLY
}
