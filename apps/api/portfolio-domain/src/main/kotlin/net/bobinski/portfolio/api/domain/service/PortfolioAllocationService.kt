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
        val context = loadContext()
        return buildSummary(
            inputs = SummaryInputs(
                asOf = context.overview.asOf,
                valuationState = context.overview.valuationState,
                currentValues = context.currentValues,
                totalCurrentValue = context.totalCurrentValue,
                targets = context.targets,
                targetsByAssetClass = context.targetsByAssetClass,
                toleranceBandPctPoints = context.settings.toleranceBandPctPoints,
                rebalancingMode = context.settings.mode,
                availableCash = context.currentValues.getValue(AssetClass.CASH)
            )
        )
    }

    suspend fun contributionPlan(amountPln: BigDecimal): PortfolioContributionPlan {
        val normalizedAmount = amountPln.money()
        require(normalizedAmount > BigDecimal.ZERO) { "Contribution amount must be greater than zero." }

        val context = loadContext()
        require(context.targets.isNotEmpty()) { "Configure target allocation before calculating a contribution plan." }

        val contributionByAssetClass = buildContributionPlan(
            currentValues = context.currentValues,
            targetsByAssetClass = context.targetsByAssetClass,
            totalCurrentValue = context.totalCurrentValue,
            contributionAmountPln = normalizedAmount
        )
        val projectedValues = ASSET_CLASSES.associateWith { assetClass ->
            context.currentValues.getValue(assetClass)
                .add(contributionByAssetClass[assetClass] ?: BigDecimal.ZERO)
                .money()
        }
        val projectedSummary = buildSummary(
            inputs = SummaryInputs(
                asOf = context.overview.asOf,
                valuationState = context.overview.valuationState,
                currentValues = projectedValues,
                totalCurrentValue = context.totalCurrentValue.add(normalizedAmount).money(),
                targets = context.targets,
                targetsByAssetClass = context.targetsByAssetClass,
                toleranceBandPctPoints = context.settings.toleranceBandPctPoints,
                rebalancingMode = context.settings.mode,
                availableCash = projectedValues.getValue(AssetClass.CASH)
            )
        )

        return PortfolioContributionPlan(
            amountPln = normalizedAmount,
            projected = projectedSummary,
            buckets = projectedSummary.buckets.map { bucket ->
                PortfolioContributionPlanBucket(
                    assetClass = bucket.assetClass,
                    plannedContributionPln = contributionByAssetClass[bucket.assetClass]?.money() ?: BigDecimal.ZERO.money(),
                    projectedValuePln = bucket.currentValuePln,
                    projectedWeightPct = bucket.currentWeightPct,
                    projectedDriftPctPoints = bucket.driftPctPoints,
                    projectedGapValuePln = bucket.gapValuePln,
                    projectedStatus = bucket.status
                )
            }
        )
    }

    private fun buildBucketInputs(
        currentValues: Map<AssetClass, BigDecimal>,
        targetsByAssetClass: Map<AssetClass, PortfolioTarget>,
        totalCurrentValue: BigDecimal,
        toleranceBandPctPoints: BigDecimal
    ): List<AllocationBucketInput> = ASSET_CLASSES.map { assetClass ->
        val currentValue = currentValues.getValue(assetClass)
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

    private suspend fun loadContext(): AllocationContext {
        val overview = portfolioReadModelService.overview()
        val targets = portfolioTargetRepository.list()
        return AllocationContext(
            overview = overview,
            targets = targets,
            targetsByAssetClass = targets.associateBy(PortfolioTarget::assetClass),
            settings = rebalancingSettingsService.settings(),
            currentValues = mapOf(
                AssetClass.EQUITIES to overview.equityCurrentValuePln.money(),
                AssetClass.BONDS to overview.bondCurrentValuePln.money(),
                AssetClass.CASH to overview.cashCurrentValuePln.money()
            ),
            totalCurrentValue = overview.totalCurrentValuePln.money()
        )
    }

    private fun buildSummary(inputs: SummaryInputs): PortfolioAllocationSummary {
        val targetWeightSum = inputs.targets.fold(BigDecimal.ZERO) { total, target ->
            total.add(target.targetWeight)
        }.multiply(HUNDRED).scalePercent()
        val bucketInputs = buildBucketInputs(
            currentValues = inputs.currentValues,
            targetsByAssetClass = inputs.targetsByAssetClass,
            totalCurrentValue = inputs.totalCurrentValue,
            toleranceBandPctPoints = inputs.toleranceBandPctPoints
        )
        val summaryMetrics = summarizeBuckets(
            bucketInputs = bucketInputs,
            toleranceBandPctPoints = inputs.toleranceBandPctPoints
        )
        val recommendedAction = determineRecommendedAction(inputs, summaryMetrics)

        return PortfolioAllocationSummary(
            asOf = inputs.asOf,
            valuationState = inputs.valuationState,
            configured = inputs.targets.isNotEmpty(),
            toleranceBandPctPoints = inputs.toleranceBandPctPoints,
            rebalancingMode = inputs.rebalancingMode,
            targetWeightSumPct = targetWeightSum,
            totalCurrentValuePln = inputs.totalCurrentValue.money(),
            availableCashPln = inputs.availableCash.money(),
            breachedBucketCount = summaryMetrics.breachedBucketCount,
            largestBandBreachPctPoints = summaryMetrics.largestBandBreachPctPoints,
            recommendedAction = recommendedAction,
            recommendedAssetClass = summaryMetrics.contributionTarget?.assetClass,
            recommendedContributionPln = suggestedContribution(
                gapValue = summaryMetrics.contributionTarget?.outsideToleranceGapValuePln,
                positiveGapSum = summaryMetrics.positiveGapSum,
                availableCash = inputs.availableCash
            ),
            remainingContributionGapPln = summaryMetrics.positiveGapSum.subtract(inputs.availableCash).max(BigDecimal.ZERO).money(),
            fullRebalanceBuyAmountPln = summaryMetrics.positiveGapSum,
            fullRebalanceSellAmountPln = summaryMetrics.negativeGapSum,
            requiresSelling = summaryMetrics.negativeGapSum > BigDecimal.ZERO && summaryMetrics.positiveGapSum > inputs.availableCash,
            buckets = bucketInputs.map { bucket ->
                bucket.toSummaryBucket(
                    positiveGapSum = summaryMetrics.positiveGapSum,
                    availableCash = inputs.availableCash
                )
            }
        )
    }

    private fun summarizeBuckets(
        bucketInputs: List<AllocationBucketInput>,
        toleranceBandPctPoints: BigDecimal
    ): SummaryMetrics {
        val positiveGaps = bucketInputs.filter { it.outsideToleranceGapValuePln > BigDecimal.ZERO }
        val negativeGaps = bucketInputs.filter { it.outsideToleranceGapValuePln < BigDecimal.ZERO }
        return SummaryMetrics(
            positiveGapSum = positiveGaps
                .fold(BigDecimal.ZERO) { total, bucket -> total.add(bucket.outsideToleranceGapValuePln) }
                .money(),
            negativeGapSum = negativeGaps
                .fold(BigDecimal.ZERO) { total, bucket -> total.add(bucket.outsideToleranceGapValuePln.abs()) }
                .money(),
            breachedBucketCount = bucketInputs.count { !it.withinTolerance && it.targetWeightPct != null },
            largestBandBreachPctPoints = bucketInputs
                .mapNotNull { bucket ->
                    bucket.driftPctPoints?.abs()?.subtract(toleranceBandPctPoints)?.takeIf { it > BigDecimal.ZERO }?.scalePercent()
                }
                .maxOrNull(),
            contributionTarget = positiveGaps.maxByOrNull { it.outsideToleranceGapValuePln }
        )
    }

    private fun determineRecommendedAction(
        inputs: SummaryInputs,
        summaryMetrics: SummaryMetrics
    ): PortfolioAllocationAction {
        val deployableThreshold = inputs.totalCurrentValue.multiply(DEPLOY_CASH_THRESHOLD_RATIO).money()
        val cashIsDeployable = inputs.availableCash >= deployableThreshold && inputs.availableCash.signum() > 0
        return when {
            inputs.targets.isEmpty() -> PortfolioAllocationAction.UNCONFIGURED
            summaryMetrics.breachedBucketCount == 0 -> PortfolioAllocationAction.WITHIN_TOLERANCE
            summaryMetrics.positiveGapSum.signum() > 0 && cashIsDeployable -> PortfolioAllocationAction.DEPLOY_EXISTING_CASH
            inputs.rebalancingMode == RebalancingMode.ALLOW_TRIMS && summaryMetrics.negativeGapSum.signum() > 0 -> PortfolioAllocationAction.FULL_REBALANCE
            else -> PortfolioAllocationAction.WAIT_FOR_NEXT_CONTRIBUTION
        }
    }

    private fun buildContributionPlan(
        currentValues: Map<AssetClass, BigDecimal>,
        targetsByAssetClass: Map<AssetClass, PortfolioTarget>,
        totalCurrentValue: BigDecimal,
        contributionAmountPln: BigDecimal
    ): Map<AssetClass, BigDecimal> {
        val projectedTotalValue = totalCurrentValue
            .add(contributionAmountPln)
            .money()
        val projectedUnderweightGaps = linkedMapOf<AssetClass, BigDecimal>()
        ASSET_CLASSES.forEach { assetClass ->
            val targetWeight = targetsByAssetClass[assetClass]?.targetWeight ?: return@forEach
            val gap = projectedTotalValue
                .multiply(targetWeight)
                .subtract(currentValues.getValue(assetClass))
                .money()
            if (gap > BigDecimal.ZERO) {
                projectedUnderweightGaps[assetClass] = gap
            }
        }
        val projectedGapAllocation = distributeAmount(contributionAmountPln, projectedUnderweightGaps)

        return ASSET_CLASSES.associateWith { assetClass ->
            projectedGapAllocation.getOrDefault(assetClass, BigDecimal.ZERO)
                .money()
        }
    }

    private fun <K> distributeAmount(amountPln: BigDecimal, weights: Map<K, BigDecimal>): Map<K, BigDecimal> {
        val normalizedAmount = amountPln.money()
        if (normalizedAmount <= BigDecimal.ZERO) {
            return emptyMap()
        }
        val positiveWeights = weights.entries.filter { it.value > BigDecimal.ZERO }
        if (positiveWeights.isEmpty()) {
            return emptyMap()
        }
        val totalWeight = positiveWeights.fold(BigDecimal.ZERO) { total, entry -> total.add(entry.value) }
        val provisionalShares = positiveWeights.mapIndexed { index, entry ->
            val rawShare = normalizedAmount
                .multiply(entry.value)
                .divide(totalWeight, 8, RoundingMode.HALF_UP)
            DistributedAmount(
                key = entry.key,
                floorAmount = rawShare.setScale(2, RoundingMode.DOWN),
                fractionalRemainder = rawShare.subtract(rawShare.setScale(2, RoundingMode.DOWN)),
                order = index
            )
        }
        val allocatedFloor = provisionalShares.fold(BigDecimal.ZERO) { total, share -> total.add(share.floorAmount) }
        val centsToDistribute = normalizedAmount
            .subtract(allocatedFloor)
            .movePointRight(2)
            .setScale(0, RoundingMode.UNNECESSARY)
            .toInt()
        val keysReceivingExtraCent = provisionalShares
            .sortedWith(
                compareByDescending<DistributedAmount<K>> { it.fractionalRemainder }
                    .thenBy { it.order }
            )
            .take(centsToDistribute)
            .map { it.key }
            .toSet()

        return provisionalShares.associate { share ->
            val extra = if (keysReceivingExtraCent.contains(share.key)) CENT else BigDecimal.ZERO
            share.key to share.floorAmount.add(extra).money()
        }
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
        private val CENT = BigDecimal("0.01")
        private val DEPLOY_CASH_THRESHOLD_RATIO = BigDecimal("0.005")
        private val ASSET_CLASSES = listOf(AssetClass.EQUITIES, AssetClass.BONDS, AssetClass.CASH)
    }
}

