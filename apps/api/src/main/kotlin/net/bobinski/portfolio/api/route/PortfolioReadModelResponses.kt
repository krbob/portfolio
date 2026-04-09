package net.bobinski.portfolio.api.route

import kotlinx.serialization.Serializable
import net.bobinski.portfolio.api.domain.service.BenchmarkComparison
import net.bobinski.portfolio.api.domain.service.BenchmarkSeriesHealth
import net.bobinski.portfolio.api.domain.service.CurrencyAmountSnapshot
import net.bobinski.portfolio.api.domain.service.HoldingSnapshot
import net.bobinski.portfolio.api.domain.service.PortfolioAccountSummary
import net.bobinski.portfolio.api.domain.service.PortfolioAllocationBucket
import net.bobinski.portfolio.api.domain.service.PortfolioContributionPlan
import net.bobinski.portfolio.api.domain.service.PortfolioContributionPlanBucket
import net.bobinski.portfolio.api.domain.service.PortfolioAllocationSummary
import net.bobinski.portfolio.api.domain.service.PortfolioDailyHistory
import net.bobinski.portfolio.api.domain.service.PortfolioDailyHistoryPoint
import net.bobinski.portfolio.api.domain.service.PortfolioOverview
import net.bobinski.portfolio.api.domain.service.PortfolioReturnPeriod
import net.bobinski.portfolio.api.domain.service.PortfolioReturns
import net.bobinski.portfolio.api.domain.service.ReturnBreakdown
import net.bobinski.portfolio.api.domain.service.ReturnMetric

@Serializable
data class PortfolioOverviewResponse(
    val asOf: String,
    val valuationState: String,
    val totalBookValuePln: String,
    val totalCurrentValuePln: String,
    val investedBookValuePln: String,
    val investedCurrentValuePln: String,
    val cashBalancePln: String,
    val cashBalances: List<CurrencyAmountResponse> = emptyList(),
    val netContributionsPln: String,
    val netContributionBalances: List<CurrencyAmountResponse> = emptyList(),
    val equityBookValuePln: String,
    val equityCurrentValuePln: String,
    val bondBookValuePln: String,
    val bondCurrentValuePln: String,
    val cashBookValuePln: String,
    val cashCurrentValuePln: String,
    val totalUnrealizedGainPln: String,
    val accountCount: Int,
    val instrumentCount: Int,
    val activeHoldingCount: Int,
    val valuedHoldingCount: Int,
    val unvaluedHoldingCount: Int,
    val valuationIssueCount: Int,
    val missingFxTransactions: Int,
    val unsupportedCorrectionTransactions: Int,
    val totalPreviousCloseValuePln: String? = null
)

@Serializable
data class HoldingResponse(
    val accountId: String,
    val accountName: String,
    val instrumentId: String,
    val instrumentName: String,
    val kind: String,
    val assetClass: String,
    val currency: String,
    val quantity: String,
    val averageCostPerUnitPln: String,
    val costBasisPln: String,
    val bookValuePln: String,
    val currentPriceNative: String?,
    val currentPricePln: String?,
    val currentValuePln: String?,
    val unrealizedGainPln: String?,
    val valuedAt: String?,
    val valuationStatus: String,
    val valuationIssue: String?,
    val transactionCount: Int,
    val edoLots: List<HoldingEdoLotResponse> = emptyList()
)

@Serializable
data class HoldingEdoLotResponse(
    val purchaseDate: String,
    val quantity: String,
    val costBasisPln: String,
    val currentPriceNative: String?,
    val currentPricePln: String?,
    val currentValuePln: String?,
    val unrealizedGainPln: String?,
    val valuedAt: String?,
    val valuationStatus: String,
    val valuationIssue: String?,
    val currentRatePercent: String? = null
)

@Serializable
data class PortfolioAccountResponse(
    val accountId: String,
    val accountName: String,
    val institution: String,
    val type: String,
    val baseCurrency: String,
    val valuationState: String,
    val totalBookValuePln: String,
    val totalCurrentValuePln: String,
    val investedBookValuePln: String,
    val investedCurrentValuePln: String,
    val cashBalancePln: String,
    val cashBalances: List<CurrencyAmountResponse> = emptyList(),
    val netContributionsPln: String,
    val netContributionBalances: List<CurrencyAmountResponse> = emptyList(),
    val totalUnrealizedGainPln: String,
    val portfolioWeightPct: String,
    val activeHoldingCount: Int,
    val valuedHoldingCount: Int,
    val valuationIssueCount: Int
)

@Serializable
data class CurrencyAmountResponse(
    val currency: String,
    val amount: String,
    val bookValuePln: String
)

