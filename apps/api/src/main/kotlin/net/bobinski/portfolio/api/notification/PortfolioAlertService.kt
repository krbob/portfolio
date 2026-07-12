package net.bobinski.portfolio.api.notification

import java.math.BigDecimal
import java.math.RoundingMode
import java.time.Clock
import java.time.Instant
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.Serializable
import net.bobinski.portfolio.api.domain.model.AssetClass
import net.bobinski.portfolio.api.domain.service.BenchmarkComparison
import net.bobinski.portfolio.api.domain.service.BenchmarkKey
import net.bobinski.portfolio.api.domain.service.OperationalStateKeys
import net.bobinski.portfolio.api.domain.service.OperationalStateService
import net.bobinski.portfolio.api.domain.service.PortfolioAllocationBucket
import net.bobinski.portfolio.api.domain.service.PortfolioAllocationService
import net.bobinski.portfolio.api.domain.service.PortfolioOverview
import net.bobinski.portfolio.api.domain.service.PortfolioReadModelService
import net.bobinski.portfolio.api.domain.service.PortfolioReturnPeriod
import net.bobinski.portfolio.api.domain.service.PortfolioReturns
import net.bobinski.portfolio.api.domain.service.PortfolioReturnsService
import net.bobinski.portfolio.api.domain.service.ReturnPeriodKey
import net.bobinski.portfolio.api.domain.service.ValuationState