private data class AllocationContext(
    val overview: PortfolioOverview,
    val targets: List<PortfolioTarget>,
    val targetsByAssetClass: Map<AssetClass, PortfolioTarget>,
    val settings: PortfolioRebalancingSettings,
    val currentValues: Map<AssetClass, BigDecimal>,
    val totalCurrentValue: BigDecimal
)

private data class DistributedAmount<K>(
    val key: K,
    val floorAmount: BigDecimal,
    val fractionalRemainder: BigDecimal,
    val order: Int
)

private data class SummaryInputs(
    val asOf: java.time.LocalDate,
    val valuationState: ValuationState,
    val currentValues: Map<AssetClass, BigDecimal>,
    val totalCurrentValue: BigDecimal,
    val targets: List<PortfolioTarget>,
    val targetsByAssetClass: Map<AssetClass, PortfolioTarget>,
    val toleranceBandPctPoints: BigDecimal,
    val rebalancingMode: RebalancingMode,
    val availableCash: BigDecimal
)

private data class SummaryMetrics(
    val positiveGapSum: BigDecimal,
    val negativeGapSum: BigDecimal,
    val breachedBucketCount: Int,
    val largestBandBreachPctPoints: BigDecimal?,
    val contributionTarget: AllocationBucketInput?
)

private fun AllocationBucketInput.toSummaryBucket(
    positiveGapSum: BigDecimal,
    availableCash: BigDecimal
): PortfolioAllocationBucket = PortfolioAllocationBucket(
    assetClass = assetClass,
    currentValuePln = currentValuePln,
    currentWeightPct = currentWeightPct,
    targetWeightPct = targetWeightPct,
    targetValuePln = targetValuePln,
    driftPctPoints = driftPctPoints,
    gapValuePln = gapValuePln,
    toleranceLowerPct = toleranceLowerPct,
    toleranceUpperPct = toleranceUpperPct,
    withinTolerance = withinTolerance,
    suggestedContributionPln = when {
        outsideToleranceGapValuePln <= BigDecimal.ZERO -> BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP)
        positiveGapSum.signum() == 0 || availableCash.signum() == 0 -> BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP)
        availableCash >= positiveGapSum -> outsideToleranceGapValuePln.setScale(2, RoundingMode.HALF_UP)
        else -> availableCash
            .multiply(outsideToleranceGapValuePln)
            .divide(positiveGapSum, 8, RoundingMode.HALF_UP)
            .setScale(2, RoundingMode.HALF_UP)
    },
    rebalanceAction = rebalanceAction,
    status = when {
        targetWeightPct == null -> AllocationBucketStatus.UNCONFIGURED
        withinTolerance -> AllocationBucketStatus.ON_TARGET
        outsideToleranceGapValuePln > BigDecimal.ZERO -> AllocationBucketStatus.UNDERWEIGHT
        outsideToleranceGapValuePln < BigDecimal.ZERO -> AllocationBucketStatus.OVERWEIGHT
        else -> AllocationBucketStatus.ON_TARGET
    }
)

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

data class PortfolioContributionPlan(
    val amountPln: BigDecimal,
    val projected: PortfolioAllocationSummary,
    val buckets: List<PortfolioContributionPlanBucket>
)

data class PortfolioContributionPlanBucket(
    val assetClass: AssetClass,
    val plannedContributionPln: BigDecimal,
    val projectedValuePln: BigDecimal,
    val projectedWeightPct: BigDecimal,
    val projectedDriftPctPoints: BigDecimal?,
    val projectedGapValuePln: BigDecimal?,
    val projectedStatus: AllocationBucketStatus
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
