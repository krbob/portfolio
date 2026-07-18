package net.bobinski.portfolio.api.domain.service

import java.math.BigDecimal
import java.math.RoundingMode
import java.util.UUID
import kotlinx.serialization.Serializable
import net.bobinski.portfolio.api.domain.model.AssetClass
import net.bobinski.portfolio.api.domain.model.PortfolioTarget

/**
 * Calculates a read-only withdrawal preview from already-built portfolio read models.
 *
 * The result is deliberately not a transaction draft: it does not mutate the journal and it
 * treats the configured tax buffer as a user-supplied estimate rather than a tax calculation.
 */
class PortfolioWithdrawalPlanningService {
    fun plan(
        command: PortfolioWithdrawalPlanCommand,
        overview: PortfolioOverview,
        accounts: List<PortfolioAccountSummary>,
        holdings: List<HoldingSnapshot>,
        targets: List<PortfolioTarget>,
        settings: WithdrawalPlanningSettings
    ): PortfolioWithdrawalPlan {
        val requestedWithdrawal = command.resolveAmount(overview.totalCurrentValuePln)
        val accountsById = accounts.associateBy(PortfolioAccountSummary::accountId)
        validateAccountRules(settings, accountsById)
        val targetsByAssetClass = targets.associateBy(PortfolioTarget::assetClass)
        val currentValues = overview.currentValues()
        val warnings = linkedSetOf<WithdrawalPlanWarning>()
        addValuationWarnings(overview, holdings, accounts, targets, settings, warnings)
        val calculation = calculateWithdrawal(
            requestedWithdrawal = requestedWithdrawal,
            overview = overview,
            accountsById = accountsById,
            holdingsByAccountAndClass = holdings.byAccountAndClass(),
            targetsByAssetClass = targetsByAssetClass,
            settings = settings,
            currentValues = currentValues
        )
        val shortfall = calculation.remainingWithdrawalPln.money()
        val plannedWithdrawal = requestedWithdrawal.subtract(shortfall).money()
        if (shortfall > BigDecimal.ZERO) {
            warnings += WithdrawalPlanWarning.INSUFFICIENT_LIQUIDITY
        }
        val projectedCash = overview.cashCurrentValuePln
            .add(calculation.grossSalesPln)
            .subtract(calculation.taxBufferPln)
            .subtract(plannedWithdrawal)
            .money()
        val projectedValues = linkedMapOf(
            AssetClass.EQUITIES to calculation.remainingValues.getValue(AssetClass.EQUITIES),
            AssetClass.BONDS to calculation.remainingValues.getValue(AssetClass.BONDS),
            AssetClass.CASH to projectedCash
        )
        val projectedTotal = projectedValues.values.sumMoney()

        return PortfolioWithdrawalPlan(
            asOf = overview.asOf,
            valuationState = overview.valuationState,
            requestedAmountPln = command.amountPln?.money(),
            requestedPortfolioPercentagePct = command.portfolioPercentagePct?.percentage(),
            requestedWithdrawalPln = requestedWithdrawal,
            plannedWithdrawalPln = plannedWithdrawal,
            feasible = shortfall.signum() == 0,
            shortfallPln = shortfall,
            cashUsedPln = calculation.cashUsedPln,
            grossSalesPln = calculation.grossSalesPln,
            estimatedTaxBufferPln = calculation.taxBufferPln,
            projectedTotalValuePln = projectedTotal,
            accountPlans = calculation.accountPlans,
            buckets = buildBuckets(currentValues, calculation.plannedSales, projectedValues, projectedTotal, targetsByAssetClass),
            warnings = warnings.toList()
        )
    }

