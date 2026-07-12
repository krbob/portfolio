package net.bobinski.portfolio.api.readmodel

import java.time.Clock
import java.time.Instant
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import net.bobinski.portfolio.api.domain.model.AuditEventCategory
import net.bobinski.portfolio.api.domain.model.AuditEventOutcome
import net.bobinski.portfolio.api.domain.service.AuditLogService
import net.bobinski.portfolio.api.domain.service.BenchmarkComparison
import net.bobinski.portfolio.api.domain.service.DrawdownEpisode
import net.bobinski.portfolio.api.domain.service.DrawdownObservation
import net.bobinski.portfolio.api.domain.service.PortfolioDailyHistory
import net.bobinski.portfolio.api.domain.service.PortfolioDailyHistoryPoint
import net.bobinski.portfolio.api.domain.service.PortfolioDrawdowns
import net.bobinski.portfolio.api.domain.service.PortfolioHistoryService
import net.bobinski.portfolio.api.domain.service.PortfolioReadModelCacheDescriptorService
import net.bobinski.portfolio.api.domain.service.ReturnBreakdown
import net.bobinski.portfolio.api.domain.service.PortfolioReturnPeriod
import net.bobinski.portfolio.api.domain.service.PortfolioReturns
import net.bobinski.portfolio.api.domain.service.PortfolioReturnsService
import net.bobinski.portfolio.api.domain.service.ReadModelCacheService
import net.bobinski.portfolio.api.domain.service.ReturnMetric
import net.bobinski.portfolio.api.domain.service.RollingReturnObservation
import net.bobinski.portfolio.api.domain.service.RollingReturnWindow
import net.bobinski.portfolio.api.notification.PortfolioAlertService
import net.bobinski.portfolio.api.readmodel.config.ReadModelRefreshConfig
import net.bobinski.portfolio.api.route.BenchmarkComparisonResponse
import net.bobinski.portfolio.api.route.BenchmarkStatusResponse
import net.bobinski.portfolio.api.route.DrawdownEpisodeResponse
import net.bobinski.portfolio.api.route.DrawdownObservationResponse
import net.bobinski.portfolio.api.route.PortfolioDailyHistoryPointResponse
import net.bobinski.portfolio.api.route.PortfolioDailyHistoryResponse
import net.bobinski.portfolio.api.route.PortfolioDrawdownsResponse
import net.bobinski.portfolio.api.route.PortfolioReturnPeriodResponse
import net.bobinski.portfolio.api.route.PortfolioReturnsResponse
import net.bobinski.portfolio.api.route.ReturnBreakdownResponse
import net.bobinski.portfolio.api.route.ReturnMetricResponse
import net.bobinski.portfolio.api.route.RollingReturnObservationResponse
import net.bobinski.portfolio.api.route.RollingReturnWindowResponse
import org.slf4j.LoggerFactory

