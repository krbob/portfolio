package net.bobinski.portfolio.api.domain.service

import java.math.BigDecimal
import java.math.RoundingMode
import net.bobinski.portfolio.api.domain.model.AssetClass
import net.bobinski.portfolio.api.domain.model.PortfolioTarget
import net.bobinski.portfolio.api.domain.repository.PortfolioTargetRepository

class PortfolioAllocationService(
    private val portfolioTargetRepository: PortfolioTargetRepository,
    private val portfolioReadModelService: PortfolioReadModelService,
    private val rebalancingSettingsService: PortfolioRebalancingSettingsService
) {
    suspend fun summary(): PortfolioAllocationSummary {
        val overview = portfolioReadModelService.overview()
        val targets = portfolioTargetRepository.list()
        val targetsByAssetClass = targets.associateBy(PortfolioTarget::assetClass)
        val settings = rebalancingSettingsService.settings()
        val toleranceBandPctPoints = settings.toleranceBandPctPoints
        val currentValues = mapOf(
            AssetClass.EQUITIES to overview.equityCurrentValuePln,
            AssetClass.BONDS to overview.bondCurrentValuePln,
            AssetClass.CASH to overview.cashCurrentValuePln
        )
        val totalCurrentValue = overview.totalCurrentValuePln
        val targetWeightSum = targets.fold(BigDecimal.ZERO) { total, target ->
            total.add(target.targetWeight)
        }.multiply(HUNDRED).scalePercent()
        val availableCash = overview.cashCurrentValuePln.money()

        val bucketInputs = buildBucketInputs(currentValues, targetsByAssetClass, totalCurrentValue, toleranceBandPctPoints)

        val positiveGaps = bucketInputs.filter { it.outsideToleranceGapValuePln > BigDecimal.ZERO }
        val negativeGaps = bucketInputs.filter { it.outsideToleranceGapValuePln < BigDecimal.ZERO }
        val positiveGapSum = positiveGaps
            .fold(BigDecimal.ZERO) { total, bucket -> total.add(bucket.outsideToleranceGapValuePln) }
            .money()
        val negativeGapSum = negativeGaps
            .fold(BigDecimal.ZERO) { total, bucket -> total.add(bucket.outsideToleranceGapValuePln.abs()) }
            .money()
        val breachedBucketCount = bucketInputs.count { !it.withinTolerance && it.targetWeightPct != null }
        val largestBandBreachPctPoints = bucketInputs
            .mapNotNull { bucket ->
                bucket.driftPctPoints?.abs()?.subtract(toleranceBandPctPoints)?.takeIf { it > BigDecimal.ZERO }?.scalePercent()
            }
            .maxOrNull()

        val contributionTarget = positiveGaps.maxByOrNull { it.outsideToleranceGapValuePln }
        val deployableThreshold = totalCurrentValue.multiply(DEPLOY_CASH_THRESHOLD_RATIO).money()
        val cashIsDeployable = availableCash >= deployableThreshold && availableCash.signum() > 0
        val recommendedAction = when {
            targets.isEmpty() -> PortfolioAllocationAction.UNCONFIGURED
            breachedBucketCount == 0 -> PortfolioAllocationAction.WITHIN_TOLERANCE
            positiveGapSum.signum() > 0 && cashIsDeployable -> PortfolioAllocationAction.DEPLOY_EXISTING_CASH
            settings.mode == RebalancingMode.ALLOW_TRIMS && negativeGapSum.signum() > 0 -> PortfolioAllocationAction.FULL_REBALANCE
            else -> PortfolioAllocationAction.WAIT_FOR_NEXT_CONTRIBUTION
        }

        return PortfolioAllocationSummary(
            asOf = overview.asOf,
            valuationState = overview.valuationState,
            configured = targets.isNotEmpty(),
            toleranceBandPctPoints = toleranceBandPctPoints,
            rebalancingMode = settings.mode,
            targetWeightSumPct = targetWeightSum,
            totalCurrentValuePln = totalCurrentValue.money(),
            availableCashPln = availableCash,
            breachedBucketCount = breachedBucketCount,
            largestBandBreachPctPoints = largestBandBreachPctPoints,
            recommendedAction = recommendedAction,
            recommendedAssetClass = contributionTarget?.assetClass,
            recommendedContributionPln = suggestedContribution(contributionTarget?.outsideToleranceGapValuePln, positiveGapSum, availableCash),
            remainingContributionGapPln = positiveGapSum.subtract(availableCash).max(BigDecimal.ZERO).money(),
            fullRebalanceBuyAmountPln = positiveGapSum,
            fullRebalanceSellAmountPln = negativeGapSum,
            requiresSelling = negativeGapSum > BigDecimal.ZERO && positiveGapSum > availableCash,
            buckets = bucketInputs.map { bucket ->
                PortfolioAllocationBucket(
                    assetClass = bucket.assetClass,
                    currentValuePln = bucket.currentValuePln,
                    currentWeightPct = bucket.currentWeightPct,
                    targetWeightPct = bucket.targetWeightPct,
                    targetValuePln = bucket.targetValuePln,
                    driftPctPoints = bucket.driftPctPoints,
                    gapValuePln = bucket.gapValuePln,
                    toleranceLowerPct = bucket.toleranceLowerPct,
                    toleranceUpperPct = bucket.toleranceUpperPct,
                    withinTolerance = bucket.withinTolerance,
                    suggestedContributionPln = suggestedContribution(bucket.outsideToleranceGapValuePln.takeIf { it > BigDecimal.ZERO }, positiveGapSum, availableCash),
                    rebalanceAction = bucket.rebalanceAction,
                    status = when {
                        bucket.targetWeightPct == null -> AllocationBucketStatus.UNCONFIGURED
                        bucket.withinTolerance -> AllocationBucketStatus.ON_TARGET
                        bucket.outsideToleranceGapValuePln > BigDecimal.ZERO -> AllocationBucketStatus.UNDERWEIGHT
                        bucket.outsideToleranceGapValuePln < BigDecimal.ZERO -> AllocationBucketStatus.OVERWEIGHT
                        else -> AllocationBucketStatus.ON_TARGET
                    }
                )
            }
        )
    }

    private fun buildBucketInputs(
        currentValues: Map<AssetClass, BigDecimal>,
        targetsByAssetClass: Map<AssetClass, PortfolioTarget>,
        totalCurrentValue: BigDecimal,
        toleranceBandPctPoints: BigDecimal
    ): List<AllocationBucketInput> = currentValues.entries.map { (assetClass, currentValue) ->
        val target = targetsByAssetClass[assetClass]
        val currentWeightPct = if (totalCurrentValue.signum() == 0) {
            BigDecimal.ZERO
        } else {
            currentValue
                .divide(totalCurrentValue, 8, RoundingMode.HALF_UP)
                .multiply(HUNDRED)
        }.scalePercent()
        val targetWeightPct = target?.targetWeight?.multiply(HUNDRED)?.scalePercent()
        val targetValue = target?.let { totalCurrentValue.multiply(it.targetWeight).money() }
        val gapValue = targetValue?.subtract(currentValue)?.money()
        val driftPctPoints = targetWeightPct?.let { currentWeightPct.subtract(it).scalePercent() }
        val withinTolerance = driftPctPoints != null && driftPctPoints.abs() <= toleranceBandPctPoints
        AllocationBucketInput(
            assetClass = assetClass,
            currentValuePln = currentValue.money(),
            currentWeightPct = currentWeightPct,
            targetWeightPct = targetWeightPct,
            targetValuePln = targetValue,
            driftPctPoints = driftPctPoints,
            gapValuePln = gapValue,
            toleranceLowerPct = targetWeightPct?.subtract(toleranceBandPctPoints)?.max(BigDecimal.ZERO)?.scalePercent(),
            toleranceUpperPct = targetWeightPct?.add(toleranceBandPctPoints)?.min(HUNDRED)?.scalePercent(),
            withinTolerance = withinTolerance,
            outsideToleranceGapValuePln = if (gapValue == null || withinTolerance) BigDecimal.ZERO else gapValue,
            rebalanceAction = when {
                target == null || gapValue == null -> AllocationBucketAction.UNCONFIGURED
                withinTolerance -> AllocationBucketAction.HOLD
                gapValue > BigDecimal("0.01") -> AllocationBucketAction.BUY
                gapValue < BigDecimal("-0.01") -> AllocationBucketAction.SELL
                else -> AllocationBucketAction.HOLD
            }
        )
    }

    private fun suggestedContribution(
        gapValue: BigDecimal?,
        positiveGapSum: BigDecimal,
        availableCash: BigDecimal
    ): BigDecimal = when {
        gapValue == null || gapValue <= BigDecimal.ZERO -> BigDecimal.ZERO.money()
        positiveGapSum.signum() == 0 || availableCash.signum() == 0 -> BigDecimal.ZERO.money()
        availableCash >= positiveGapSum -> gapValue.money()
        else -> availableCash
            .multiply(gapValue)
            .divide(positiveGapSum, 8, RoundingMode.HALF_UP)
            .money()
    }

    private fun BigDecimal.scalePercent(): BigDecimal = setScale(2, RoundingMode.HALF_UP)
    private fun BigDecimal.money(): BigDecimal = setScale(2, RoundingMode.HALF_UP)

    companion object {
        private val HUNDRED = BigDecimal("100")
        private val DEPLOY_CASH_THRESHOLD_RATIO = BigDecimal("0.005")
    }
}