    private fun calculateWithdrawal(
        requestedWithdrawal: BigDecimal,
        overview: PortfolioOverview,
        accountsById: Map<UUID, PortfolioAccountSummary>,
        holdingsByAccountAndClass: Map<Pair<UUID, AssetClass>, BigDecimal>,
        targetsByAssetClass: Map<AssetClass, PortfolioTarget>,
        settings: WithdrawalPlanningSettings,
        currentValues: Map<AssetClass, BigDecimal>
    ): WithdrawalCalculation {
        val state = WithdrawalCalculation(
            remainingWithdrawalPln = requestedWithdrawal,
            remainingValues = currentValues.toMutableMap(),
            plannedSales = PLANNABLE_ASSET_CLASSES.associateWith { BigDecimal.ZERO.money() }.toMutableMap()
        )
        val targetProjectedTotal = overview.totalCurrentValuePln.subtract(requestedWithdrawal).max(BigDecimal.ZERO).money()
        for (rule in settings.accountRules.filter(WithdrawalPlanningAccountRule::enabled)) {
            if (state.remainingWithdrawalPln.signum() == 0) break
            val step = planAccount(
                rule = rule,
                account = accountsById.getValue(rule.accountId),
                remainingWithdrawal = state.remainingWithdrawalPln,
                holdingsByAccountAndClass = holdingsByAccountAndClass,
                remainingValues = state.remainingValues,
                targetsByAssetClass = targetsByAssetClass,
                targetProjectedTotal = targetProjectedTotal
            )
            state.apply(step)
        }
        return state
    }

    private fun planAccount(
        rule: WithdrawalPlanningAccountRule,
        account: PortfolioAccountSummary,
        remainingWithdrawal: BigDecimal,
        holdingsByAccountAndClass: Map<Pair<UUID, AssetClass>, BigDecimal>,
        remainingValues: Map<AssetClass, BigDecimal>,
        targetsByAssetClass: Map<AssetClass, PortfolioTarget>,
        targetProjectedTotal: BigDecimal
    ): AccountWithdrawalStep {
        val taxRate = rule.taxBufferRatePct.normalizedTaxRate()
        val positiveCash = account.cashBalancePln.max(BigDecimal.ZERO).money()
        val cashDeficit = account.cashBalancePln.negate().max(BigDecimal.ZERO).money()
        val cashUsed = positiveCash.min(remainingWithdrawal).money()
        val remainingAfterCash = remainingWithdrawal.subtract(cashUsed).max(BigDecimal.ZERO).money()
        val availableByClass = PLANNABLE_ASSET_CLASSES.associateWith { assetClass ->
            holdingsByAccountAndClass[account.accountId to assetClass]?.max(BigDecimal.ZERO)?.money()
                ?: BigDecimal.ZERO.money()
        }
        val grossSale = grossSaleNeeded(cashDeficit.add(remainingAfterCash).money(), taxRate)
            .min(availableByClass.values.sumMoney())
            .money()
        val salesByClass = allocateSales(
            amountPln = grossSale,
            availableByClass = availableByClass,
            remainingPortfolioValues = remainingValues,
            targetsByAssetClass = targetsByAssetClass,
            targetProjectedTotal = targetProjectedTotal
        )
        val taxBuffer = grossSale.multiply(taxRate).divide(HUNDRED, 2, RoundingMode.HALF_UP).money()
        val withdrawalFromSales = grossSale
            .subtract(taxBuffer)
            .subtract(cashDeficit)
            .max(BigDecimal.ZERO)
            .min(remainingAfterCash)
            .money()
        val accountWithdrawal = cashUsed.add(withdrawalFromSales).money()
        return AccountWithdrawalStep(
            remainingWithdrawalPln = remainingAfterCash.subtract(withdrawalFromSales).max(BigDecimal.ZERO).money(),
            cashUsedPln = cashUsed,
            grossSalesPln = grossSale,
            taxBufferPln = taxBuffer,
            salesByClass = salesByClass,
            plan = PortfolioWithdrawalAccountPlan(
                accountId = account.accountId,
                accountName = account.accountName,
                taxWrapper = rule.taxWrapper,
                taxBufferRatePct = taxRate,
                currentValuePln = account.totalCurrentValuePln.money(),
                availableCashPln = positiveCash,
                cashUsedPln = cashUsed,
                grossSalesPln = grossSale,
                estimatedTaxBufferPln = taxBuffer,
                withdrawalPln = accountWithdrawal,
                projectedValuePln = account.totalCurrentValuePln.subtract(accountWithdrawal).subtract(taxBuffer)
                    .money(),
                sales = PLANNABLE_ASSET_CLASSES.map { assetClass ->
                    PortfolioWithdrawalAccountSale(assetClass, salesByClass[assetClass] ?: BigDecimal.ZERO.money())
                }
            )
        )
    }

