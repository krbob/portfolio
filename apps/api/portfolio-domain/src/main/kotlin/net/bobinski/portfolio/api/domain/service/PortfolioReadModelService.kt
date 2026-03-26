package net.bobinski.portfolio.api.domain.service

import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import net.bobinski.portfolio.api.domain.model.Account
import net.bobinski.portfolio.api.domain.model.AssetClass
import net.bobinski.portfolio.api.domain.model.Instrument
import net.bobinski.portfolio.api.domain.model.InstrumentKind
import net.bobinski.portfolio.api.domain.model.Transaction
import net.bobinski.portfolio.api.domain.model.TransactionType
import net.bobinski.portfolio.api.domain.model.toLotTerms
import net.bobinski.portfolio.api.domain.repository.AccountRepository
import net.bobinski.portfolio.api.domain.repository.InstrumentRepository
import net.bobinski.portfolio.api.domain.repository.TransactionRepository
import net.bobinski.portfolio.api.marketdata.service.CurrentInstrumentValuationProvider
import net.bobinski.portfolio.api.marketdata.service.EdoLotValuationProvider
import net.bobinski.portfolio.api.marketdata.service.InstrumentValuation
import net.bobinski.portfolio.api.marketdata.service.InstrumentValuationFailureType
import net.bobinski.portfolio.api.marketdata.service.InstrumentValuationResult
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
    private val currentInstrumentValuationProvider: CurrentInstrumentValuationProvider,
    private val edoLotValuationProvider: EdoLotValuationProvider,
    private val transactionFxConversionService: TransactionFxConversionService,
    private val clock: Clock
) {
    suspend fun accounts(): List<PortfolioAccountSummary> {
        val snapshot = buildValuedSnapshot()
        val totalPortfolioCurrentValuePln = snapshot.holdings.sumOf { it.effectiveCurrentValuePln() }
            .add(snapshot.cashBalancePln, MONEY_CONTEXT)

        return snapshot.accounts
            .sortedWith(compareBy<Account>({ it.displayOrder }, { it.createdAt }, { it.name.lowercase() }))
            .map { account ->
                val accountHoldings = snapshot.holdings.filter { it.account.id == account.id }
                val investedBookValuePln = accountHoldings.sumOf(ValuedHolding::costBasisPln)
                val investedCurrentValuePln = accountHoldings.sumOf(ValuedHolding::effectiveCurrentValuePln)
                val cashBalancePln = snapshot.cashBalanceByAccountPln[account.id] ?: BigDecimal.ZERO
                val netContributionsPln = snapshot.netContributionsByAccountPln[account.id] ?: BigDecimal.ZERO
                val totalBookValuePln = investedBookValuePln.add(cashBalancePln, MONEY_CONTEXT)
                val totalCurrentValuePln = investedCurrentValuePln.add(cashBalancePln, MONEY_CONTEXT)
                val valuationState = when {
                    accountHoldings.isEmpty() -> ValuationState.MARK_TO_MARKET
                    accountHoldings.all { it.valuationStatus == HoldingValuationStatus.VALUED } -> ValuationState.MARK_TO_MARKET
                    accountHoldings.none { it.valuationStatus == HoldingValuationStatus.VALUED } -> ValuationState.BOOK_ONLY
                    else -> ValuationState.PARTIALLY_VALUED
                }
                val portfolioWeightPct = if (totalPortfolioCurrentValuePln.signum() == 0) {
                    BigDecimal.ZERO
                } else {
                    totalCurrentValuePln
                        .multiply(BigDecimal("100"), MONEY_CONTEXT)
                        .divide(totalPortfolioCurrentValuePln, 8, RoundingMode.HALF_UP)
                        .money()
                }

                PortfolioAccountSummary(
                    accountId = account.id,
                    accountName = account.name,
                    institution = account.institution,
                    type = account.type.name,
                    baseCurrency = account.baseCurrency,
                    displayOrder = account.displayOrder,
                    valuationState = valuationState,
                    totalBookValuePln = totalBookValuePln.money(),
                    totalCurrentValuePln = totalCurrentValuePln.money(),
                    investedBookValuePln = investedBookValuePln.money(),
                    investedCurrentValuePln = investedCurrentValuePln.money(),
                    cashBalancePln = cashBalancePln.money(),
                    netContributionsPln = netContributionsPln.money(),
                    totalUnrealizedGainPln = totalCurrentValuePln.subtract(totalBookValuePln, MONEY_CONTEXT).money(),
                    portfolioWeightPct = portfolioWeightPct,
                    activeHoldingCount = accountHoldings.size,
                    valuedHoldingCount = accountHoldings.count { it.valuationStatus == HoldingValuationStatus.VALUED },
                    valuationIssueCount = accountHoldings.count { it.valuationIssue != null }
                )
            }
    }

    suspend fun overview(): PortfolioOverview {
        val snapshot = buildValuedSnapshot()
        val investedBookValuePln = snapshot.holdings.sumOf { it.costBasisPln }
        val investedCurrentValuePln = snapshot.holdings.sumOf { it.effectiveCurrentValuePln() }
        val equityBookValuePln = snapshot.holdings
            .filter { it.instrument.assetClass == AssetClass.EQUITIES }
            .sumOf { it.costBasisPln }
        val equityCurrentValuePln = snapshot.holdings
            .filter { it.instrument.assetClass == AssetClass.EQUITIES }
            .sumOf { it.effectiveCurrentValuePln() }
        val bondBookValuePln = snapshot.holdings
            .filter { it.instrument.assetClass == AssetClass.BONDS }
            .sumOf { it.costBasisPln }
        val bondCurrentValuePln = snapshot.holdings
            .filter { it.instrument.assetClass == AssetClass.BONDS }
            .sumOf { it.effectiveCurrentValuePln() }
        val cashBookValuePln = snapshot.cashBalancePln
        val totalBookValuePln = investedBookValuePln.add(cashBookValuePln, MONEY_CONTEXT)
        val totalCurrentValuePln = investedCurrentValuePln.add(cashBookValuePln, MONEY_CONTEXT)

        return PortfolioOverview(
            asOf = LocalDate.now(clock),
            valuationState = snapshot.valuationState,
            totalBookValuePln = totalBookValuePln.money(),
            totalCurrentValuePln = totalCurrentValuePln.money(),
            investedBookValuePln = investedBookValuePln.money(),
            investedCurrentValuePln = investedCurrentValuePln.money(),
            cashBalancePln = cashBookValuePln.money(),
            netContributionsPln = snapshot.netContributionsPln.money(),
            equityBookValuePln = equityBookValuePln.money(),
            equityCurrentValuePln = equityCurrentValuePln.money(),
            bondBookValuePln = bondBookValuePln.money(),
            bondCurrentValuePln = bondCurrentValuePln.money(),
            cashBookValuePln = cashBookValuePln.money(),
            cashCurrentValuePln = cashBookValuePln.money(),
            totalUnrealizedGainPln = totalCurrentValuePln.subtract(totalBookValuePln, MONEY_CONTEXT).money(),
            accountCount = snapshot.accounts.size,
            instrumentCount = snapshot.instruments.size,
            activeHoldingCount = snapshot.holdings.size,
            valuedHoldingCount = snapshot.holdings.count { it.valuationStatus == HoldingValuationStatus.VALUED },
            unvaluedHoldingCount = snapshot.holdings.count { it.valuationStatus != HoldingValuationStatus.VALUED },
            valuationIssueCount = snapshot.holdings.count { it.valuationIssue != null },
            missingFxTransactions = snapshot.missingFxTransactions,
            unsupportedCorrectionTransactions = snapshot.unsupportedCorrectionTransactions
        )
    }

    suspend fun holdings(): List<HoldingSnapshot> {
        val snapshot = buildValuedSnapshot()

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
                    currentPricePln = holding.currentPricePln?.money(),
                    currentValuePln = holding.currentValuePln?.money(),
                    unrealizedGainPln = holding.unrealizedGainPln?.money(),
                    valuedAt = holding.valuedAt,
                    valuationStatus = holding.valuationStatus,
                    valuationIssue = holding.valuationIssue,
                    transactionCount = holding.transactionCount
                )
            }
    }

    private suspend fun buildValuedSnapshot(): PortfolioValuationSnapshot {
        val ledgerSnapshot = buildLedgerSnapshot()
        val valuations = valueInstruments(
            ledgerSnapshot.holdings.map(MutableHolding::instrument).filter { it.kind != InstrumentKind.BOND_EDO }
        )
        val holdings = ledgerSnapshot.holdings.map { holding ->
            if (holding.instrument.kind == InstrumentKind.BOND_EDO) {
                valueEdoHolding(holding)
            } else {
                holding.toValuedHolding(valuations[holding.instrument.id])
            }
        }

        return PortfolioValuationSnapshot(
            accounts = ledgerSnapshot.accounts,
            instruments = ledgerSnapshot.instruments,
            holdings = holdings,
            cashBalancePln = ledgerSnapshot.cashBalancePln,
            cashBalanceByAccountPln = ledgerSnapshot.cashBalanceByAccountPln,
            netContributionsPln = ledgerSnapshot.netContributionsPln,
            netContributionsByAccountPln = ledgerSnapshot.netContributionsByAccountPln,
            missingFxTransactions = ledgerSnapshot.missingFxTransactions,
            unsupportedCorrectionTransactions = ledgerSnapshot.unsupportedCorrectionTransactions,
            valuationState = when {
                holdings.isEmpty() -> ValuationState.MARK_TO_MARKET
                holdings.all { it.valuationStatus == HoldingValuationStatus.VALUED } -> ValuationState.MARK_TO_MARKET
                holdings.none { it.valuationStatus == HoldingValuationStatus.VALUED } -> ValuationState.BOOK_ONLY
                else -> ValuationState.PARTIALLY_VALUED
            }
        )
    }

    private suspend fun valueInstruments(instruments: List<Instrument>): Map<UUID, InstrumentValuationResult> = coroutineScope {
        instruments
            .distinctBy { it.id }
            .map { instrument ->
                async { instrument.id to currentInstrumentValuationProvider.value(instrument) }
            }
            .awaitAll()
            .toMap()
    }

    private suspend fun buildLedgerSnapshot(): PortfolioLedgerSnapshot {
        val accounts = accountRepository.list()
        val instruments = instrumentRepository.list()
        val transactions = transactionRepository.list()
            .sortedWith(compareBy<Transaction>({ it.tradeDate }, { it.createdAt }))
        val fxLookups = transactionFxConversionService.loadLookups(transactions)

        val accountsById = accounts.associateBy(Account::id)
        val instrumentsById = instruments.associateBy(Instrument::id)
        val holdings = linkedMapOf<HoldingKey, MutableHolding>()
        val cashBalanceByAccountPln = accounts.associateBy(Account::id) { BigDecimal.ZERO }.toMutableMap()
        val netContributionsByAccountPln = accounts.associateBy(Account::id) { BigDecimal.ZERO }.toMutableMap()

        var cashBalancePln = BigDecimal.ZERO
        var netContributionsPln = BigDecimal.ZERO
        var missingFxTransactions = 0
        var unsupportedCorrectionTransactions = 0

        fun adjustCashBalance(accountId: UUID, deltaPln: BigDecimal) {
            cashBalancePln = cashBalancePln.add(deltaPln, MONEY_CONTEXT)
            cashBalanceByAccountPln[accountId] = cashBalanceByAccountPln
                .getOrDefault(accountId, BigDecimal.ZERO)
                .add(deltaPln, MONEY_CONTEXT)
        }

        fun adjustNetContributions(accountId: UUID, deltaPln: BigDecimal) {
            netContributionsPln = netContributionsPln.add(deltaPln, MONEY_CONTEXT)
            netContributionsByAccountPln[accountId] = netContributionsByAccountPln
                .getOrDefault(accountId, BigDecimal.ZERO)
                .add(deltaPln, MONEY_CONTEXT)
        }

        transactions.forEach { transaction ->
            val converted = fxLookups.convertedAmountsOrNull(transaction)
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
                    val buyQuantity = transaction.quantity ?: BigDecimal.ZERO
                    val buyCostBasis = converted.grossPln
                        .add(converted.feePln, MONEY_CONTEXT)
                        .add(converted.taxPln, MONEY_CONTEXT)
                    if (instrument.kind == InstrumentKind.BOND_EDO) {
                        holding.addEdoLot(
                            purchaseDate = transaction.tradeDate,
                            quantity = buyQuantity,
                            costBasisPln = buyCostBasis
                        )
                    } else {
                        holding.quantity = holding.quantity.add(buyQuantity, MONEY_CONTEXT)
                        holding.costBasisPln = holding.costBasisPln.add(buyCostBasis, MONEY_CONTEXT)
                    }
                    holding.transactionCount += 1

                    adjustCashBalance(
                        accountId = transaction.accountId,
                        deltaPln = converted.grossPln
                            .add(converted.feePln, MONEY_CONTEXT)
                            .add(converted.taxPln, MONEY_CONTEXT)
                            .negate()
                    )
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

                    adjustCashBalance(
                        accountId = transaction.accountId,
                        deltaPln = converted.grossPln
                            .subtract(converted.feePln, MONEY_CONTEXT)
                            .subtract(converted.taxPln, MONEY_CONTEXT)
                    )
                }

                TransactionType.REDEEM -> {
                    val instrument = instrumentsById[transaction.instrumentId] ?: return@forEach
                    val account = accountsById[transaction.accountId] ?: return@forEach
                    val key = HoldingKey(account.id, instrument.id)
                    val holding = holdings.getOrPut(key) {
                        MutableHolding(account = account, instrument = instrument)
                    }
                    val redeemedQuantity = transaction.quantity ?: BigDecimal.ZERO

                    if (holding.quantity.signum() > 0 && redeemedQuantity.signum() > 0) {
                        holding.reduceEdoLotsFifo(redeemedQuantity)
                    }
                    holding.transactionCount += 1

                    adjustCashBalance(
                        accountId = transaction.accountId,
                        deltaPln = converted.grossPln
                            .subtract(converted.feePln, MONEY_CONTEXT)
                            .subtract(converted.taxPln, MONEY_CONTEXT)
                    )
                }

                TransactionType.DEPOSIT -> {
                    adjustCashBalance(transaction.accountId, converted.grossPln)
                    adjustNetContributions(transaction.accountId, converted.grossPln)
                }

                TransactionType.WITHDRAWAL -> {
                    adjustCashBalance(transaction.accountId, converted.grossPln.negate())
                    adjustNetContributions(transaction.accountId, converted.grossPln.negate())
                }

                TransactionType.FEE,
                TransactionType.TAX -> {
                    adjustCashBalance(transaction.accountId, converted.grossPln.negate())
                }

                TransactionType.INTEREST -> {
                    adjustCashBalance(transaction.accountId, converted.grossPln)
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
            cashBalanceByAccountPln = cashBalanceByAccountPln.toMap(),
            netContributionsPln = netContributionsPln,
            netContributionsByAccountPln = netContributionsByAccountPln.toMap(),
            missingFxTransactions = missingFxTransactions,
            unsupportedCorrectionTransactions = unsupportedCorrectionTransactions
        )
    }

    private suspend fun valueEdoHolding(holding: MutableHolding): ValuedHolding {
        val terms = holding.instrument.edoTerms
            ?: return ValuedHolding(
                account = holding.account,
                instrument = holding.instrument,
                quantity = holding.quantity,
                costBasisPln = holding.costBasisPln,
                currentPricePln = null,
                currentValuePln = null,
                unrealizedGainPln = null,
                valuedAt = null,
                valuationStatus = HoldingValuationStatus.UNSUPPORTED,
                valuationIssue = "EDO instrument does not define series terms.",
                transactionCount = holding.transactionCount
            )
        val activeLots = holding.edoLots.filter { it.quantity.signum() > 0 }
        if (activeLots.isEmpty()) {
            return ValuedHolding(
                account = holding.account,
                instrument = holding.instrument,
                quantity = holding.quantity,
                costBasisPln = holding.costBasisPln,
                currentPricePln = null,
                currentValuePln = null,
                unrealizedGainPln = null,
                valuedAt = null,
                valuationStatus = HoldingValuationStatus.UNAVAILABLE,
                valuationIssue = "EDO holding does not define active purchase lots.",
                transactionCount = holding.transactionCount
            )
        }

        val lotsByPurchaseDate = activeLots.groupBy(EdoHoldingLot::purchaseDate)
            .mapValues { (_, lots) ->
                AggregatedEdoLot(
                    purchaseDate = lots.first().purchaseDate,
                    quantity = lots.fold(BigDecimal.ZERO) { total, lot -> total.add(lot.quantity, MONEY_CONTEXT) },
                    costBasisPln = lots.fold(BigDecimal.ZERO) { total, lot -> total.add(lot.costBasisPln, MONEY_CONTEXT) }
                )
            }
            .values
            .sortedBy(AggregatedEdoLot::purchaseDate)

        val results = coroutineScope {
            lotsByPurchaseDate.map { lot ->
                async { lot to edoLotValuationProvider.value(terms.toLotTerms(lot.purchaseDate)) }
            }.awaitAll()
        }
        val failure = results.firstNotNullOfOrNull { (lot, result) ->
            (result as? InstrumentValuationResult.Failure)?.let { lot to it }
        }
        if (failure != null) {
            val (lot, result) = failure
            return ValuedHolding(
                account = holding.account,
                instrument = holding.instrument,
                quantity = holding.quantity,
                costBasisPln = holding.costBasisPln,
                currentPricePln = null,
                currentValuePln = null,
                unrealizedGainPln = null,
                valuedAt = null,
                valuationStatus = result.type.toHoldingValuationStatus(),
                valuationIssue = "EDO lot ${lot.purchaseDate}: ${result.reason}",
                transactionCount = holding.transactionCount
            )
        }

        val successfulResults = results.map { (lot, result) -> lot to (result as InstrumentValuationResult.Success).valuation }
        val currentValuePln = successfulResults.fold(BigDecimal.ZERO) { total, (lot, valuation) ->
            total.add(valuation.pricePerUnitPln.multiply(lot.quantity, MONEY_CONTEXT), MONEY_CONTEXT)
        }.money()
        val currentPricePln = if (holding.quantity.signum() == 0) {
            BigDecimal.ZERO
        } else {
            currentValuePln.divide(holding.quantity, 8, RoundingMode.HALF_UP)
        }.money()
        val valuedAt = successfulResults.maxOfOrNull { (_, valuation) -> valuation.valuedAt }

        return ValuedHolding(
            account = holding.account,
            instrument = holding.instrument,
            quantity = holding.quantity,
            costBasisPln = holding.costBasisPln,
            currentPricePln = currentPricePln,
            currentValuePln = currentValuePln,
            unrealizedGainPln = currentValuePln.subtract(holding.costBasisPln, MONEY_CONTEXT).money(),
            valuedAt = valuedAt,
            valuationStatus = HoldingValuationStatus.VALUED,
            valuationIssue = null,
            transactionCount = holding.transactionCount
        )
    }

    private fun MutableHolding.toValuedHolding(valuation: InstrumentValuationResult?): ValuedHolding = when (valuation) {
        is InstrumentValuationResult.Success -> toValuedHolding(valuation.valuation)
        is InstrumentValuationResult.Failure -> ValuedHolding(
            account = account,
            instrument = instrument,
            quantity = quantity,
            costBasisPln = costBasisPln,
            currentPricePln = null,
            currentValuePln = null,
            unrealizedGainPln = null,
            valuedAt = null,
            valuationStatus = valuation.type.toHoldingValuationStatus(),
            valuationIssue = valuation.reason,
            transactionCount = transactionCount
        )

        null -> ValuedHolding(
            account = account,
            instrument = instrument,
            quantity = quantity,
            costBasisPln = costBasisPln,
            currentPricePln = null,
            currentValuePln = null,
            unrealizedGainPln = null,
            valuedAt = null,
            valuationStatus = HoldingValuationStatus.UNAVAILABLE,
            valuationIssue = "Instrument valuation was not attempted.",
            transactionCount = transactionCount
        )
    }

    private fun MutableHolding.toValuedHolding(valuation: InstrumentValuation): ValuedHolding {
        val currentValuePln = valuation.pricePerUnitPln.multiply(quantity, MONEY_CONTEXT).money()
        return ValuedHolding(
            account = account,
            instrument = instrument,
            quantity = quantity,
            costBasisPln = costBasisPln,
            currentPricePln = valuation.pricePerUnitPln.money(),
            currentValuePln = currentValuePln,
            unrealizedGainPln = currentValuePln.subtract(costBasisPln, MONEY_CONTEXT).money(),
            valuedAt = valuation.valuedAt,
            valuationStatus = HoldingValuationStatus.VALUED,
            valuationIssue = null,
            transactionCount = transactionCount
        )
    }

    private fun MutableHolding.addEdoLot(
        purchaseDate: LocalDate,
        quantity: BigDecimal,
        costBasisPln: BigDecimal
    ) {
        if (quantity.signum() <= 0) {
            return
        }
        edoLots += EdoHoldingLot(
            purchaseDate = purchaseDate,
            quantity = quantity,
            costBasisPln = costBasisPln
        )
        syncFromEdoLots()
    }

    private fun MutableHolding.reduceEdoLotsFifo(sellQuantity: BigDecimal) {
        if (sellQuantity.signum() <= 0) {
            return
        }
        var remaining = sellQuantity
        val iterator = edoLots.iterator()
        while (iterator.hasNext() && remaining.signum() > 0) {
            val lot = iterator.next()
            if (lot.quantity.signum() <= 0) {
                iterator.remove()
                continue
            }
            val consumed = remaining.min(lot.quantity)
            val reducedCostBasis = if (consumed >= lot.quantity) {
                lot.costBasisPln
            } else {
                lot.costBasisPln
                    .divide(lot.quantity, 12, RoundingMode.HALF_UP)
                    .multiply(consumed, MONEY_CONTEXT)
            }
            lot.quantity = lot.quantity.subtract(consumed, MONEY_CONTEXT).max(BigDecimal.ZERO)
            lot.costBasisPln = lot.costBasisPln.subtract(reducedCostBasis, MONEY_CONTEXT).max(BigDecimal.ZERO)
            if (lot.quantity.signum() == 0) {
                iterator.remove()
            }
            remaining = remaining.subtract(consumed, MONEY_CONTEXT).max(BigDecimal.ZERO)
        }
        syncFromEdoLots()
    }

    private fun MutableHolding.syncFromEdoLots() {
        quantity = edoLots.fold(BigDecimal.ZERO) { total, lot -> total.add(lot.quantity, MONEY_CONTEXT) }
        costBasisPln = edoLots.fold(BigDecimal.ZERO) { total, lot -> total.add(lot.costBasisPln, MONEY_CONTEXT) }
    }

    private fun BigDecimal.money(): BigDecimal = setScale(2, RoundingMode.HALF_UP)

    private fun BigDecimal.quantity(): BigDecimal = setScale(8, RoundingMode.HALF_UP).stripTrailingZeros()

    private fun InstrumentValuationFailureType.toHoldingValuationStatus(): HoldingValuationStatus = when (this) {
        InstrumentValuationFailureType.UNAVAILABLE -> HoldingValuationStatus.UNAVAILABLE
        InstrumentValuationFailureType.UNSUPPORTED -> HoldingValuationStatus.UNSUPPORTED
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
        val edoLots: MutableList<EdoHoldingLot> = mutableListOf(),
        var transactionCount: Int = 0
    )

    private data class EdoHoldingLot(
        val purchaseDate: LocalDate,
        var quantity: BigDecimal,
        var costBasisPln: BigDecimal
    )

    private data class AggregatedEdoLot(
        val purchaseDate: LocalDate,
        val quantity: BigDecimal,
        val costBasisPln: BigDecimal
    )

    private data class ValuedHolding(
        val account: Account,
        val instrument: Instrument,
        val quantity: BigDecimal,
        val costBasisPln: BigDecimal,
        val currentPricePln: BigDecimal?,
        val currentValuePln: BigDecimal?,
        val unrealizedGainPln: BigDecimal?,
        val valuedAt: LocalDate?,
        val valuationStatus: HoldingValuationStatus,
        val valuationIssue: String?,
        val transactionCount: Int
    ) {
        fun effectiveCurrentValuePln(): BigDecimal = currentValuePln ?: costBasisPln
    }

    private data class PortfolioLedgerSnapshot(
        val accounts: List<Account>,
        val instruments: List<Instrument>,
        val holdings: List<MutableHolding>,
        val cashBalancePln: BigDecimal,
        val cashBalanceByAccountPln: Map<UUID, BigDecimal>,
        val netContributionsPln: BigDecimal,
        val netContributionsByAccountPln: Map<UUID, BigDecimal>,
        val missingFxTransactions: Int,
        val unsupportedCorrectionTransactions: Int
    )

    private data class PortfolioValuationSnapshot(
        val accounts: List<Account>,
        val instruments: List<Instrument>,
        val holdings: List<ValuedHolding>,
        val cashBalancePln: BigDecimal,
        val cashBalanceByAccountPln: Map<UUID, BigDecimal>,
        val netContributionsPln: BigDecimal,
        val netContributionsByAccountPln: Map<UUID, BigDecimal>,
        val missingFxTransactions: Int,
        val unsupportedCorrectionTransactions: Int,
        val valuationState: ValuationState
    )

    private companion object {
        val MONEY_CONTEXT: MathContext = MathContext.DECIMAL64
    }
}

