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
import net.bobinski.portfolio.api.domain.service.AppPreferenceService
import net.bobinski.portfolio.api.domain.service.BenchmarkComparison
import net.bobinski.portfolio.api.domain.service.PortfolioAllocationBucket
import net.bobinski.portfolio.api.domain.service.PortfolioAllocationService
import net.bobinski.portfolio.api.domain.service.PortfolioReadModelService
import net.bobinski.portfolio.api.domain.service.PortfolioReturnPeriod
import net.bobinski.portfolio.api.domain.service.PortfolioReturnsService
import net.bobinski.portfolio.api.domain.service.ReturnPeriodKey
import net.bobinski.portfolio.api.domain.service.ValuationState

class PortfolioAlertService(
    private val alertSettingsService: PortfolioAlertSettingsService,
    private val portfolioReadModelService: PortfolioReadModelService,
    private val portfolioAllocationService: PortfolioAllocationService,
    private val portfolioReturnsService: PortfolioReturnsService,
    private val appPreferenceService: AppPreferenceService,
    private val pushNotifier: PortfolioPushNotifier,
    private val clock: Clock
) {
    private val dispatchMutex = Mutex()

    suspend fun currentAlerts(): List<PortfolioAlert> {
        val settings = alertSettingsService.settings()
        if (!settings.enabled) {
            return emptyList()
        }

        val observedAt = Instant.now(clock)
        return buildList {
            if (settings.typeEnabled(PortfolioAlertType.MARKET_DATA_STALE)) {
                addAll(staleMarketDataAlerts(observedAt))
            }
            if (settings.typeEnabled(PortfolioAlertType.ALLOCATION_DRIFT)) {
                addAll(allocationDriftAlerts(settings, observedAt))
            }
            if (settings.typeEnabled(PortfolioAlertType.BENCHMARK_UNDERPERFORMANCE)) {
                addAll(benchmarkUnderperformanceAlerts(settings, observedAt))
            }
        }.sortedWith(compareByDescending<PortfolioAlert> { it.severity }.thenBy { it.id })
    }

    suspend fun dispatchNewAlerts(): PortfolioAlertDispatchResult = dispatchMutex.withLock {
        val settings = alertSettingsService.settings()
        val alerts = currentAlerts()
        val previousState = appPreferenceService.get(
            key = ALERT_STATE_PREFERENCE_KEY,
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

    private suspend fun staleMarketDataAlerts(observedAt: Instant): List<PortfolioAlert> =
        alertSection {
            val overview = portfolioReadModelService.overview()
            if (overview.valuationState != ValuationState.STALE) {
                return@alertSection emptyList()
            }

            listOf(
                PortfolioAlert(
                    id = "market-data:stale",
                    type = PortfolioAlertType.MARKET_DATA_STALE,
                    severity = PortfolioAlertSeverity.WARNING,
                    title = "Dane rynkowe są opóźnione",
                    message = "Pełną wycenę ma ${overview.valuedHoldingCount} z ${overview.activeHoldingCount} aktywnych pozycji.",
                    route = "/system/market-data",
                    observedAt = observedAt
                )
            )
        }

    private suspend fun allocationDriftAlerts(
        settings: PortfolioAlertSettings,
        observedAt: Instant
    ): List<PortfolioAlert> =
        alertSection {
            val summary = portfolioAllocationService.summary()
            summary.buckets
                .filter { bucket ->
                    bucket.driftPctPoints?.absGreaterOrEqual(settings.allocationDriftThresholdPctPoints) == true
                }
                .map { bucket ->
                    PortfolioAlert(
                        id = "allocation:${bucket.assetClass.name}",
                        type = PortfolioAlertType.ALLOCATION_DRIFT,
                        severity = PortfolioAlertSeverity.WARNING,
                        title = "Dryf alokacji: ${bucket.assetClass.alertLabel()}",
                        message = "Odchylenie wynosi ${bucket.driftPctPoints?.toPlainString()} pp przy progu ${settings.allocationDriftThresholdPctPoints.toPlainString()} pp.",
                        route = "/strategy/targets",
                        observedAt = observedAt
                    )
                }
        }

    private suspend fun benchmarkUnderperformanceAlerts(
        settings: PortfolioAlertSettings,
        observedAt: Instant
    ): List<PortfolioAlert> =
        alertSection {
            val returns = portfolioReturnsService.returns()
            val period = returns.periods.firstOrNull { it.key == ReturnPeriodKey.ONE_YEAR }
                ?: returns.periods.firstOrNull { it.key == ReturnPeriodKey.MAX }
                ?: return@alertSection emptyList()
            val thresholdRate = settings.benchmarkUnderperformanceThresholdPctPoints
                .divide(HUNDRED, 10, RoundingMode.HALF_UP)
                .negate()

            period.benchmarks
                .asSequence()
                .filter(BenchmarkComparison::pinned)
                .filter { benchmark -> benchmark.excessTimeWeightedReturn?.let { it <= thresholdRate } == true }
                .map { benchmark -> benchmark.toAlert(period, observedAt) }
                .toList()
        }

    private suspend fun storeActiveAlertState(alerts: List<PortfolioAlert>) {
        appPreferenceService.put(
            key = ALERT_STATE_PREFERENCE_KEY,
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
        title = "Portfel odstaje od benchmarku $label",
        message = "Nadwyżka TWR dla ${period.label} wynosi ${excessTimeWeightedReturn?.toPercentPointString()} pp.",
        route = "/performance",
        observedAt = observedAt
    )

    private fun BigDecimal.absGreaterOrEqual(threshold: BigDecimal): Boolean = abs() >= threshold

    private fun BigDecimal.toPercentPointString(): String =
        multiply(HUNDRED).setScale(2, RoundingMode.HALF_UP).stripTrailingZeros().toPlainString()

    private fun AssetClass.alertLabel(): String = when (this) {
        AssetClass.EQUITIES -> "akcje"
        AssetClass.BONDS -> "obligacje"
        AssetClass.CASH -> "gotówka"
        AssetClass.FX -> "waluty"
        AssetClass.BENCHMARK -> "benchmarki"
    }

    private suspend fun alertSection(block: suspend () -> List<PortfolioAlert>): List<PortfolioAlert> =
        try {
            block()
        } catch (error: CancellationException) {
            throw error
        } catch (_: Exception) {
            emptyList()
        }

    private companion object {
        const val ALERT_STATE_PREFERENCE_KEY = "portfolio.alerts.active"
        val HUNDRED: BigDecimal = BigDecimal("100")
    }
}

data class PortfolioAlert(
    val id: String,
    val type: PortfolioAlertType,
    val severity: PortfolioAlertSeverity,
    val title: String,
    val message: String,
    val route: String,
    val observedAt: Instant
)

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