    private fun validateAccountRules(
        settings: WithdrawalPlanningSettings,
        accountsById: Map<UUID, PortfolioAccountSummary>
    ) {
        require(settings.accountRules.map(WithdrawalPlanningAccountRule::accountId).distinct().size == settings.accountRules.size) {
            "Withdrawal account rules must contain unique account IDs."
        }
        require(settings.accountRules.all { it.accountId in accountsById }) {
            "Withdrawal account rules contain an unknown account ID."
        }
    }

    private fun PortfolioOverview.currentValues(): Map<AssetClass, BigDecimal> = linkedMapOf(
        AssetClass.EQUITIES to equityCurrentValuePln.money(),
        AssetClass.BONDS to bondCurrentValuePln.money(),
        AssetClass.CASH to cashCurrentValuePln.money()
    )

    private fun List<HoldingSnapshot>.byAccountAndClass(): Map<Pair<UUID, AssetClass>, BigDecimal> =
        filter { it.assetClass in PLANNABLE_ASSET_CLASS_NAMES }
            .groupBy { it.accountId to AssetClass.valueOf(it.assetClass) }
            .mapValues { (_, accountHoldings) ->
                accountHoldings.sumOf { holding -> holding.currentValuePln ?: holding.bookValuePln }.money()
            }

    private fun buildBuckets(
        currentValues: Map<AssetClass, BigDecimal>,
        plannedSales: Map<AssetClass, BigDecimal>,
        projectedValues: Map<AssetClass, BigDecimal>,
        projectedTotal: BigDecimal,
        targetsByAssetClass: Map<AssetClass, PortfolioTarget>
    ): List<PortfolioWithdrawalPlanBucket> = STANDARD_ASSET_CLASSES.map { assetClass ->
        val projectedValue = projectedValues.getValue(assetClass).money()
        val targetWeightPct = targetsByAssetClass[assetClass]?.targetWeight?.multiply(HUNDRED)?.percentage()
        val weightsAvailable = projectedTotal > BigDecimal.ZERO &&
            projectedValues.values.none { value -> value < BigDecimal.ZERO }
        val projectedWeightPct = if (weightsAvailable) {
            projectedValue.multiply(HUNDRED).divide(projectedTotal, 8, RoundingMode.HALF_UP).percentage()
        } else null
        PortfolioWithdrawalPlanBucket(
            assetClass = assetClass,
            currentValuePln = currentValues.getValue(assetClass),
            plannedSalePln = plannedSales[assetClass] ?: BigDecimal.ZERO.money(),
            projectedValuePln = projectedValue,
            projectedWeightPct = projectedWeightPct,
            targetWeightPct = targetWeightPct,
            projectedDriftPctPoints = projectedWeightPct?.let { weight ->
                targetWeightPct?.let { target -> weight.subtract(target).percentage() }
            }
        )
    }

    private fun WithdrawalCalculation.apply(step: AccountWithdrawalStep) {
        remainingWithdrawalPln = step.remainingWithdrawalPln
        cashUsedPln = cashUsedPln.add(step.cashUsedPln).money()
        grossSalesPln = grossSalesPln.add(step.grossSalesPln).money()
        taxBufferPln = taxBufferPln.add(step.taxBufferPln).money()
        step.salesByClass.forEach { (assetClass, sale) ->
            plannedSales[assetClass] = plannedSales.getValue(assetClass).add(sale).money()
            remainingValues[assetClass] = remainingValues.getValue(assetClass).subtract(sale).max(BigDecimal.ZERO).money()
        }
        accountPlans += step.plan
    }

