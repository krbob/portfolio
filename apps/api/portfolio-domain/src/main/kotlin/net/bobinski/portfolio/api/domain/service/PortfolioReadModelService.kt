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
    private val clock: Clock,
    private val marketDataStaleAfterDays: Long = 3
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
                val cashBalances = snapshot.cashBalancesByAccount[account.id].orEmpty()
                val netContributionBalances = snapshot.netContributionBalancesByAccount[account.id].orEmpty()
                val totalBookValuePln = investedBookValuePln.add(cashBalancePln, MONEY_CONTEXT)
                val totalCurrentValuePln = investedCurrentValuePln.add(cashBalancePln, MONEY_CONTEXT)
                val valuationState = accountHoldings.toValuationState()
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
                    cashBalances = cashBalances,
                    netContributionsPln = netContributionsPln.money(),
                    netContributionBalances = netContributionBalances,
                    totalUnrealizedGainPln = totalCurrentValuePln.subtract(totalBookValuePln, MONEY_CONTEXT).money(),
                    portfolioWeightPct = portfolioWeightPct,
                    activeHoldingCount = accountHoldings.size,
                    valuedHoldingCount = accountHoldings.count { it.valuationStatus.isMarketValued() },
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
            cashBalances = snapshot.cashBalances,
            netContributionsPln = snapshot.netContributionsPln.money(),
            netContributionBalances = snapshot.netContributionBalances,
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
            valuedHoldingCount = snapshot.holdings.count { it.valuationStatus.isMarketValued() },
            unvaluedHoldingCount = snapshot.holdings.count { !it.valuationStatus.isMarketValued() },
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
                    transactionCount = holding.transactionCount,
                    edoLots = holding.edoLots
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
            cashBalances = ledgerSnapshot.cashBalances,
            cashBalancesByAccount = ledgerSnapshot.cashBalancesByAccount,
            netContributionsPln = ledgerSnapshot.netContributionsPln,
            netContributionsByAccountPln = ledgerSnapshot.netContributionsByAccountPln,
            netContributionBalances = ledgerSnapshot.netContributionBalances,
            netContributionBalancesByAccount = ledgerSnapshot.netContributionBalancesByAccount,
            missingFxTransactions = ledgerSnapshot.missingFxTransactions,
            unsupportedCorrectionTransactions = ledgerSnapshot.unsupportedCorrectionTransactions,
            valuationState = holdings.toValuationState()
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
        val cashBalancesByAccount = accounts.associate { it.id to linkedMapOf<String, CurrencyBreakdownAccumulator>() }.toMutableMap()
        val netContributionBalancesByAccount = accounts.associate { it.id to linkedMapOf<String, CurrencyBreakdownAccumulator>() }.toMutableMap()
        val cashBalances = linkedMapOf<String, CurrencyBreakdownAccumulator>()
        val netContributionBalances = linkedMapOf<String, CurrencyBreakdownAccumulator>()

        var cashBalancePln = BigDecimal.ZERO
        var netContributionsPln = BigDecimal.ZERO
        var missingFxTransactions = 0
        var unsupportedCorrectionTransactions = 0

        fun adjustCashBalance(accountId: UUID, currency: String, deltaAmount: BigDecimal, deltaPln: BigDecimal) {
            cashBalancePln = cashBalancePln.add(deltaPln, MONEY_CONTEXT)
            cashBalanceByAccountPln[accountId] = cashBalanceByAccountPln
                .getOrDefault(accountId, BigDecimal.ZERO)
                .add(deltaPln, MONEY_CONTEXT)
            cashBalances.adjust(currency, deltaAmount, deltaPln)
            cashBalancesByAccount
                .getOrPut(accountId) { linkedMapOf() }
                .adjust(currency, deltaAmount, deltaPln)
        }

        fun adjustNetContributions(accountId: UUID, currency: String, deltaAmount: BigDecimal, deltaPln: BigDecimal) {
            netContributionsPln = netContributionsPln.add(deltaPln, MONEY_CONTEXT)
            netContributionsByAccountPln[accountId] = netContributionsByAccountPln
                .getOrDefault(accountId, BigDecimal.ZERO)
                .add(deltaPln, MONEY_CONTEXT)
            netContributionBalances.adjust(currency, deltaAmount, deltaPln)
            netContributionBalancesByAccount
                .getOrPut(accountId) { linkedMapOf() }
                .adjust(currency, deltaAmount, deltaPln)
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
                        currency = transaction.currency,
                        deltaAmount = transaction.grossAmount
                            .add(transaction.feeAmount, MONEY_CONTEXT)
                            .add(transaction.taxAmount, MONEY_CONTEXT)
                            .negate(),
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
                        currency = transaction.currency,
                        deltaAmount = transaction.grossAmount
                            .subtract(transaction.feeAmount, MONEY_CONTEXT)
                            .subtract(transaction.taxAmount, MONEY_CONTEXT),
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
                        currency = transaction.currency,
                        deltaAmount = transaction.grossAmount
                            .subtract(transaction.feeAmount, MONEY_CONTEXT)
                            .subtract(transaction.taxAmount, MONEY_CONTEXT),
                        deltaPln = converted.grossPln
                            .subtract(converted.feePln, MONEY_CONTEXT)
                            .subtract(converted.taxPln, MONEY_CONTEXT)
                    )
                }

                TransactionType.DEPOSIT -> {
                    adjustCashBalance(transaction.accountId, transaction.currency, transaction.grossAmount, converted.grossPln)
                    adjustNetContributions(transaction.accountId, transaction.currency, transaction.grossAmount, converted.grossPln)
                }

                TransactionType.WITHDRAWAL -> {
                    adjustCashBalance(
                        transaction.accountId,
                        transaction.currency,
                        transaction.grossAmount.negate(),
                        converted.grossPln.negate()
                    )
                    adjustNetContributions(
                        transaction.accountId,
                        transaction.currency,
                        transaction.grossAmount.negate(),
                        converted.grossPln.negate()
                    )
                }

                TransactionType.FEE,
                TransactionType.TAX -> {
                    adjustCashBalance(
                        transaction.accountId,
                        transaction.currency,
                        transaction.grossAmount.negate(),
                        converted.grossPln.negate()
                    )
                }

                TransactionType.INTEREST -> {
                    adjustCashBalance(transaction.accountId, transaction.currency, transaction.grossAmount, converted.grossPln)
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
            cashBalances = cashBalances.toCurrencyBreakdown(),
            cashBalancesByAccount = cashBalancesByAccount.mapValues { (_, balances) -> balances.toCurrencyBreakdown() },
            netContributionsPln = netContributionsPln,
            netContributionsByAccountPln = netContributionsByAccountPln.toMap(),
            netContributionBalances = netContributionBalances.toCurrencyBreakdown(),
            netContributionBalancesByAccount = netContributionBalancesByAccount.mapValues { (_, balances) -> balances.toCurrencyBreakdown() },
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
                transactionCount = holding.transactionCount,
                edoLots = lotsByPurchaseDate.map { aggregatedLot ->
                    EdoLotSnapshot(
                        purchaseDate = aggregatedLot.purchaseDate,
                        quantity = aggregatedLot.quantity.quantity(),
                        costBasisPln = aggregatedLot.costBasisPln.money(),
                        currentPricePln = null,
                        currentValuePln = null,
                        unrealizedGainPln = null,
                        valuedAt = null,
                        valuationStatus = if (aggregatedLot.purchaseDate == lot.purchaseDate) {
                            result.type.toHoldingValuationStatus()
                        } else {
                            HoldingValuationStatus.UNAVAILABLE
                        },
                        valuationIssue = if (aggregatedLot.purchaseDate == lot.purchaseDate) {
                            result.reason
                        } else {
                            "EDO lot valuation unavailable."
                        }
                    )
                }
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
        val valuationStatus = if (successfulResults.any { (_, valuation) -> isStale(valuation.valuedAt) }) {
            HoldingValuationStatus.STALE
        } else {
            HoldingValuationStatus.VALUED
        }

        return ValuedHolding(
            account = holding.account,
            instrument = holding.instrument,
            quantity = holding.quantity,
            costBasisPln = holding.costBasisPln,
            currentPricePln = currentPricePln,
            currentValuePln = currentValuePln,
            unrealizedGainPln = currentValuePln.subtract(holding.costBasisPln, MONEY_CONTEXT).money(),
            valuedAt = valuedAt,
            valuationStatus = valuationStatus,
            valuationIssue = valuedAt?.takeIf(::isStale)?.let(::staleValuationIssue),
            transactionCount = holding.transactionCount,
            edoLots = successfulResults.map { (lot, valuation) ->
                val lotCurrentValue = valuation.pricePerUnitPln.multiply(lot.quantity, MONEY_CONTEXT).money()
                val lotStatus = valuationStatusFor(valuation)
                EdoLotSnapshot(
                    purchaseDate = lot.purchaseDate,
                    quantity = lot.quantity.quantity(),
                    costBasisPln = lot.costBasisPln.money(),
                    currentPricePln = valuation.pricePerUnitPln.money(),
                    currentValuePln = lotCurrentValue,
                    unrealizedGainPln = lotCurrentValue.subtract(lot.costBasisPln, MONEY_CONTEXT).money(),
                    valuedAt = valuation.valuedAt,
                    valuationStatus = lotStatus,
                    valuationIssue = valuation.valuedAt.takeIf(::isStale)?.let(::staleValuationIssue)
                )
            }
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
        val valuationStatus = valuationStatusFor(valuation)
        return ValuedHolding(
            account = account,
            instrument = instrument,
            quantity = quantity,
            costBasisPln = costBasisPln,
            currentPricePln = valuation.pricePerUnitPln.money(),
            currentValuePln = currentValuePln,
            unrealizedGainPln = currentValuePln.subtract(costBasisPln, MONEY_CONTEXT).money(),
            valuedAt = valuation.valuedAt,
            valuationStatus = valuationStatus,
            valuationIssue = valuation.valuedAt.takeIf(::isStale)?.let(::staleValuationIssue),
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

    private fun MutableMap<String, CurrencyBreakdownAccumulator>.adjust(
        currency: String,
        deltaAmount: BigDecimal,
        deltaBookValuePln: BigDecimal
    ) {
        if (deltaAmount.signum() == 0 && deltaBookValuePln.signum() == 0) {
            return
        }
        val normalizedCurrency = currency.uppercase()
        val accumulator = getOrPut(normalizedCurrency) { CurrencyBreakdownAccumulator() }
        accumulator.amount = accumulator.amount.add(deltaAmount, MONEY_CONTEXT)
        accumulator.bookValuePln = accumulator.bookValuePln.add(deltaBookValuePln, MONEY_CONTEXT)
        if (accumulator.amount.signum() == 0 && accumulator.bookValuePln.signum() == 0) {
            remove(normalizedCurrency)
        }
    }

    private fun Map<String, CurrencyBreakdownAccumulator>.toCurrencyBreakdown(): List<CurrencyAmountSnapshot> =
        entries
            .map { (currency, accumulator) ->
                CurrencyAmountSnapshot(
                    currency = currency,
                    amount = accumulator.amount.quantity(),
                    bookValuePln = accumulator.bookValuePln.money()
                )
            }
            .sortedWith(
                compareByDescending<CurrencyAmountSnapshot> { it.bookValuePln.abs() }
                    .thenBy { it.currency }
            )

    private fun List<ValuedHolding>.toValuationState(): ValuationState {
        if (isEmpty()) {
            return ValuationState.MARK_TO_MARKET
        }
        val marketValuedCount = count { it.valuationStatus.isMarketValued() }
        if (marketValuedCount == 0) {
            return ValuationState.BOOK_ONLY
        }
        if (marketValuedCount != size) {
            return ValuationState.PARTIALLY_VALUED
        }
        return if (any { it.valuationStatus == HoldingValuationStatus.STALE }) {
            ValuationState.STALE
        } else {
            ValuationState.MARK_TO_MARKET
        }
    }

    private fun HoldingValuationStatus.isMarketValued(): Boolean = when (this) {
        HoldingValuationStatus.VALUED,
        HoldingValuationStatus.STALE -> true

        HoldingValuationStatus.UNAVAILABLE,
        HoldingValuationStatus.UNSUPPORTED -> false
    }

    private fun valuationStatusFor(valuation: InstrumentValuation): HoldingValuationStatus =
        if (isStale(valuation.valuedAt)) HoldingValuationStatus.STALE else HoldingValuationStatus.VALUED

    private fun isStale(valuedAt: LocalDate): Boolean =
        valuedAt.isBefore(LocalDate.now(clock).minusDays(marketDataStaleAfterDays))

    private fun staleValuationIssue(valuedAt: LocalDate): String =
        "Last market valuation is from $valuedAt."

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
        val transactionCount: Int,
        val edoLots: List<EdoLotSnapshot> = emptyList()
    ) {
        fun effectiveCurrentValuePln(): BigDecimal = currentValuePln ?: costBasisPln
    }

    private data class PortfolioLedgerSnapshot(
        val accounts: List<Account>,
        val instruments: List<Instrument>,
        val holdings: List<MutableHolding>,
        val cashBalancePln: BigDecimal,
        val cashBalanceByAccountPln: Map<UUID, BigDecimal>,
        val cashBalances: List<CurrencyAmountSnapshot>,
        val cashBalancesByAccount: Map<UUID, List<CurrencyAmountSnapshot>>,
        val netContributionsPln: BigDecimal,
        val netContributionsByAccountPln: Map<UUID, BigDecimal>,
        val netContributionBalances: List<CurrencyAmountSnapshot>,
        val netContributionBalancesByAccount: Map<UUID, List<CurrencyAmountSnapshot>>,
        val missingFxTransactions: Int,
        val unsupportedCorrectionTransactions: Int
    )

    private data class PortfolioValuationSnapshot(
        val accounts: List<Account>,
        val instruments: List<Instrument>,
        val holdings: List<ValuedHolding>,
        val cashBalancePln: BigDecimal,
        val cashBalanceByAccountPln: Map<UUID, BigDecimal>,
        val cashBalances: List<CurrencyAmountSnapshot>,
        val cashBalancesByAccount: Map<UUID, List<CurrencyAmountSnapshot>>,
        val netContributionsPln: BigDecimal,
        val netContributionsByAccountPln: Map<UUID, BigDecimal>,
        val netContributionBalances: List<CurrencyAmountSnapshot>,
        val netContributionBalancesByAccount: Map<UUID, List<CurrencyAmountSnapshot>>,
        val missingFxTransactions: Int,
        val unsupportedCorrectionTransactions: Int,
        val valuationState: ValuationState
    )

    private data class CurrencyBreakdownAccumulator(
        var amount: BigDecimal = BigDecimal.ZERO,
        var bookValuePln: BigDecimal = BigDecimal.ZERO
    )

    private companion object {
        val MONEY_CONTEXT: MathContext = MathContext.DECIMAL64
    }
}

data class CurrencyAmountSnapshot(
    val currency: String,
    val amount: BigDecimal,
    val bookValuePln: BigDecimal
)

data class PortfolioOverview(
    val asOf: LocalDate,
    val valuationState: ValuationState,
    val totalBookValuePln: BigDecimal,
    val totalCurrentValuePln: BigDecimal,
    val investedBookValuePln: BigDecimal,
    val investedCurrentValuePln: BigDecimal,
    val cashBalancePln: BigDecimal,
    val cashBalances: List<CurrencyAmountSnapshot> = emptyList(),
    val netContributionsPln: BigDecimal,
    val netContributionBalances: List<CurrencyAmountSnapshot> = emptyList(),
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
    val transactionCount: Int,
    val edoLots: List<EdoLotSnapshot> = emptyList()
)

data class EdoLotSnapshot(
    val purchaseDate: LocalDate,
    val quantity: BigDecimal,
    val costBasisPln: BigDecimal,
    val currentPricePln: BigDecimal?,
    val currentValuePln: BigDecimal?,
    val unrealizedGainPln: BigDecimal?,
    val valuedAt: LocalDate?,
    val valuationStatus: HoldingValuationStatus,
    val valuationIssue: String?
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
    val cashBalances: List<CurrencyAmountSnapshot> = emptyList(),
    val netContributionsPln: BigDecimal,
    val netContributionBalances: List<CurrencyAmountSnapshot> = emptyList(),
    val totalUnrealizedGainPln: BigDecimal,
    val portfolioWeightPct: BigDecimal,
    val activeHoldingCount: Int,
    val valuedHoldingCount: Int,
    val valuationIssueCount: Int
)

enum class ValuationState {
    BOOK_ONLY,
    STALE,
    PARTIALLY_VALUED,
    MARK_TO_MARKET
}

enum class HoldingValuationStatus {
    VALUED,
    STALE,
    UNAVAILABLE,
    UNSUPPORTED
}