class PortfolioAlertService(
    private val alertSettingsService: PortfolioAlertSettingsService,
    private val portfolioReadModelService: PortfolioReadModelService,
    private val portfolioAllocationService: PortfolioAllocationService,
    private val portfolioReturnsService: PortfolioReturnsService,
    private val operationalStateService: OperationalStateService,
    private val pushNotifier: PortfolioPushNotifier,
    private val clock: Clock
) {
    private val dispatchMutex = Mutex()

    suspend fun currentAlerts(): List<PortfolioAlert> = currentAlerts(prefetchedReturns = null)

    private suspend fun currentAlerts(prefetchedReturns: PortfolioReturns?): List<PortfolioAlert> {
        val settings = alertSettingsService.settings()
        if (!settings.enabled) {
            return emptyList()
        }

        val observedAt = Instant.now(clock)
        var sharedOverview: PortfolioOverview? = null
        suspend fun overview(): PortfolioOverview = sharedOverview
            ?: portfolioReadModelService.overview().also { sharedOverview = it }

        return buildList {
            if (settings.typeEnabled(PortfolioAlertType.MARKET_DATA_STALE)) {
                addAll(staleMarketDataAlerts(observedAt = observedAt, loadOverview = ::overview))
            }
            if (settings.typeEnabled(PortfolioAlertType.ALLOCATION_DRIFT)) {
                addAll(
                    allocationDriftAlerts(
                        settings = settings,
                        observedAt = observedAt,
                        loadOverview = ::overview
                    )
                )
            }
            if (settings.typeEnabled(PortfolioAlertType.BENCHMARK_UNDERPERFORMANCE)) {
                addAll(
                    benchmarkUnderperformanceAlerts(
                        settings = settings,
                        observedAt = observedAt,
                        prefetchedReturns = prefetchedReturns
                    )
                )
            }
        }.sortedWith(compareByDescending<PortfolioAlert> { it.severity }.thenBy { it.id })
    }

    suspend fun dispatchNewAlerts(): PortfolioAlertDispatchResult = dispatchNewAlertsInternal(prefetchedReturns = null)

    suspend fun dispatchNewAlerts(prefetchedReturns: PortfolioReturns): PortfolioAlertDispatchResult =
        dispatchNewAlertsInternal(prefetchedReturns = prefetchedReturns)

    private suspend fun dispatchNewAlertsInternal(prefetchedReturns: PortfolioReturns?): PortfolioAlertDispatchResult =
        dispatchMutex.withLock {
            val settings = alertSettingsService.settings()
            val alerts = currentAlerts(prefetchedReturns = prefetchedReturns)
            val previousState = operationalStateService.get(
                key = OperationalStateKeys.ACTIVE_ALERTS,
                serializer = PortfolioAlertState.serializer(),
                defaultValue = { PortfolioAlertState(activeAlertIds = emptyList()) }
            )
            val previousIds = previousState.activeAlertIds.toSet()
            val newAlerts = alerts.filterNot { alert -> alert.id in previousIds }

            val pushResult = when {
                !settings.pushEnabled -> WebPushDispatchResult.empty()
                newAlerts.isEmpty() -> pushNotifier.send(emptyList())
                else -> pushNotifier.send(newAlerts)
            }

            if (shouldStoreActiveAlertState(newAlerts, pushResult)) {
                storeActiveAlertState(alerts)
            }

            return PortfolioAlertDispatchResult(
                activeAlertCount = alerts.size,
                newAlertCount = newAlerts.size,
                push = pushResult
            )
        }

    private suspend fun staleMarketDataAlerts(
        observedAt: Instant,
        loadOverview: suspend () -> PortfolioOverview
    ): List<PortfolioAlert> =
        alertSection(PortfolioAlertType.MARKET_DATA_STALE) {
            val overview = loadOverview()
            if (overview.valuationState != ValuationState.STALE) {
                return@alertSection emptyList()
            }

            listOf(
                PortfolioAlert(
                    id = "market-data:stale",
                    type = PortfolioAlertType.MARKET_DATA_STALE,
                    severity = PortfolioAlertSeverity.WARNING,
                    content = PortfolioAlertContent.MarketDataStale(
                        valuedHoldingCount = overview.valuedHoldingCount,
                        activeHoldingCount = overview.activeHoldingCount
                    ),
                    route = "/system/market-data",
                    observedAt = observedAt
                )
            )
        }

    private suspend fun allocationDriftAlerts(
        settings: PortfolioAlertSettings,
        observedAt: Instant,
        loadOverview: suspend () -> PortfolioOverview
    ): List<PortfolioAlert> =
        alertSection(PortfolioAlertType.ALLOCATION_DRIFT) {
            val overview = loadOverview()
            val summary = portfolioAllocationService.summary(overview)
            summary.buckets
                .filter { bucket ->
                    bucket.driftPctPoints?.absGreaterOrEqual(settings.allocationDriftThresholdPctPoints) == true
                }
                .map { bucket ->
                    PortfolioAlert(
                        id = "allocation:${bucket.assetClass.name}",
                        type = PortfolioAlertType.ALLOCATION_DRIFT,
                        severity = PortfolioAlertSeverity.WARNING,
                        content = PortfolioAlertContent.AllocationDrift(
                            assetClass = bucket.assetClass,
                            driftPctPoints = requireNotNull(bucket.driftPctPoints).toPlainString(),
                            thresholdPctPoints = settings.allocationDriftThresholdPctPoints.toPlainString()
                        ),
                        route = "/strategy/targets",
                        observedAt = observedAt
                    )
                }
        }

    private suspend fun benchmarkUnderperformanceAlerts(
        settings: PortfolioAlertSettings,
        observedAt: Instant,
        prefetchedReturns: PortfolioReturns?
    ): List<PortfolioAlert> =
        alertSection(PortfolioAlertType.BENCHMARK_UNDERPERFORMANCE) {
            val returns = prefetchedReturns ?: portfolioReturnsService.returns()
            val period = returns.periods.firstOrNull { it.key == ReturnPeriodKey.ONE_YEAR }
                ?: returns.periods.firstOrNull { it.key == ReturnPeriodKey.MAX }
                ?: return@alertSection emptyList()
            val thresholdRate = settings.benchmarkUnderperformanceThresholdPctPoints
                .divide(HUNDRED, 10, RoundingMode.HALF_UP)
                .negate()

            period.benchmarks
                .asSequence()
                .filter { benchmark -> isBenchmarkUnderperformanceAlertBenchmark(benchmark.key) }
                .filter { benchmark -> benchmark.excessTimeWeightedReturn?.let { it <= thresholdRate } == true }
                .map { benchmark -> benchmark.toAlert(period, observedAt) }
                .toList()
        }

    private suspend fun storeActiveAlertState(alerts: List<PortfolioAlert>) {
        operationalStateService.put(
            key = OperationalStateKeys.ACTIVE_ALERTS,
            serializer = PortfolioAlertState.serializer(),
            value = PortfolioAlertState(activeAlertIds = alerts.map(PortfolioAlert::id))
        )
    }

    private fun shouldStoreActiveAlertState(
        newAlerts: List<PortfolioAlert>,
        pushResult: WebPushDispatchResult
    ): Boolean =
        newAlerts.isEmpty() ||
            !pushResult.enabled ||
            pushResult.subscriptionCount == 0 ||
            pushResult.failedCount == 0 ||
            pushResult.deliveredCount > 0

    private fun BenchmarkComparison.toAlert(
        period: PortfolioReturnPeriod,
        observedAt: Instant
    ): PortfolioAlert = PortfolioAlert(
        id = "benchmark:${period.key.name}:$key",
        type = PortfolioAlertType.BENCHMARK_UNDERPERFORMANCE,
        severity = PortfolioAlertSeverity.WARNING,
        content = PortfolioAlertContent.BenchmarkUnderperformance(
            periodLabel = period.label,
            benchmarkKey = key,
            benchmarkLabel = label,
            excessTimeWeightedReturnPctPoints = requireNotNull(excessTimeWeightedReturn).toPercentPointString()
        ),
        route = "/performance",
        observedAt = observedAt
    )

    private fun BigDecimal.absGreaterOrEqual(threshold: BigDecimal): Boolean = abs() >= threshold

    private fun BigDecimal.toPercentPointString(): String =
        multiply(HUNDRED).setScale(2, RoundingMode.HALF_UP).stripTrailingZeros().toPlainString()

    private companion object {
        val HUNDRED: BigDecimal = BigDecimal("100")
    }
}