    private fun allocateSales(
        amountPln: BigDecimal,
        availableByClass: Map<AssetClass, BigDecimal>,
        remainingPortfolioValues: Map<AssetClass, BigDecimal>,
        targetsByAssetClass: Map<AssetClass, PortfolioTarget>,
        targetProjectedTotal: BigDecimal
    ): Map<AssetClass, BigDecimal> {
        if (amountPln.signum() == 0) {
            return PLANNABLE_ASSET_CLASSES.associateWith { BigDecimal.ZERO.money() }
        }
        val result = PLANNABLE_ASSET_CLASSES.associateWith { BigDecimal.ZERO.money() }.toMutableMap()
        val available = availableByClass.toMutableMap()
        var remaining = amountPln

        PLANNABLE_ASSET_CLASSES
            .map { assetClass ->
                val targetValue = targetsByAssetClass[assetClass]?.targetWeight?.multiply(targetProjectedTotal)
                val excess = targetValue?.let { remainingPortfolioValues.getValue(assetClass).subtract(it).max(BigDecimal.ZERO) }
                    ?: BigDecimal.ZERO
                assetClass to excess.money()
            }
            .filter { (_, excess) -> excess > BigDecimal.ZERO }
            .sortedByDescending { (_, excess) -> excess }
            .forEach { (assetClass, excess) ->
                val sale = remaining.min(excess).min(available.getValue(assetClass)).money()
                result[assetClass] = result.getValue(assetClass).add(sale).money()
                available[assetClass] = available.getValue(assetClass).subtract(sale).money()
                remaining = remaining.subtract(sale).money()
            }

        if (remaining > BigDecimal.ZERO) {
            distributeProRata(remaining, available).forEach { (assetClass, sale) ->
                result[assetClass] = result.getValue(assetClass).add(sale).money()
            }
        }
        return result
    }

    private fun distributeProRata(
        amountPln: BigDecimal,
        availableByClass: Map<AssetClass, BigDecimal>
    ): Map<AssetClass, BigDecimal> {
        val positive = availableByClass.filterValues { it > BigDecimal.ZERO }
        val totalAvailable = positive.values.sumMoney()
        if (amountPln.signum() == 0 || totalAvailable.signum() == 0) return emptyMap()

        val requested = amountPln.min(totalAvailable).money()
        val shares = positive.entries.mapIndexed { order, (assetClass, available) ->
            val raw = requested.multiply(available).divide(totalAvailable, 12, RoundingMode.HALF_UP)
            ProvisionalSale(
                assetClass = assetClass,
                amountPln = raw.setScale(2, RoundingMode.DOWN),
                remainder = raw.subtract(raw.setScale(2, RoundingMode.DOWN)),
                order = order,
                availablePln = available
            )
        }.toMutableList()
        var cents = requested.subtract(shares.sumOf { it.amountPln }).movePointRight(2).toInt()
        shares.sortedWith(compareByDescending<ProvisionalSale> { it.remainder }.thenBy { it.order }).forEach { share ->
            if (cents > 0 && share.amountPln.add(CENT) <= share.availablePln) {
                share.amountPln = share.amountPln.add(CENT)
                cents -= 1
            }
        }
        return shares.associate { it.assetClass to it.amountPln.money() }
    }