class ReadModelRefreshService(
    private val config: ReadModelRefreshConfig,
    private val readModelCacheService: ReadModelCacheService,
    private val descriptorService: PortfolioReadModelCacheDescriptorService,
    private val portfolioHistoryService: PortfolioHistoryService,
    private val portfolioReturnsService: PortfolioReturnsService,
    private val portfolioAlertService: PortfolioAlertService? = null,
    private val auditLogService: AuditLogService,
    private val clock: Clock
) {
    private val logger = LoggerFactory.getLogger(ReadModelRefreshService::class.java)
    private val mutex = Mutex()

    @Volatile
    private var running: Boolean = false

    @Volatile
    private var lastRunAt: Instant? = null

    @Volatile
    private var lastSuccessAt: Instant? = null

    @Volatile
    private var lastFailureAt: Instant? = null

    @Volatile
    private var lastFailureMessage: String? = null

    @Volatile
    private var lastTrigger: ReadModelRefreshTrigger? = null

    @Volatile
    private var lastDurationMs: Long? = null

    suspend fun status(): ReadModelRefreshStatus = ReadModelRefreshStatus(
        schedulerEnabled = config.enabled,
        intervalMinutes = config.intervalMinutes,
        runOnStart = config.runOnStart,
        running = running,
        lastRunAt = lastRunAt,
        lastSuccessAt = lastSuccessAt,
        lastFailureAt = lastFailureAt,
        lastFailureMessage = lastFailureMessage,
        lastTrigger = lastTrigger,
        lastDurationMs = lastDurationMs,
        modelNames = MODEL_NAMES
    )

    suspend fun runManualRefresh(): ReadModelRefreshRunResult = runRefresh(ReadModelRefreshTrigger.MANUAL)

    suspend fun runScheduledRefresh(): ReadModelRefreshRunResult = runRefresh(ReadModelRefreshTrigger.SCHEDULED)

    suspend fun runStartupRefresh(): ReadModelRefreshRunResult = runRefresh(ReadModelRefreshTrigger.STARTUP)

    private suspend fun runRefresh(trigger: ReadModelRefreshTrigger): ReadModelRefreshRunResult = mutex.withLock {
        val startedAt = Instant.now(clock)
        running = true
        lastRunAt = startedAt
        lastTrigger = trigger

        return try {
            val returns = refreshAnalyticsSnapshots()

            val alertDispatchResult = portfolioAlertService?.let { service ->
                runCatching {
                    service.dispatchNewAlerts(prefetchedReturns = returns)
                }.onFailure { error ->
                    if (error is CancellationException) {
                        throw error
                    }
                    logger.warn("Portfolio alert dispatch failed after read-model refresh.", error)
                }.getOrNull()
            }

            val finishedAt = Instant.now(clock)
            val durationMs = finishedAt.toEpochMilli() - startedAt.toEpochMilli()
            lastSuccessAt = finishedAt
            lastFailureAt = null
            lastFailureMessage = null
            lastDurationMs = durationMs

            auditLogService.record(
                category = AuditEventCategory.SYSTEM,
                action = "READ_MODEL_REFRESH_COMPLETED",
                entityType = "READ_MODEL_REFRESH",
                message = "Refreshed cached portfolio history and returns.",
                metadata = mapOf(
                    "trigger" to trigger.name,
                    "modelNames" to MODEL_NAMES.joinToString(","),
                    "durationMs" to durationMs.toString(),
                    "activeAlertCount" to (alertDispatchResult?.activeAlertCount?.toString() ?: "unknown"),
                    "newAlertCount" to (alertDispatchResult?.newAlertCount?.toString() ?: "unknown")
                )
            )

            ReadModelRefreshRunResult(
                trigger = trigger,
                completedAt = finishedAt,
                durationMs = durationMs,
                refreshedModelCount = MODEL_NAMES.size,
                modelNames = MODEL_NAMES
            )
        } catch (exception: CancellationException) {
            throw exception
        } catch (exception: Exception) {
            val failedAt = Instant.now(clock)
            val durationMs = failedAt.toEpochMilli() - startedAt.toEpochMilli()
            lastFailureAt = failedAt
            lastFailureMessage = exception.message ?: "Read-model refresh failed."
            lastDurationMs = durationMs

            auditLogService.record(
                category = AuditEventCategory.SYSTEM,
                action = "READ_MODEL_REFRESH_FAILED",
                outcome = AuditEventOutcome.FAILURE,
                entityType = "READ_MODEL_REFRESH",
                message = "Read-model refresh failed.",
                metadata = mapOf(
                    "trigger" to trigger.name,
                    "durationMs" to durationMs.toString(),
                    "failureMessage" to (exception.message ?: "Read-model refresh failed.")
                )
            )
            throw exception
        } finally {
            running = false
        }
    }

    private suspend fun refreshAnalyticsSnapshots(): PortfolioReturns {
        val dailyHistoryDescriptor = descriptorService.dailyHistoryDescriptor()
        val dailyHistory = portfolioHistoryService.dailyHistory(forceRefresh = true)
        readModelCacheService.forceRefresh(
            descriptor = dailyHistoryDescriptor,
            serializer = PortfolioDailyHistoryResponse.serializer()
        ) {
            dailyHistory.toRefreshResponse()
        }

        val returnsDescriptor = descriptorService.returnsDescriptor()
        val returns = portfolioReturnsService.returns(dailyHistory)
        readModelCacheService.forceRefresh(
            descriptor = returnsDescriptor,
            serializer = PortfolioReturnsResponse.serializer()
        ) {
            returns.toRefreshResponse()
        }
        return returns
    }

    companion object {
        private val MODEL_NAMES = listOf("DAILY_HISTORY", "RETURNS")
    }
}