@Serializable
data class PortfolioDailyHistoryResponse(
    val from: String,
    val until: String,
    val valuationState: String,
    val instrumentHistoryIssueCount: Int,
    val referenceSeriesIssueCount: Int,
    val benchmarkSeriesIssueCount: Int,
    val benchmarkStatuses: List<BenchmarkStatusResponse> = emptyList(),
    val missingFxTransactions: Int,
    val unsupportedCorrectionTransactions: Int,
    val points: List<PortfolioDailyHistoryPointResponse>
)

@Serializable
data class PortfolioDailyHistoryPointResponse(
    val date: String,
    val totalBookValuePln: String,
    val totalCurrentValuePln: String,
    val netContributionsPln: String,
    val cashBalancePln: String,
    val totalCurrentValueUsd: String?,
    val netContributionsUsd: String?,
    val cashBalanceUsd: String?,
    val totalCurrentValueAu: String?,
    val netContributionsAu: String?,
    val cashBalanceAu: String?,
    val equityCurrentValuePln: String,
    val bondCurrentValuePln: String,
    val cashCurrentValuePln: String,
    val equityAllocationPct: String,
    val bondAllocationPct: String,
    val cashAllocationPct: String,
    val portfolioPerformanceIndex: String?,
    val benchmarkIndices: Map<String, String> = emptyMap(),
    val activeHoldingCount: Int,
    val valuedHoldingCount: Int
)

@Serializable
data class PortfolioReturnsResponse(
    val asOf: String,
    val periods: List<PortfolioReturnPeriodResponse>
)

@Serializable
data class PortfolioAllocationResponse(
    val asOf: String,
    val valuationState: String,
    val configured: Boolean,
    val toleranceBandPctPoints: String,
    val rebalancingMode: String,
    val targetWeightSumPct: String,
    val totalCurrentValuePln: String,
    val availableCashPln: String,
    val breachedBucketCount: Int,
    val largestBandBreachPctPoints: String?,
    val recommendedAction: String,
    val recommendedAssetClass: String?,
    val recommendedContributionPln: String,
    val remainingContributionGapPln: String,
    val fullRebalanceBuyAmountPln: String,
    val fullRebalanceSellAmountPln: String,
    val requiresSelling: Boolean,
    val buckets: List<PortfolioAllocationBucketResponse>
)

@Serializable
data class PortfolioContributionPlanResponse(
    val amountPln: String,
    val projected: PortfolioAllocationResponse,
    val buckets: List<PortfolioContributionPlanBucketResponse>
)

@Serializable
data class PortfolioAllocationBucketResponse(
    val assetClass: String,
    val currentValuePln: String,
    val currentWeightPct: String,
    val targetWeightPct: String?,
    val targetValuePln: String?,
    val driftPctPoints: String?,
    val gapValuePln: String?,
    val toleranceLowerPct: String?,
    val toleranceUpperPct: String?,
    val withinTolerance: Boolean,
    val suggestedContributionPln: String,
    val rebalanceAction: String,
    val status: String
)

@Serializable
data class PortfolioContributionPlanBucketResponse(
    val assetClass: String,
    val plannedContributionPln: String,
    val projectedValuePln: String,
    val projectedWeightPct: String,
    val projectedDriftPctPoints: String?,
    val projectedGapValuePln: String?,
    val projectedStatus: String
)

@Serializable
data class PortfolioReturnPeriodResponse(
    val key: String,
    val label: String,
    val requestedFrom: String,
    val from: String,
    val until: String,
    val clippedToInception: Boolean,
    val dayCount: Long,
    val nominalPln: ReturnMetricResponse?,
    val nominalUsd: ReturnMetricResponse?,
    val realPln: ReturnMetricResponse?,
    val inflationFrom: String?,
    val inflationUntil: String?,
    val inflationMultiplier: String?,
    val breakdown: ReturnBreakdownResponse?,
    val benchmarks: Array<BenchmarkComparisonResponse>
)

@Serializable
data class ReturnBreakdownResponse(
    val openingValuePln: String,
    val closingValuePln: String,
    val netChangePln: String,
    val netExternalFlowsPln: String,
    val interestAndCouponsPln: String,
    val feesPln: String,
    val taxesPln: String,
    val marketAndFxPln: String,
    val netInvestmentResultPln: String
)

@Serializable
data class ReturnMetricResponse(
    val moneyWeightedReturn: String,
    val annualizedMoneyWeightedReturn: String?,
    val timeWeightedReturn: String?,
    val annualizedTimeWeightedReturn: String?
)

