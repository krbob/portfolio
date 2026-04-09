package net.bobinski.portfolio.api.marketdata.service

import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.YearMonth
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import net.bobinski.portfolio.api.domain.model.EdoLotTerms
import net.bobinski.portfolio.api.domain.model.Instrument
import net.bobinski.portfolio.api.domain.model.ValuationSource
import net.bobinski.portfolio.api.domain.service.InstrumentService
import net.bobinski.portfolio.api.marketdata.config.MarketDataRecheckConfig

class MarketDataRecheckService(
    private val config: MarketDataRecheckConfig,
    private val snapshotCacheService: MarketDataSnapshotCacheService,
    private val instrumentService: InstrumentService,
    private val currentInstrumentValuationProvider: CurrentInstrumentValuationProvider,
    private val historicalInstrumentValuationProvider: HistoricalInstrumentValuationProvider,
    private val edoLotValuationProvider: EdoLotValuationProvider,
    private val referenceSeriesProvider: ReferenceSeriesProvider,
    private val fxRateHistoryProvider: FxRateHistoryProvider,
    private val inflationAdjustmentProvider: InflationAdjustmentProvider,
    private val clock: Clock
) {
    private val mutex = Mutex()

    suspend fun runStartupRecheck(): MarketDataRecheckRunResult = runRecheck(MarketDataRecheckTrigger.STARTUP)

    suspend fun runScheduledRecheck(): MarketDataRecheckRunResult = runRecheck(MarketDataRecheckTrigger.SCHEDULED)

    suspend fun runManualRecheck(): MarketDataRecheckRunResult = runRecheck(MarketDataRecheckTrigger.MANUAL)

    private suspend fun runRecheck(trigger: MarketDataRecheckTrigger): MarketDataRecheckRunResult = mutex.withLock {
        val startedAt = Instant.now(clock)
        val activeInstrumentsBySymbol = instrumentService.list()
            .asSequence()
            .filter { instrument ->
                instrument.isActive &&
                    instrument.valuationSource == ValuationSource.STOCK_ANALYST &&
                    !instrument.symbol.isNullOrBlank()
            }
            .groupBy { instrument -> requireNotNull(instrument.symbol) }
        val dueSnapshots = snapshotCacheService.listSnapshots()
            .filter(::shouldRecheck)

        val outcomes = dueSnapshots.map { snapshot ->
            recheckSnapshot(
                snapshot = snapshot,
                activeInstrumentsBySymbol = activeInstrumentsBySymbol,
                today = LocalDate.now(clock),
                currentMonth = YearMonth.now(clock)
            )
        }
        val completedAt = Instant.now(clock)
        val durationMs = completedAt.toEpochMilli() - startedAt.toEpochMilli()

        return MarketDataRecheckRunResult(
            trigger = trigger,
            completedAt = completedAt,
            durationMs = durationMs,
            attemptedCount = outcomes.count { it == RecheckOutcome.REFRESHED || it == RecheckOutcome.STILL_DEGRADED },
            refreshedCount = outcomes.count { it == RecheckOutcome.REFRESHED },
            stillDegradedCount = outcomes.count { it == RecheckOutcome.STILL_DEGRADED },
            skippedCount = outcomes.count { it == RecheckOutcome.SKIPPED },
            identities = dueSnapshots.map(MarketDataSnapshotSummary::identity)
        )
    }

    private fun shouldRecheck(snapshot: MarketDataSnapshotSummary): Boolean {
        if (snapshot.status == MarketDataSnapshotStatus.FRESH) {
            return false
        }

        val retryAfter = snapshot.lastCheckedAt.plus(retryBackoff(snapshot.failureCount))
        return !retryAfter.isAfter(Instant.now(clock))
    }

    private suspend fun recheckSnapshot(
        snapshot: MarketDataSnapshotSummary,
        activeInstrumentsBySymbol: Map<String, List<Instrument>>,
        today: LocalDate,
        currentMonth: YearMonth
    ): RecheckOutcome = when (snapshot.snapshotType) {
        "QUOTE" -> recheckQuote(snapshot, activeInstrumentsBySymbol)
        "PRICE_SERIES" -> recheckSeries(snapshot, activeInstrumentsBySymbol, today)
        "INFLATION_MONTHLY" -> recheckMonthlyInflation(snapshot, currentMonth)
        "INFLATION_WINDOW" -> recheckInflationWindow(snapshot)
        else -> RecheckOutcome.SKIPPED
    }

    private suspend fun recheckQuote(
        snapshot: MarketDataSnapshotSummary,
        activeInstrumentsBySymbol: Map<String, List<Instrument>>
    ): RecheckOutcome = when {
        snapshot.identity.startsWith(STOCK_QUOTE_PREFIX) -> {
            val symbol = snapshot.identity.removePrefix(STOCK_QUOTE_PREFIX)
            val instrument = activeInstrumentsBySymbol[symbol]?.firstOrNull()
                ?: return RecheckOutcome.SKIPPED
            currentInstrumentValuationProvider.value(instrument).toRecheckOutcome()
        }

        snapshot.identity.startsWith(EDO_QUOTE_PREFIX) -> {
            val lotTerms = parseEdoLotTerms(snapshot.identity.removePrefix(EDO_QUOTE_PREFIX))
                ?: return RecheckOutcome.SKIPPED
            edoLotValuationProvider.value(lotTerms).toRecheckOutcome()
        }

        else -> RecheckOutcome.SKIPPED
    }

    private suspend fun recheckSeries(
        snapshot: MarketDataSnapshotSummary,
        activeInstrumentsBySymbol: Map<String, List<Instrument>>,
        today: LocalDate
    ): RecheckOutcome {
        val from = recheckSeriesFrom(snapshot, today)
        return when {
            snapshot.identity.startsWith(STOCK_HISTORY_PREFIX) -> {
                val symbol = snapshot.identity.removePrefix(STOCK_HISTORY_PREFIX)
                val instrument = activeInstrumentsBySymbol[symbol]?.firstOrNull()
                    ?: return RecheckOutcome.SKIPPED
                historicalInstrumentValuationProvider.dailyPriceSeries(instrument, from, today).toRecheckOutcome()
            }

            snapshot.identity == REFERENCE_USD_PLN -> referenceSeriesProvider.usdPln(from, today).toRecheckOutcome()
            snapshot.identity == REFERENCE_GOLD_PLN -> referenceSeriesProvider.goldPln(from, today).toRecheckOutcome()

            snapshot.identity.startsWith(REFERENCE_PREFIX) -> {
                val benchmark = parseReferenceIdentity(snapshot.identity) ?: return RecheckOutcome.SKIPPED
                if (benchmark.currency == "PLN") {
                    referenceSeriesProvider.benchmarkPln(benchmark.symbol, from, today).toRecheckOutcome()
                } else {
                    RecheckOutcome.SKIPPED
                }
            }

            snapshot.identity.startsWith(FX_HISTORY_PREFIX) -> {
                val currency = snapshot.identity.removePrefix(FX_HISTORY_PREFIX)
                fxRateHistoryProvider.dailyRateToPln(currency, from, today).toRecheckOutcome()
            }

            snapshot.identity.startsWith(EDO_HISTORY_PREFIX) -> {
                val lotTerms = parseEdoLotTerms(snapshot.identity.removePrefix(EDO_HISTORY_PREFIX))
                    ?: return RecheckOutcome.SKIPPED
                val effectiveFrom = maxOf(from, lotTerms.purchaseDate)
                edoLotValuationProvider.dailyPriceSeries(lotTerms, effectiveFrom, today).toRecheckOutcome()
            }

            else -> RecheckOutcome.SKIPPED
        }
    }

    private suspend fun recheckMonthlyInflation(
        snapshot: MarketDataSnapshotSummary,
        currentMonth: YearMonth
    ): RecheckOutcome {
        val sourceMonth = snapshot.sourceAsOf?.let(::parseYearMonthOrNull)
        val lookbackStart = sourceMonth
            ?.minusMonths(config.inflationLookbackMonths - 1)
            ?: currentMonth.minusMonths(config.inflationLookbackMonths - 1)
        val earliestCovered = snapshot.sourceFrom?.let(::parseYearMonthOrNull)
        val from = earliestCovered?.let { maxOf(it, lookbackStart) } ?: lookbackStart

        return inflationAdjustmentProvider.monthlySeries(
            from = from,
            untilExclusive = currentMonth.plusMonths(1)
        ).toRecheckOutcome()
    }

    private suspend fun recheckInflationWindow(snapshot: MarketDataSnapshotSummary): RecheckOutcome {
        val from = parseYearMonthOrNull(snapshot.identity) ?: return RecheckOutcome.SKIPPED
        return inflationAdjustmentProvider.cumulativeSince(from).toRecheckOutcome()
    }

    private fun recheckSeriesFrom(snapshot: MarketDataSnapshotSummary, today: LocalDate): LocalDate {
        val windowStart = snapshot.sourceAsOf?.let(::parseLocalDateOrNull)
            ?.minusDays(config.seriesLookbackDays - 1)
            ?: today.minusDays(config.seriesLookbackDays - 1)
        val earliestCovered = snapshot.sourceFrom?.let(::parseLocalDateOrNull)
        return earliestCovered?.let { maxOf(it, windowStart) } ?: windowStart
    }

    private fun retryBackoff(failureCount: Int): Duration {
        val multiplier = when {
            failureCount <= 1 -> 1L
            failureCount == 2 -> 2L
            else -> 4L
        }
        val retryMinutes = (config.baseRetryMinutes * multiplier).coerceAtMost(config.maxRetryMinutes)
        return Duration.ofMinutes(retryMinutes)
    }

    private fun parseEdoLotTerms(encoded: String): EdoLotTerms? {
        val parts = encoded.split('|')
        if (parts.size != 3) {
            return null
        }

        val purchaseDate = parseLocalDateOrNull(parts[0]) ?: return null
        val firstPeriodRateBps = parts[1].toIntOrNull() ?: return null
        val marginBps = parts[2].toIntOrNull() ?: return null
        return EdoLotTerms(
            purchaseDate = purchaseDate,
            firstPeriodRateBps = firstPeriodRateBps,
            marginBps = marginBps
        )
    }

    private fun parseReferenceIdentity(identity: String): ReferenceIdentity? {
        val encoded = identity.removePrefix(REFERENCE_PREFIX)
        val separator = encoded.lastIndexOf(':')
        if (separator <= 0 || separator >= encoded.lastIndex) {
            return null
        }

        return ReferenceIdentity(
            symbol = encoded.substring(0, separator),
            currency = encoded.substring(separator + 1)
        )
    }

    private fun parseLocalDateOrNull(value: String): LocalDate? = runCatching {
        LocalDate.parse(value)
    }.getOrNull()

    private fun parseYearMonthOrNull(value: String): YearMonth? = runCatching {
        YearMonth.parse(value)
    }.getOrNull()

    private companion object {
        private const val STOCK_QUOTE_PREFIX = "stock-quote:"
        private const val EDO_QUOTE_PREFIX = "edo-quote:"
        private const val STOCK_HISTORY_PREFIX = "stock-history:"
        private const val FX_HISTORY_PREFIX = "fx-history:"
        private const val EDO_HISTORY_PREFIX = "edo-history:"
        private const val REFERENCE_PREFIX = "reference:"
        private const val REFERENCE_USD_PLN = "reference:usd-pln"
        private const val REFERENCE_GOLD_PLN = "reference:gold-pln"
    }
}