data class ReadModelRefreshStatus(
    val schedulerEnabled: Boolean,
    val intervalMinutes: Long,
    val runOnStart: Boolean,
    val running: Boolean,
    val lastRunAt: Instant?,
    val lastSuccessAt: Instant?,
    val lastFailureAt: Instant?,
    val lastFailureMessage: String?,
    val lastTrigger: ReadModelRefreshTrigger?,
    val lastDurationMs: Long?,
    val modelNames: List<String>
)

data class ReadModelRefreshRunResult(
    val trigger: ReadModelRefreshTrigger,
    val completedAt: Instant,
    val durationMs: Long,
    val refreshedModelCount: Int,
    val modelNames: List<String>
)

enum class ReadModelRefreshTrigger {
    MANUAL,
    SCHEDULED,
    STARTUP
}

private fun PortfolioDailyHistory.toRefreshResponse(): PortfolioDailyHistoryResponse = PortfolioDailyHistoryResponse(
    from = from.toString(),
    until = until.toString(),
    valuationState = valuationState.name,
    instrumentHistoryIssueCount = instrumentHistoryIssueCount,
    referenceSeriesIssueCount = referenceSeriesIssueCount,
    benchmarkSeriesIssueCount = benchmarkSeriesIssueCount,
    benchmarkStatuses = benchmarkStatuses.map { status ->
        BenchmarkStatusResponse(
            key = status.key,
            label = status.label,
            status = status.status.name,
            issue = status.issue
        )
    },
    missingFxTransactions = missingFxTransactions,
    unsupportedCorrectionTransactions = unsupportedCorrectionTransactions,
    points = points.map(PortfolioDailyHistoryPoint::toRefreshResponse)
)

private fun PortfolioDailyHistoryPoint.toRefreshResponse(): PortfolioDailyHistoryPointResponse = PortfolioDailyHistoryPointResponse(
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
    benchmarkIndices = benchmarkIndices.mapValues { (_, v) -> v.toPlainString() },
    activeHoldingCount = activeHoldingCount,
    valuedHoldingCount = valuedHoldingCount
)

private fun PortfolioReturns.toRefreshResponse(): PortfolioReturnsResponse = PortfolioReturnsResponse(
    asOf = asOf.toString(),
    periods = periods.map(PortfolioReturnPeriod::toRefreshResponse),
    rollingReturns = rollingReturns.map(RollingReturnWindow::toRefreshResponse),
    drawdowns = drawdowns.toRefreshResponse()
)

private fun PortfolioReturnPeriod.toRefreshResponse(): PortfolioReturnPeriodResponse = PortfolioReturnPeriodResponse(
    key = key.name,
    label = label,
    requestedFrom = requestedFrom.toString(),
    from = from.toString(),
    until = until.toString(),
    clippedToInception = clippedToInception,
    dayCount = dayCount,
    nominalPln = nominalPln?.toRefreshResponse(),
    nominalUsd = nominalUsd?.toRefreshResponse(),
    realPln = realPln?.toRefreshResponse(),
    inflationFrom = inflation?.from?.toString(),
    inflationUntil = inflation?.until?.toString(),
    inflationMultiplier = inflation?.multiplier?.toPlainString(),
    breakdown = breakdown?.toRefreshResponse(),
    benchmarks = benchmarks.map(BenchmarkComparison::toRefreshResponse).toTypedArray()
)