@Serializable
data class BenchmarkComparisonResponse(
    val key: String,
    val label: String,
    val pinned: Boolean,
    val status: String,
    val issue: String?,
    val nominalPln: ReturnMetricResponse?,
    val excessTimeWeightedReturn: String?,
    val excessAnnualizedTimeWeightedReturn: String?
)

@Serializable
data class BenchmarkStatusResponse(
    val key: String,
    val label: String,
    val status: String,
    val issue: String?
)

internal fun PortfolioOverview.toResponse(): PortfolioOverviewResponse = PortfolioOverviewResponse(
    asOf = asOf.toString(),
    valuationState = valuationState.name,
    totalBookValuePln = totalBookValuePln.toPlainString(),
    totalCurrentValuePln = totalCurrentValuePln.toPlainString(),
    investedBookValuePln = investedBookValuePln.toPlainString(),
    investedCurrentValuePln = investedCurrentValuePln.toPlainString(),
    cashBalancePln = cashBalancePln.toPlainString(),
    cashBalances = cashBalances.map(CurrencyAmountSnapshot::toResponse),
    netContributionsPln = netContributionsPln.toPlainString(),
    netContributionBalances = netContributionBalances.map(CurrencyAmountSnapshot::toResponse),
    equityBookValuePln = equityBookValuePln.toPlainString(),
    equityCurrentValuePln = equityCurrentValuePln.toPlainString(),
    bondBookValuePln = bondBookValuePln.toPlainString(),
    bondCurrentValuePln = bondCurrentValuePln.toPlainString(),
    cashBookValuePln = cashBookValuePln.toPlainString(),
    cashCurrentValuePln = cashCurrentValuePln.toPlainString(),
    totalUnrealizedGainPln = totalUnrealizedGainPln.toPlainString(),
    accountCount = accountCount,
    instrumentCount = instrumentCount,
    activeHoldingCount = activeHoldingCount,
    valuedHoldingCount = valuedHoldingCount,
    unvaluedHoldingCount = unvaluedHoldingCount,
    valuationIssueCount = valuationIssueCount,
    missingFxTransactions = missingFxTransactions,
    unsupportedCorrectionTransactions = unsupportedCorrectionTransactions,
    totalPreviousCloseValuePln = totalPreviousCloseValuePln?.toPlainString()
)

internal fun HoldingSnapshot.toResponse(): HoldingResponse = HoldingResponse(
    accountId = accountId.toString(),
    accountName = accountName,
    instrumentId = instrumentId.toString(),
    instrumentName = instrumentName,
    kind = kind,
    assetClass = assetClass,
    currency = currency,
    quantity = quantity.toPlainString(),
    averageCostPerUnitPln = averageCostPerUnitPln.toPlainString(),
    costBasisPln = costBasisPln.toPlainString(),
    bookValuePln = bookValuePln.toPlainString(),
    currentPriceNative = currentPriceNative?.toPlainString(),
    currentPricePln = currentPricePln?.toPlainString(),
    currentValuePln = currentValuePln?.toPlainString(),
    unrealizedGainPln = unrealizedGainPln?.toPlainString(),
    valuedAt = valuedAt?.toString(),
    valuationStatus = valuationStatus.name,
    valuationIssue = valuationIssue,
    transactionCount = transactionCount,
    edoLots = edoLots.map { lot ->
        HoldingEdoLotResponse(
            purchaseDate = lot.purchaseDate.toString(),
            quantity = lot.quantity.toPlainString(),
            costBasisPln = lot.costBasisPln.toPlainString(),
            currentPriceNative = lot.currentPriceNative?.toPlainString(),
            currentPricePln = lot.currentPricePln?.toPlainString(),
            currentValuePln = lot.currentValuePln?.toPlainString(),
            unrealizedGainPln = lot.unrealizedGainPln?.toPlainString(),
            valuedAt = lot.valuedAt?.toString(),
            valuationStatus = lot.valuationStatus.name,
            valuationIssue = lot.valuationIssue,
            currentRatePercent = lot.currentRatePercent?.toPlainString()
        )
    }
)