data class MarketDataRecheckRunResult(
    val trigger: MarketDataRecheckTrigger,
    val completedAt: Instant,
    val durationMs: Long,
    val attemptedCount: Int,
    val refreshedCount: Int,
    val stillDegradedCount: Int,
    val skippedCount: Int,
    val identities: List<String>
)

enum class MarketDataRecheckTrigger {
    MANUAL,
    SCHEDULED,
    STARTUP
}

private enum class RecheckOutcome {
    REFRESHED,
    STILL_DEGRADED,
    SKIPPED
}

private data class ReferenceIdentity(
    val symbol: String,
    val currency: String
)

private fun InstrumentValuationResult.toRecheckOutcome(): RecheckOutcome = when (this) {
    is InstrumentValuationResult.Success -> if (!fromCache) RecheckOutcome.REFRESHED else RecheckOutcome.STILL_DEGRADED
    is InstrumentValuationResult.Failure -> RecheckOutcome.STILL_DEGRADED
}

private fun HistoricalInstrumentValuationResult.toRecheckOutcome(): RecheckOutcome = when (this) {
    is HistoricalInstrumentValuationResult.Success -> if (!fromCache) RecheckOutcome.REFRESHED else RecheckOutcome.STILL_DEGRADED
    is HistoricalInstrumentValuationResult.Failure -> RecheckOutcome.STILL_DEGRADED
}