    private fun addValuationWarnings(
        overview: PortfolioOverview,
        holdings: List<HoldingSnapshot>,
        accounts: List<PortfolioAccountSummary>,
        targets: List<PortfolioTarget>,
        settings: WithdrawalPlanningSettings,
        warnings: MutableSet<WithdrawalPlanWarning>
    ) {
        if (targets.isEmpty()) warnings += WithdrawalPlanWarning.TARGET_ALLOCATION_NOT_CONFIGURED
        if (settings.accountRules.none(WithdrawalPlanningAccountRule::enabled)) {
            warnings += WithdrawalPlanWarning.NO_ENABLED_WITHDRAWAL_ACCOUNTS
        }
        if (overview.valuationState == ValuationState.STALE || holdings.any { it.valuationStatus == HoldingValuationStatus.STALE }) {
            warnings += WithdrawalPlanWarning.STALE_VALUATIONS
        }
        if (holdings.any { it.currentValuePln == null }) {
            warnings += WithdrawalPlanWarning.UNVALUED_HOLDINGS_ESTIMATED_AT_BOOK_VALUE
        }
        if (overview.valuationState == ValuationState.PARTIALLY_VALUED || overview.valuationState == ValuationState.BOOK_ONLY) {
            warnings += WithdrawalPlanWarning.INCOMPLETE_VALUATION
        }
        if (accounts.any { it.cashBalancePln < BigDecimal.ZERO }) {
            warnings += WithdrawalPlanWarning.NEGATIVE_CASH_BALANCE
        }
    }

    private fun grossSaleNeeded(netAmountPln: BigDecimal, taxRatePct: BigDecimal): BigDecimal {
        if (netAmountPln.signum() == 0) return BigDecimal.ZERO.money()
        val netFactor = BigDecimal.ONE.subtract(taxRatePct.divide(HUNDRED, 8, RoundingMode.HALF_UP))
        return netAmountPln.divide(netFactor, 2, RoundingMode.CEILING).money()
    }

    private fun PortfolioWithdrawalPlanCommand.resolveAmount(totalCurrentValuePln: BigDecimal): BigDecimal {
        require((amountPln == null) xor (portfolioPercentagePct == null)) {
            "Provide exactly one of amountPln or portfolioPercentagePct."
        }
        amountPln?.let {
            val normalized = it.money()
            require(normalized > BigDecimal.ZERO) { "Withdrawal amount must be greater than zero." }
            return normalized
        }
        val percentage = requireNotNull(portfolioPercentagePct).percentage()
        require(percentage > BigDecimal.ZERO && percentage <= HUNDRED) {
            "Portfolio withdrawal percentage must be greater than zero and no more than 100."
        }
        val resolved = totalCurrentValuePln.multiply(percentage).divide(HUNDRED, 2, RoundingMode.HALF_UP).money()
        require(resolved > BigDecimal.ZERO) { "Portfolio percentage resolves to a zero withdrawal amount." }
        return resolved
    }

    private fun BigDecimal.normalizedTaxRate(): BigDecimal {
        val normalized = percentage()
        require(normalized >= BigDecimal.ZERO && normalized < HUNDRED) {
            "Tax buffer rate must be at least zero and lower than 100 percent."
        }
        return normalized
    }

    private fun Iterable<BigDecimal>.sumMoney(): BigDecimal = fold(BigDecimal.ZERO, BigDecimal::add).money()
    private fun BigDecimal.money(): BigDecimal = setScale(2, RoundingMode.HALF_UP)
    private fun BigDecimal.percentage(): BigDecimal = setScale(2, RoundingMode.HALF_UP)

    private companion object {
        val HUNDRED: BigDecimal = BigDecimal("100")
        val CENT: BigDecimal = BigDecimal("0.01")
        val STANDARD_ASSET_CLASSES = listOf(AssetClass.EQUITIES, AssetClass.BONDS, AssetClass.CASH)
        val PLANNABLE_ASSET_CLASSES = listOf(AssetClass.EQUITIES, AssetClass.BONDS)
        val PLANNABLE_ASSET_CLASS_NAMES = PLANNABLE_ASSET_CLASSES.map(AssetClass::name).toSet()
    }
}

data class PortfolioWithdrawalPlanCommand(
    val amountPln: BigDecimal? = null,
    val portfolioPercentagePct: BigDecimal? = null
)

data class WithdrawalPlanningSettings(
    val accountRules: List<WithdrawalPlanningAccountRule>
)