internal fun PortfolioAccountSummary.toResponse(): PortfolioAccountResponse = PortfolioAccountResponse(
    accountId = accountId.toString(),
    accountName = accountName,
    institution = institution,
    type = type,
    baseCurrency = baseCurrency,
    valuationState = valuationState.name,
    totalBookValuePln = totalBookValuePln.toPlainString(),
    totalCurrentValuePln = totalCurrentValuePln.toPlainString(),
    investedBookValuePln = investedBookValuePln.toPlainString(),
    investedCurrentValuePln = investedCurrentValuePln.toPlainString(),
    cashBalancePln = cashBalancePln.toPlainString(),
    cashBalances = cashBalances.map(CurrencyAmountSnapshot::toResponse),
    netContributionsPln = netContributionsPln.toPlainString(),
    netContributionBalances = netContributionBalances.map(CurrencyAmountSnapshot::toResponse),
    totalUnrealizedGainPln = totalUnrealizedGainPln.toPlainString(),
    portfolioWeightPct = portfolioWeightPct.toPlainString(),
    activeHoldingCount = activeHoldingCount,
    valuedHoldingCount = valuedHoldingCount,
    valuationIssueCount = valuationIssueCount
)

internal fun CurrencyAmountSnapshot.toResponse(): CurrencyAmountResponse = CurrencyAmountResponse(
    currency = currency,
    amount = amount.toPlainString(),
    bookValuePln = bookValuePln.toPlainString()
)

internal fun PortfolioDailyHistory.toResponse(): PortfolioDailyHistoryResponse = PortfolioDailyHistoryResponse(
    from = from.toString(),
    until = until.toString(),
    valuationState = valuationState.name,
    instrumentHistoryIssueCount = instrumentHistoryIssueCount,
    referenceSeriesIssueCount = referenceSeriesIssueCount,
    benchmarkSeriesIssueCount = benchmarkSeriesIssueCount,
    benchmarkStatuses = benchmarkStatuses.map(BenchmarkSeriesHealth::toResponse),
    missingFxTransactions = missingFxTransactions,
    unsupportedCorrectionTransactions = unsupportedCorrectionTransactions,
    points = points.map { it.toResponse() }
)

internal fun PortfolioDailyHistoryPoint.toResponse(): PortfolioDailyHistoryPointResponse = PortfolioDailyHistoryPointResponse(
    date = date.toString(),
    totalBookValuePln = totalBookValuePln.toPlainString(),
    totalCurrentValuePln = totalCurrentValuePln.toPlainString(),
    netContributionsPln = netContributionsPln.toPlainString(),
    cashBalancePln = cashBalancePln.toPlainString(),
    totalCurrentValueUsd = totalCurrentValueUsd?.toPlainString(),
    netContributionsUsd = netContributionsUsd?.toPlainString(),
    cashBalanceUsd = cashBalanceUsd?.toPlainString(),
    totalCurrentValueAu = totalCurrentValueAu?.toPlainString(),
    netContributionsAu = netContributionsAu?.toPlainString(),
    cashBalanceAu = cashBalanceAu?.toPlainString(),
    equityCurrentValuePln = equityCurrentValuePln.toPlainString(),
    bondCurrentValuePln = bondCurrentValuePln.toPlainString(),
    cashCurrentValuePln = cashCurrentValuePln.toPlainString(),
    equityAllocationPct = equityAllocationPct.toPlainString(),
    bondAllocationPct = bondAllocationPct.toPlainString(),
    cashAllocationPct = cashAllocationPct.toPlainString(),
    portfolioPerformanceIndex = portfolioPerformanceIndex?.toPlainString(),
    benchmarkIndices = benchmarkIndices.mapValues { (_, value) -> value.toPlainString() },
    activeHoldingCount = activeHoldingCount,
    valuedHoldingCount = valuedHoldingCount
)

internal fun PortfolioReturns.toResponse(): PortfolioReturnsResponse = PortfolioReturnsResponse(
    asOf = asOf.toString(),
    periods = periods.map { it.toResponse() }
)

internal fun PortfolioAllocationSummary.toResponse(): PortfolioAllocationResponse = PortfolioAllocationResponse(
    asOf = asOf.toString(),
    valuationState = valuationState.name,
    configured = configured,
    toleranceBandPctPoints = toleranceBandPctPoints.toPlainString(),
    rebalancingMode = rebalancingMode.name,
    targetWeightSumPct = targetWeightSumPct.toPlainString(),
    totalCurrentValuePln = totalCurrentValuePln.toPlainString(),
    availableCashPln = availableCashPln.toPlainString(),
    breachedBucketCount = breachedBucketCount,
    largestBandBreachPctPoints = largestBandBreachPctPoints?.toPlainString(),
    recommendedAction = recommendedAction.name,
    recommendedAssetClass = recommendedAssetClass?.name,
    recommendedContributionPln = recommendedContributionPln.toPlainString(),
    remainingContributionGapPln = remainingContributionGapPln.toPlainString(),
    fullRebalanceBuyAmountPln = fullRebalanceBuyAmountPln.toPlainString(),
    fullRebalanceSellAmountPln = fullRebalanceSellAmountPln.toPlainString(),
    requiresSelling = requiresSelling,
    buckets = buckets.map { it.toResponse() }
)