internal suspend fun alertSection(
    type: PortfolioAlertType,
    block: suspend () -> List<PortfolioAlert>
): List<PortfolioAlert> = try {
    block()
} catch (error: CancellationException) {
    throw error
} catch (error: PortfolioAlertEvaluationException) {
    throw error
} catch (error: Exception) {
    throw PortfolioAlertEvaluationException(type = type, cause = error)
}

class PortfolioAlertEvaluationException(
    val type: PortfolioAlertType,
    cause: Throwable
) : IllegalStateException("Failed to evaluate ${type.name} portfolio alerts.", cause)

data class PortfolioAlert(
    val id: String,
    val type: PortfolioAlertType,
    val severity: PortfolioAlertSeverity,
    val content: PortfolioAlertContent,
    val route: String,
    val observedAt: Instant
)

sealed interface PortfolioAlertContent {
    data class MarketDataStale(
        val valuedHoldingCount: Int,
        val activeHoldingCount: Int
    ) : PortfolioAlertContent

    data class AllocationDrift(
        val assetClass: AssetClass,
        val driftPctPoints: String,
        val thresholdPctPoints: String
    ) : PortfolioAlertContent

    data class BenchmarkUnderperformance(
        val periodLabel: String,
        val benchmarkKey: String,
        val benchmarkLabel: String,
        val excessTimeWeightedReturnPctPoints: String
    ) : PortfolioAlertContent
}

data class PortfolioAlertDispatchResult(
    val activeAlertCount: Int,
    val newAlertCount: Int,
    val push: WebPushDispatchResult
)

enum class PortfolioAlertType {
    ALLOCATION_DRIFT,
    MARKET_DATA_STALE,
    BENCHMARK_UNDERPERFORMANCE
}

enum class PortfolioAlertSeverity {
    INFO,
    WARNING,
    CRITICAL
}

@Serializable
private data class PortfolioAlertState(
    val activeAlertIds: List<String>
)

internal fun isBenchmarkUnderperformanceAlertBenchmark(key: String): Boolean =
    key == BenchmarkKey.TARGET_MIX.name