private fun ReferenceSeriesResult.toRecheckOutcome(): RecheckOutcome = when (this) {
    is ReferenceSeriesResult.Success -> if (!fromCache) RecheckOutcome.REFRESHED else RecheckOutcome.STILL_DEGRADED
    is ReferenceSeriesResult.Failure -> RecheckOutcome.STILL_DEGRADED
}

private fun FxRateHistoryResult.toRecheckOutcome(): RecheckOutcome = when (this) {
    is FxRateHistoryResult.Success -> if (!fromCache) RecheckOutcome.REFRESHED else RecheckOutcome.STILL_DEGRADED
    is FxRateHistoryResult.Failure -> RecheckOutcome.STILL_DEGRADED
}

private fun InflationAdjustmentResult.toRecheckOutcome(): RecheckOutcome = when (this) {
    is InflationAdjustmentResult.Success -> if (!fromCache) RecheckOutcome.REFRESHED else RecheckOutcome.STILL_DEGRADED
    is InflationAdjustmentResult.Failure -> RecheckOutcome.STILL_DEGRADED
}

private fun InflationSeriesResult.toRecheckOutcome(): RecheckOutcome = when (this) {
    is InflationSeriesResult.Success -> if (!fromCache) RecheckOutcome.REFRESHED else RecheckOutcome.STILL_DEGRADED
    is InflationSeriesResult.Failure -> RecheckOutcome.STILL_DEGRADED
}