internal fun PortfolioContributionPlan.toResponse(): PortfolioContributionPlanResponse = PortfolioContributionPlanResponse(
    amountPln = amountPln.toPlainString(),
    projected = projected.toResponse(),
    buckets = buckets.map { it.toResponse() }
)

internal fun PortfolioAllocationBucket.toResponse(): PortfolioAllocationBucketResponse = PortfolioAllocationBucketResponse(
    assetClass = assetClass.name,
    currentValuePln = currentValuePln.toPlainString(),
    currentWeightPct = currentWeightPct.toPlainString(),
    targetWeightPct = targetWeightPct?.toPlainString(),
    targetValuePln = targetValuePln?.toPlainString(),
    driftPctPoints = driftPctPoints?.toPlainString(),
    gapValuePln = gapValuePln?.toPlainString(),
    toleranceLowerPct = toleranceLowerPct?.toPlainString(),
    toleranceUpperPct = toleranceUpperPct?.toPlainString(),
    withinTolerance = withinTolerance,
    suggestedContributionPln = suggestedContributionPln.toPlainString(),
    rebalanceAction = rebalanceAction.name,
    status = status.name
)

internal fun PortfolioContributionPlanBucket.toResponse(): PortfolioContributionPlanBucketResponse = PortfolioContributionPlanBucketResponse(
    assetClass = assetClass.name,
    plannedContributionPln = plannedContributionPln.toPlainString(),
    projectedValuePln = projectedValuePln.toPlainString(),
    projectedWeightPct = projectedWeightPct.toPlainString(),
    projectedDriftPctPoints = projectedDriftPctPoints?.toPlainString(),
    projectedGapValuePln = projectedGapValuePln?.toPlainString(),
    projectedStatus = projectedStatus.name
)

internal fun PortfolioReturnPeriod.toResponse(): PortfolioReturnPeriodResponse = PortfolioReturnPeriodResponse(
    key = key.name,
    label = label,
    requestedFrom = requestedFrom.toString(),
    from = from.toString(),
    until = until.toString(),
    clippedToInception = clippedToInception,
    dayCount = dayCount,
    nominalPln = nominalPln?.toResponse(),
    nominalUsd = nominalUsd?.toResponse(),
    realPln = realPln?.toResponse(),
    inflationFrom = inflation?.from?.toString(),
    inflationUntil = inflation?.until?.toString(),
    inflationMultiplier = inflation?.multiplier?.toPlainString(),
    breakdown = breakdown?.toResponse(),
    benchmarks = benchmarks.map { it.toResponse() }.toTypedArray()
)

internal fun ReturnBreakdown.toResponse(): ReturnBreakdownResponse = ReturnBreakdownResponse(
    openingValuePln = openingValuePln.toPlainString(),
    closingValuePln = closingValuePln.toPlainString(),
    netChangePln = netChangePln.toPlainString(),
    netExternalFlowsPln = netExternalFlowsPln.toPlainString(),
    interestAndCouponsPln = interestAndCouponsPln.toPlainString(),
    feesPln = feesPln.toPlainString(),
    taxesPln = taxesPln.toPlainString(),
    marketAndFxPln = marketAndFxPln.toPlainString(),
    netInvestmentResultPln = netInvestmentResultPln.toPlainString()
)

internal fun ReturnMetric.toResponse(): ReturnMetricResponse = ReturnMetricResponse(
    moneyWeightedReturn = moneyWeightedReturn.toPlainString(),
    annualizedMoneyWeightedReturn = annualizedMoneyWeightedReturn?.toPlainString(),
    timeWeightedReturn = timeWeightedReturn?.toPlainString(),
    annualizedTimeWeightedReturn = annualizedTimeWeightedReturn?.toPlainString()
)

internal fun BenchmarkComparison.toResponse(): BenchmarkComparisonResponse = BenchmarkComparisonResponse(
    key = key.name,
    label = label,
    pinned = pinned,
    status = status.name,
    issue = issue,
    nominalPln = nominalPln?.toResponse(),
    excessTimeWeightedReturn = excessTimeWeightedReturn?.toPlainString(),
    excessAnnualizedTimeWeightedReturn = excessAnnualizedTimeWeightedReturn?.toPlainString()
)

internal fun BenchmarkSeriesHealth.toResponse(): BenchmarkStatusResponse = BenchmarkStatusResponse(
    key = key.name,
    label = label,
    status = status.name,
    issue = issue
)