data class WithdrawalPlanningAccountRule(
    val accountId: UUID,
    val enabled: Boolean,
    val taxWrapper: WithdrawalTaxWrapper,
    val taxBufferRatePct: BigDecimal
)

@Serializable
enum class WithdrawalTaxWrapper {
    STANDARD,
    OKI,
    IKE,
    IKZE,
    NONE,
    CUSTOM
}

data class PortfolioWithdrawalPlan(
    val asOf: java.time.LocalDate,
    val valuationState: ValuationState,
    val requestedAmountPln: BigDecimal?,
    val requestedPortfolioPercentagePct: BigDecimal?,
    val requestedWithdrawalPln: BigDecimal,
    val plannedWithdrawalPln: BigDecimal,
    val feasible: Boolean,
    val shortfallPln: BigDecimal,
    val cashUsedPln: BigDecimal,
    val grossSalesPln: BigDecimal,
    val estimatedTaxBufferPln: BigDecimal,
    val projectedTotalValuePln: BigDecimal,
    val accountPlans: List<PortfolioWithdrawalAccountPlan>,
    val buckets: List<PortfolioWithdrawalPlanBucket>,
    val warnings: List<WithdrawalPlanWarning>
)

data class PortfolioWithdrawalAccountPlan(
    val accountId: UUID,
    val accountName: String,
    val taxWrapper: WithdrawalTaxWrapper,
    val taxBufferRatePct: BigDecimal,
    val currentValuePln: BigDecimal,
    val availableCashPln: BigDecimal,
    val cashUsedPln: BigDecimal,
    val grossSalesPln: BigDecimal,
    val estimatedTaxBufferPln: BigDecimal,
    val withdrawalPln: BigDecimal,
    val projectedValuePln: BigDecimal,
    val sales: List<PortfolioWithdrawalAccountSale>
)

data class PortfolioWithdrawalAccountSale(
    val assetClass: AssetClass,
    val amountPln: BigDecimal
)

data class PortfolioWithdrawalPlanBucket(
    val assetClass: AssetClass,
    val currentValuePln: BigDecimal,
    val plannedSalePln: BigDecimal,
    val projectedValuePln: BigDecimal,
    val projectedWeightPct: BigDecimal?,
    val targetWeightPct: BigDecimal?,
    val projectedDriftPctPoints: BigDecimal?
)

enum class WithdrawalPlanWarning {
    TARGET_ALLOCATION_NOT_CONFIGURED,
    NO_ENABLED_WITHDRAWAL_ACCOUNTS,
    STALE_VALUATIONS,
    UNVALUED_HOLDINGS_ESTIMATED_AT_BOOK_VALUE,
    INCOMPLETE_VALUATION,
    NEGATIVE_CASH_BALANCE,
    INSUFFICIENT_LIQUIDITY
}

private data class ProvisionalSale(
    val assetClass: AssetClass,
    var amountPln: BigDecimal,
    val remainder: BigDecimal,
    val order: Int,
    val availablePln: BigDecimal
)

private data class WithdrawalCalculation(
    var remainingWithdrawalPln: BigDecimal,
    var cashUsedPln: BigDecimal = BigDecimal.ZERO.setScale(2),
    var grossSalesPln: BigDecimal = BigDecimal.ZERO.setScale(2),
    var taxBufferPln: BigDecimal = BigDecimal.ZERO.setScale(2),
    val remainingValues: MutableMap<AssetClass, BigDecimal>,
    val plannedSales: MutableMap<AssetClass, BigDecimal>,
    val accountPlans: MutableList<PortfolioWithdrawalAccountPlan> = mutableListOf()
)

private data class AccountWithdrawalStep(
    val remainingWithdrawalPln: BigDecimal,
    val cashUsedPln: BigDecimal,
    val grossSalesPln: BigDecimal,
    val taxBufferPln: BigDecimal,
    val salesByClass: Map<AssetClass, BigDecimal>,
    val plan: PortfolioWithdrawalAccountPlan
)