private fun ReturnBreakdown.toRefreshResponse(): ReturnBreakdownResponse = ReturnBreakdownResponse(
    openingValuePln = openingValuePln.toPlainString(),
    closingValuePln = closingValuePln.toPlainString(),
    netChangePln = netChangePln.toPlainString(),
    netExternalFlowsPln = netExternalFlowsPln.toPlainString(),
    interestAndCouponsPln = interestAndCouponsPln.toPlainString(),
    feesPln = feesPln.toPlainString(),
    taxesPln = taxesPln.toPlainString(),
    marketAndFxPln = marketAndFxPln.toPlainString(),
    netInvestmentResultPln = netInvestmentResultPln.toPlainString(),
    skippedFxTransactionCount = skippedFxTransactionCount
)

private fun ReturnMetric.toRefreshResponse(): ReturnMetricResponse = ReturnMetricResponse(
    moneyWeightedReturn = moneyWeightedReturn.toPlainString(),
    annualizedMoneyWeightedReturn = annualizedMoneyWeightedReturn?.toPlainString(),
    timeWeightedReturn = timeWeightedReturn?.toPlainString(),
    annualizedTimeWeightedReturn = annualizedTimeWeightedReturn?.toPlainString()
)

private fun RollingReturnWindow.toRefreshResponse(): RollingReturnWindowResponse = RollingReturnWindowResponse(
    key = key.name,
    label = label,
    years = years,
    observationCount = observationCount,
    latest = latest?.toRefreshResponse(),
    best = best?.toRefreshResponse(),
    worst = worst?.toRefreshResponse(),
    observations = observations.map(RollingReturnObservation::toRefreshResponse)
)

private fun RollingReturnObservation.toRefreshResponse(): RollingReturnObservationResponse =
    RollingReturnObservationResponse(
        from = from.toString(),
        until = until.toString(),
        dayCount = dayCount,
        totalReturn = totalReturn.toPlainString(),
        annualizedReturn = annualizedReturn?.toPlainString()
    )

private fun PortfolioDrawdowns.toRefreshResponse(): PortfolioDrawdownsResponse = PortfolioDrawdownsResponse(
    current = current?.toRefreshResponse(),
    max = max?.toRefreshResponse(),
    observations = observations.map(DrawdownObservation::toRefreshResponse),
    episodes = episodes.map(DrawdownEpisode::toRefreshResponse)
)

private fun DrawdownObservation.toRefreshResponse(): DrawdownObservationResponse = DrawdownObservationResponse(
    date = date.toString(),
    peakDate = peakDate.toString(),
    peakIndex = peakIndex.toPlainString(),
    index = index.toPlainString(),
    drawdown = drawdown.toPlainString()
)

private fun DrawdownEpisode.toRefreshResponse(): DrawdownEpisodeResponse = DrawdownEpisodeResponse(
    peakDate = peakDate.toString(),
    startDate = startDate.toString(),
    troughDate = troughDate.toString(),
    recoveredDate = recoveredDate?.toString(),
    depth = depth.toPlainString(),
    durationDays = durationDays,
    recoveryDays = recoveryDays,
    status = status.name
)

private fun BenchmarkComparison.toRefreshResponse(): BenchmarkComparisonResponse = BenchmarkComparisonResponse(
    key = key,
    label = label,
    pinned = pinned,
    status = status.name,
    issue = issue,
    nominalPln = nominalPln?.toRefreshResponse(),
    excessTimeWeightedReturn = excessTimeWeightedReturn?.toPlainString(),
    excessAnnualizedTimeWeightedReturn = excessAnnualizedTimeWeightedReturn?.toPlainString()
)
