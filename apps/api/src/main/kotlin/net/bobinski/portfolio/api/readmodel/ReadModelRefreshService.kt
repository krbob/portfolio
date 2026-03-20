package net.bobinski.portfolio.api.readmodel

import java.time.Clock
import java.time.Instant
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import net.bobinski.portfolio.api.domain.model.AuditEventCategory
import net.bobinski.portfolio.api.domain.service.AuditLogService
import net.bobinski.portfolio.api.domain.service.BenchmarkComparison
import net.bobinski.portfolio.api.domain.service.PortfolioDailyHistory
import net.bobinski.portfolio.api.domain.service.PortfolioDailyHistoryPoint
import net.bobinski.portfolio.api.domain.service.PortfolioHistoryService
import net.bobinski.portfolio.api.domain.service.PortfolioReadModelCacheDescriptorService
import net.bobinski.portfolio.api.domain.service.PortfolioReturnPeriod
import net.bobinski.portfolio.api.domain.service.PortfolioReturns
import net.bobinski.portfolio.api.domain.service.PortfolioReturnsService
import net.bobinski.portfolio.api.domain.service.ReadModelCacheService
import net.bobinski.portfolio.api.domain.service.ReturnMetric
import net.bobinski.portfolio.api.readmodel.config.ReadModelRefreshConfig
import net.bobinski.portfolio.api.route.BenchmarkComparisonResponse
import net.bobinski.portfolio.api.route.PortfolioDailyHistoryPointResponse
import net.bobinski.portfolio.api.route.PortfolioDailyHistoryResponse
import net.bobinski.portfolio.api.route.PortfolioReturnPeriodResponse
import net.bobinski.portfolio.api.route.PortfolioReturnsResponse
import net.bobinski.portfolio.api.route.ReturnMetricResponse

class ReadModelRefreshService(
    private val config: ReadModelRefreshConfig,
    private val readModelCacheService: ReadModelCacheService,
    private val descriptorService: PortfolioReadModelCacheDescriptorService,
    private val portfolioHistoryService: PortfolioHistoryService,
    private val portfolioReturnsService: PortfolioReturnsService,
    private val auditLogService: AuditLogService,
    private val clock: Clock
) {
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
            val dailyHistoryDescriptor = descriptorService.dailyHistoryDescriptor()
            readModelCacheService.forceRefresh(
                descriptor = dailyHistoryDescriptor,
                serializer = PortfolioDailyHistoryResponse.serializer()
            ) {
                portfolioHistoryService.dailyHistory().toRefreshResponse()
            }

            val returnsDescriptor = descriptorService.returnsDescriptor()
            readModelCacheService.forceRefresh(
                descriptor = returnsDescriptor,
                serializer = PortfolioReturnsResponse.serializer()
            ) {
                portfolioReturnsService.returns().toRefreshResponse()
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
                    "durationMs" to durationMs.toString()
                )
            )

            ReadModelRefreshRunResult(
                trigger = trigger,
                completedAt = finishedAt,
                durationMs = durationMs,
                refreshedModelCount = MODEL_NAMES.size,
                modelNames = MODEL_NAMES
            )
        } catch (exception: Exception) {
            val failedAt = Instant.now(clock)
            val durationMs = failedAt.toEpochMilli() - startedAt.toEpochMilli()
            lastFailureAt = failedAt
            lastFailureMessage = exception.message ?: "Read-model refresh failed."
            lastDurationMs = durationMs

            auditLogService.record(
                category = AuditEventCategory.SYSTEM,
                action = "READ_MODEL_REFRESH_FAILED",
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
    equityBenchmarkIndex = equityBenchmarkIndex?.toPlainString(),
    inflationBenchmarkIndex = inflationBenchmarkIndex?.toPlainString(),
    targetMixBenchmarkIndex = targetMixBenchmarkIndex?.toPlainString(),
    activeHoldingCount = activeHoldingCount,
    valuedHoldingCount = valuedHoldingCount
)

private fun PortfolioReturns.toRefreshResponse(): PortfolioReturnsResponse = PortfolioReturnsResponse(
    asOf = asOf.toString(),
    periods = periods.map(PortfolioReturnPeriod::toRefreshResponse)
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
    benchmarks = benchmarks.map(BenchmarkComparison::toRefreshResponse).toTypedArray()
)

private fun ReturnMetric.toRefreshResponse(): ReturnMetricResponse = ReturnMetricResponse(
    moneyWeightedReturn = moneyWeightedReturn.toPlainString(),
    annualizedMoneyWeightedReturn = annualizedMoneyWeightedReturn?.toPlainString(),
    timeWeightedReturn = timeWeightedReturn?.toPlainString(),
    annualizedTimeWeightedReturn = annualizedTimeWeightedReturn?.toPlainString()
)

private fun BenchmarkComparison.toRefreshResponse(): BenchmarkComparisonResponse = BenchmarkComparisonResponse(
    key = key.name,
    label = label,
    pinned = pinned,
    nominalPln = nominalPln?.toRefreshResponse(),
    excessTimeWeightedReturn = excessTimeWeightedReturn?.toPlainString(),
    excessAnnualizedTimeWeightedReturn = excessAnnualizedTimeWeightedReturn?.toPlainString()
)