data class PortfolioAllocationSummary(
    val asOf: java.time.LocalDate,
    val valuationState: ValuationState,
    val configured: Boolean,
    val toleranceBandPctPoints: BigDecimal,
    val rebalancingMode: RebalancingMode,
    val targetWeightSumPct: BigDecimal,
    val totalCurrentValuePln: BigDecimal,
    val availableCashPln: BigDecimal,
    val breachedBucketCount: Int,
    val largestBandBreachPctPoints: BigDecimal?,
    val recommendedAction: PortfolioAllocationAction,
    val recommendedAssetClass: AssetClass?,
    val recommendedContributionPln: BigDecimal,
    val remainingContributionGapPln: BigDecimal,
    val fullRebalanceBuyAmountPln: BigDecimal,
    val fullRebalanceSellAmountPln: BigDecimal,
    val requiresSelling: Boolean,
    val buckets: List<PortfolioAllocationBucket>
)

data class PortfolioAllocationBucket(
    val assetClass: AssetClass,
    val currentValuePln: BigDecimal,
    val currentWeightPct: BigDecimal,
    val targetWeightPct: BigDecimal?,
    val targetValuePln: BigDecimal?,
    val driftPctPoints: BigDecimal?,
    val gapValuePln: BigDecimal?,
    val toleranceLowerPct: BigDecimal?,
    val toleranceUpperPct: BigDecimal?,
    val withinTolerance: Boolean,
    val suggestedContributionPln: BigDecimal,
    val rebalanceAction: AllocationBucketAction,
    val status: AllocationBucketStatus
)

data class AllocationBucketInput(
    val assetClass: AssetClass,
    val currentValuePln: BigDecimal,
    val currentWeightPct: BigDecimal,
    val targetWeightPct: BigDecimal?,
    val targetValuePln: BigDecimal?,
    val driftPctPoints: BigDecimal?,
    val gapValuePln: BigDecimal?,
    val toleranceLowerPct: BigDecimal?,
    val toleranceUpperPct: BigDecimal?,
    val withinTolerance: Boolean,
    val outsideToleranceGapValuePln: BigDecimal,
    val rebalanceAction: AllocationBucketAction
)

enum class AllocationBucketStatus {
    UNDERWEIGHT,
    OVERWEIGHT,
    ON_TARGET,
    UNCONFIGURED
}

enum class AllocationBucketAction {
    BUY,
    SELL,
    HOLD,
    UNCONFIGURED
}

enum class PortfolioAllocationAction {
    UNCONFIGURED,
    WITHIN_TOLERANCE,
    DEPLOY_EXISTING_CASH,
    WAIT_FOR_NEXT_CONTRIBUTION,
    FULL_REBALANCE
}
