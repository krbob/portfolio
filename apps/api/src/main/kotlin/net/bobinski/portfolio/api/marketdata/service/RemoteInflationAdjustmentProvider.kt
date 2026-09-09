package net.bobinski.portfolio.api.marketdata.service

import net.bobinski.portfolio.api.marketdata.client.EdoCalculatorClient
import net.bobinski.portfolio.api.marketdata.client.MarketDataClientException
import net.bobinski.portfolio.api.marketdata.config.MarketDataConfig
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.YearMonth
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

class RemoteInflationAdjustmentProvider(
    private val config: MarketDataConfig,
    private val edoCalculatorClient: EdoCalculatorClient,
    private val snapshotCacheService: MarketDataSnapshotCacheService,
    private val clock: Clock = Clock.systemUTC()
) : InflationAdjustmentProvider {
    private val monthlyMutex = Mutex()
    private var availability: MonthlyAvailability? = null
    private var failedUntil: Instant? = null
    private var failureReason: String? = null

    override suspend fun cumulativeSince(from: YearMonth): InflationAdjustmentResult {
        if (!config.enabled) {
            return InflationAdjustmentResult.Failure("Market data integration is disabled.")
        }

        return try {
            val window = edoCalculatorClient.inflationSince(from)
            val success = InflationAdjustmentResult.Success(
                from = window.from,
                until = window.until,
                multiplier = window.multiplier
            )
            snapshotCacheService.putCumulativeInflation(success)
            success
        } catch (exception: MarketDataClientException) {
            snapshotCacheService.recordCumulativeInflationFailure(from = from, reason = exception.message)
            snapshotCacheService.getCumulativeInflation(from)?.let { return it }
            InflationAdjustmentResult.Failure(exception.message ?: "Inflation request failed.")
        } catch (exception: CancellationException) {
            throw exception
        } catch (exception: Exception) {
            snapshotCacheService.recordCumulativeInflationFailure(from = from, reason = exception.message)
            snapshotCacheService.getCumulativeInflation(from)?.let { return it }
            InflationAdjustmentResult.Failure(exception.message ?: "Unexpected inflation request error.")
        }
    }

    override suspend fun monthlySeries(from: YearMonth, untilExclusive: YearMonth): InflationSeriesResult =
        monthlyMutex.withLock { loadMonthlySeries(from, untilExclusive) }

    private suspend fun loadMonthlySeries(from: YearMonth, untilExclusive: YearMonth): InflationSeriesResult {
        if (!config.enabled) {
            return InflationSeriesResult.Failure("Market data integration is disabled.")
        }
        if (from >= untilExclusive) {
            return InflationSeriesResult.Failure("Inflation window must contain at least one month.")
        }
        if (failedUntil?.isAfter(Instant.now(clock)) == true) {
            return cachedOrFailure(from, untilExclusive, failureReason ?: "CPI provider is temporarily unavailable.")
        }
        return try {
            val published = publishedWindow(from)
            val effectiveUntil = minOf(untilExclusive, published.until)
            if (from >= effectiveUntil) {
                return InflationSeriesResult.Failure("CPI has not been published for this period yet.")
            }
            val cached = snapshotCacheService.getMonthlyInflation(from, effectiveUntil)
            if (published.monthlyLoaded && cached?.until == effectiveUntil) {
                // Within the checked publication window this is a fresh cache hit,
                // not a stale fallback following an upstream failure.
                return cached.copy(fromCache = false)
            }
            val series = edoCalculatorClient.monthlyInflation(from = from, untilExclusive = effectiveUntil)
            val expectedMonths = generateSequence(from) { it.plusMonths(1) }.takeWhile { it < effectiveUntil }.toList()
            check(series.from == from && series.until == effectiveUntil &&
                series.points.map { it.month } == expectedMonths && series.points.all { it.multiplier.signum() > 0 }
            ) { "CPI provider returned an incomplete or invalid monthly series." }
            val success = InflationSeriesResult.Success(
                from = series.from,
                until = series.until,
                points = series.points.map { point ->
                    net.bobinski.portfolio.api.marketdata.service.MonthlyInflationPoint(
                        month = point.month,
                        multiplier = point.multiplier
                    )
                }
            )
            snapshotCacheService.putMonthlyInflation(success.points)
            availability = published.copy(monthlyLoaded = true)
            failedUntil = null
            failureReason = null
            success
        } catch (exception: CancellationException) {
            throw exception
        } catch (exception: Exception) {
            val reason = exception.message ?: "Monthly inflation request failed."
            failedUntil = Instant.now(clock).plus(FAILURE_RETRY_DELAY)
            failureReason = reason
            availability = null
            snapshotCacheService.recordMonthlyInflationFailure(reason)
            cachedOrFailure(from, untilExclusive, reason)
        }
    }

    private suspend fun publishedWindow(from: YearMonth): MonthlyAvailability {
        val currentMonth = YearMonth.now(clock)
        val now = Instant.now(clock)
        availability?.takeIf {
            it.from <= from && it.currentMonth == currentMonth && it.checkedAt.plus(PUBLICATION_CHECK_TTL).isAfter(now)
        }?.let { return it }

        // The open-ended endpoint resolves the last published month. Probe at
        // least two months back so a newly opened portfolio can also discover
        // that its first month is still awaiting CPI, without guessing a release day.
        val probeFrom = minOf(from, currentMonth.minusMonths(2))
        val window = edoCalculatorClient.inflationSince(probeFrom)
        check(window.from == probeFrom && window.until > probeFrom && window.until <= currentMonth) {
            "CPI provider returned an invalid publication window."
        }
        check(window.until >= currentMonth.minusMonths(1)) {
            "CPI coverage ends before the expected publication window: ${window.until.minusMonths(1)}."
        }
        return MonthlyAvailability(probeFrom, window.until, currentMonth, now).also { availability = it }
    }

    private suspend fun cachedOrFailure(from: YearMonth, until: YearMonth, reason: String): InflationSeriesResult =
        snapshotCacheService.getMonthlyInflation(from, until) ?: InflationSeriesResult.Failure(reason)

    private data class MonthlyAvailability(
        val from: YearMonth,
        val until: YearMonth,
        val currentMonth: YearMonth,
        val checkedAt: Instant,
        val monthlyLoaded: Boolean = false
    )

    private companion object {
        val PUBLICATION_CHECK_TTL: Duration = Duration.ofHours(1)
        val FAILURE_RETRY_DELAY: Duration = Duration.ofMinutes(5)
    }
}