data class PortfolioOverview(
    val asOf: LocalDate,
    val valuationState: ValuationState,
    val totalBookValuePln: BigDecimal,
    val totalCurrentValuePln: BigDecimal,
    val investedBookValuePln: BigDecimal,
    val investedCurrentValuePln: BigDecimal,
    val cashBalancePln: BigDecimal,
    val netContributionsPln: BigDecimal,
    val equityBookValuePln: BigDecimal,
    val equityCurrentValuePln: BigDecimal,
    val bondBookValuePln: BigDecimal,
    val bondCurrentValuePln: BigDecimal,
    val cashBookValuePln: BigDecimal,
    val cashCurrentValuePln: BigDecimal,
    val totalUnrealizedGainPln: BigDecimal,
    val accountCount: Int,
    val instrumentCount: Int,
    val activeHoldingCount: Int,
    val valuedHoldingCount: Int,
    val unvaluedHoldingCount: Int,
    val valuationIssueCount: Int,
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
    val currentPricePln: BigDecimal?,
    val currentValuePln: BigDecimal?,
    val unrealizedGainPln: BigDecimal?,
    val valuedAt: LocalDate?,
    val valuationStatus: HoldingValuationStatus,
    val valuationIssue: String?,
    val transactionCount: Int
)

data class PortfolioAccountSummary(
    val accountId: UUID,
    val accountName: String,
    val institution: String,
    val type: String,
    val baseCurrency: String,
    val displayOrder: Int,
    val valuationState: ValuationState,
    val totalBookValuePln: BigDecimal,
    val totalCurrentValuePln: BigDecimal,
    val investedBookValuePln: BigDecimal,
    val investedCurrentValuePln: BigDecimal,
    val cashBalancePln: BigDecimal,
    val netContributionsPln: BigDecimal,
    val totalUnrealizedGainPln: BigDecimal,
    val portfolioWeightPct: BigDecimal,
    val activeHoldingCount: Int,
    val valuedHoldingCount: Int,
    val valuationIssueCount: Int
)

enum class ValuationState {
    BOOK_ONLY,
    PARTIALLY_VALUED,
    MARK_TO_MARKET
}

enum class HoldingValuationStatus {
    VALUED,
    UNAVAILABLE,
    UNSUPPORTED
}
