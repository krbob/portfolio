package net.bobinski.portfolio.api.domain.service

import java.math.BigDecimal
import java.math.RoundingMode
import net.bobinski.portfolio.api.domain.model.AssetClass
import net.bobinski.portfolio.api.domain.model.PortfolioTarget
import net.bobinski.portfolio.api.domain.repository.PortfolioTargetRepository

class PortfolioAllocationService(
    private val portfolioTargetRepository: PortfolioTargetRepository,
    private val portfolioReadModelService: PortfolioReadModelService
) {
    suspend fun summary(): PortfolioAllocationSummary {
        val overview = portfolioReadModelService.overview()
        val targets = portfolioTargetRepository.list()
        val targetsByAssetClass = targets.associateBy(PortfolioTarget::assetClass)
        val currentValues = mapOf(
            AssetClass.EQUITIES to overview.equityCurrentValuePln,
            AssetClass.BONDS to overview.bondCurrentValuePln,
            AssetClass.CASH to overview.cashCurrentValuePln
        )
        val totalCurrentValue = overview.totalCurrentValuePln
        val targetWeightSum = targets.fold(BigDecimal.ZERO) { total, target ->
            total.add(target.targetWeight)
        }.multiply(HUNDRED).scalePercent()
        val positiveGaps = currentValues.entries.mapNotNull { (assetClass, currentValue) ->
            val target = targetsByAssetClass[assetClass] ?: return@mapNotNull null
            val targetValue = totalCurrentValue.multiply(target.targetWeight).money()
            val gapValue = targetValue.subtract(currentValue).money()
            if (gapValue > BigDecimal.ZERO) assetClass to gapValue else null
        }.toMap()
        val positiveGapSum = positiveGaps.values.fold(BigDecimal.ZERO, BigDecimal::add).money()
        val availableCash = overview.cashCurrentValuePln.money()

        return PortfolioAllocationSummary(
            asOf = overview.asOf,
            valuationState = overview.valuationState,
            configured = targets.isNotEmpty(),
            targetWeightSumPct = targetWeightSum,
            totalCurrentValuePln = totalCurrentValue.money(),
            availableCashPln = availableCash,
            buckets = currentValues.entries.map { (assetClass, currentValue) ->
                val target = targetsByAssetClass[assetClass]
                val currentWeightPct = if (totalCurrentValue.signum() == 0) {
                    BigDecimal.ZERO
                } else {
                    currentValue
                        .divide(totalCurrentValue, 8, RoundingMode.HALF_UP)
                        .multiply(HUNDRED)
                }.scalePercent()
                val targetWeightPct = target?.targetWeight?.multiply(HUNDRED)?.scalePercent()
                val targetValue = target?.let {
                    totalCurrentValue.multiply(it.targetWeight).money()
                }
                val gapValue = targetValue?.subtract(currentValue)?.money()
                val driftPctPoints = targetWeightPct?.let {
                    currentWeightPct.subtract(it).scalePercent()
                }
                val suggestedContribution = when {
                    gapValue == null || gapValue <= BigDecimal.ZERO -> BigDecimal.ZERO
                    positiveGapSum.signum() == 0 || availableCash.signum() == 0 -> BigDecimal.ZERO
                    availableCash >= positiveGapSum -> gapValue
                    else -> availableCash
                        .multiply(gapValue)
                        .divide(positiveGapSum, 8, RoundingMode.HALF_UP)
                        .money()
                }

                PortfolioAllocationBucket(
                    assetClass = assetClass,
                    currentValuePln = currentValue.money(),
                    currentWeightPct = currentWeightPct,
                    targetWeightPct = targetWeightPct,
                    targetValuePln = targetValue,
                    driftPctPoints = driftPctPoints,
                    gapValuePln = gapValue,
                    suggestedContributionPln = suggestedContribution,
                    status = when {
                        target == null -> AllocationBucketStatus.UNCONFIGURED
                        gapValue == null -> AllocationBucketStatus.UNCONFIGURED
                        gapValue > BigDecimal("0.01") -> AllocationBucketStatus.UNDERWEIGHT
                        gapValue < BigDecimal("-0.01") -> AllocationBucketStatus.OVERWEIGHT
                        else -> AllocationBucketStatus.ON_TARGET
                    }
                )
            }
        )
    }

    private fun BigDecimal.scalePercent(): BigDecimal = setScale(2, RoundingMode.HALF_UP)
    private fun BigDecimal.money(): BigDecimal = setScale(2, RoundingMode.HALF_UP)

    companion object {
        private val HUNDRED = BigDecimal("100")
    }
}

data class PortfolioAllocationSummary(
    val asOf: java.time.LocalDate,
    val valuationState: ValuationState,
    val configured: Boolean,
    val targetWeightSumPct: BigDecimal,
    val totalCurrentValuePln: BigDecimal,
    val availableCashPln: BigDecimal,
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
    val suggestedContributionPln: BigDecimal,
    val status: AllocationBucketStatus
)

enum class AllocationBucketStatus {
    UNDERWEIGHT,
    OVERWEIGHT,
    ON_TARGET,
    UNCONFIGURED
}
