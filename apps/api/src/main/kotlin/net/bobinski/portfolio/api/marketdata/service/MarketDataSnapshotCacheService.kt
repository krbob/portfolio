package net.bobinski.portfolio.api.marketdata.service

import java.math.BigDecimal
import java.security.MessageDigest
import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.time.YearMonth
import kotlinx.serialization.Serializable
import net.bobinski.portfolio.api.domain.service.AppPreferenceService
import net.bobinski.portfolio.api.marketdata.model.HistoricalPricePoint

class MarketDataSnapshotCacheService(
    private val appPreferenceService: AppPreferenceService,
    private val clock: Clock = Clock.systemUTC()
) {
    suspend fun listSnapshots(): List<MarketDataSnapshotSummary> {
        val payloads = appPreferenceService.listByPrefix(MarketDataSnapshotPreferences.PREFERENCE_KEY_PREFIX)
            .mapNotNull { preference ->
                val key = preference.key.removePrefix(MarketDataSnapshotPreferences.PREFERENCE_KEY_PREFIX)
                val type = key.substringBefore('.', missingDelimiterValue = "")
                when (type) {
                    SnapshotPreferenceType.QUOTE.preferenceType ->
                        appPreferenceService.decodeOrNull(preference, StoredQuoteSnapshot.serializer())
                            ?.toPayloadSummary(preference.updatedAt)
                    SnapshotPreferenceType.SERIES.preferenceType ->
                        appPreferenceService.decodeOrNull(preference, StoredSeriesSnapshot.serializer())
                            ?.toPayloadSummary(preference.updatedAt)
                    SnapshotPreferenceType.INFLATION_MONTHLY.preferenceType ->
                        appPreferenceService.decodeOrNull(preference, StoredMonthlyInflationSnapshot.serializer())
                            ?.toPayloadSummary(preference.updatedAt)
                    SnapshotPreferenceType.INFLATION_WINDOW.preferenceType ->
                        appPreferenceService.decodeOrNull(preference, StoredInflationWindow.serializer())
                            ?.toPayloadSummary(preference.updatedAt)
                    else -> null
                }
            }
            .associateBy(PayloadSnapshotSummary::key)

        val metadata = appPreferenceService.listByPrefix(MarketDataSnapshotPreferences.METADATA_PREFERENCE_KEY_PREFIX)
            .mapNotNull { preference ->
                appPreferenceService.decodeOrNull(preference, MarketDataSnapshotMetadata.serializer())
            }
            .associateBy { stored ->
                SnapshotIdentity(
                    snapshotType = SnapshotPreferenceType.valueOf(stored.snapshotType),
                    identity = stored.identity
                )
            }

        return (payloads.keys + metadata.keys)
            .map { key ->
                val payload = payloads[key]
                val meta = metadata[key]
                val lastCheckedAt = meta?.lastCheckedAt?.let(Instant::parse) ?: payload?.storedAt ?: Instant.EPOCH
                MarketDataSnapshotSummary(
                    snapshotType = key.snapshotType.summaryType,
                    identity = meta?.identity ?: payload?.identity ?: "",
                    cachedAt = lastCheckedAt,
                    sourceFrom = meta?.sourceFrom ?: payload?.sourceFrom,
                    sourceTo = meta?.sourceTo ?: payload?.sourceTo,
                    sourceAsOf = meta?.sourceAsOf ?: payload?.sourceAsOf,
                    pointCount = meta?.pointCount ?: payload?.pointCount,
                    status = meta?.status?.let(MarketDataSnapshotStatus::valueOf) ?: MarketDataSnapshotStatus.FRESH,
                    lastCheckedAt = lastCheckedAt,
                    lastSuccessfulCheckAt = meta?.lastSuccessfulCheckAt?.let(Instant::parse) ?: payload?.storedAt,
                    canonicalUpdatedAt = meta?.canonicalUpdatedAt?.let(Instant::parse) ?: payload?.storedAt,
                    failureCount = meta?.failureCount ?: 0,
                    lastFailureAt = meta?.lastFailureAt?.let(Instant::parse),
                    lastFailureReason = meta?.lastFailureReason
                )
            }
            .sortedWith(
                compareByDescending<MarketDataSnapshotSummary> { it.lastCheckedAt }
                    .thenBy(MarketDataSnapshotSummary::snapshotType)
                    .thenBy(MarketDataSnapshotSummary::identity)
            )
    }

    suspend fun putQuote(identity: String, valuation: InstrumentValuation) {
        val stored = StoredQuoteSnapshot(
            identity = identity,
            valuedAt = valuation.valuedAt.toString(),
            pricePerUnitPln = valuation.pricePerUnitPln.toPlainString(),
            pricePerUnitNative = valuation.pricePerUnitNative?.toPlainString(),
            currentRatePercent = valuation.currentRatePercent?.toPlainString(),
            previousClosePln = valuation.previousClosePln?.toPlainString()
        )
        val existing = getStoredQuote(identity)

        appPreferenceService.put(
            key = preferenceKey(SnapshotPreferenceType.QUOTE.preferenceType, identity),
            serializer = StoredQuoteSnapshot.serializer(),
            value = stored
        )
        updateSuccessMetadata(
            snapshotType = SnapshotPreferenceType.QUOTE,
            identity = identity,
            canonicalChanged = existing != stored,
            sourceFrom = stored.valuedAt,
            sourceTo = stored.valuedAt,
            sourceAsOf = stored.valuedAt,
            pointCount = 1
        )
    }

    suspend fun recordQuoteFailure(identity: String, reason: String?) {
        val stored = getStoredQuote(identity)
        updateFailureMetadata(
            snapshotType = SnapshotPreferenceType.QUOTE,
            identity = identity,
            sourceFrom = stored?.valuedAt,
            sourceTo = stored?.valuedAt,
            sourceAsOf = stored?.valuedAt,
            pointCount = stored?.let { 1 },
            reason = reason
        )
    }

    suspend fun getQuote(identity: String): InstrumentValuation? {
        val stored = getStoredQuote(identity) ?: return null

        return InstrumentValuation(
            pricePerUnitPln = stored.pricePerUnitPln.toBigDecimal(),
            pricePerUnitNative = stored.pricePerUnitNative?.toBigDecimal(),
            valuedAt = LocalDate.parse(stored.valuedAt),
            currentRatePercent = stored.currentRatePercent?.toBigDecimal(),
            previousClosePln = stored.previousClosePln?.toBigDecimal()
        )
    }

    suspend fun putSeries(identity: String, prices: List<HistoricalPricePoint>) {
        if (prices.isEmpty()) {
            return
        }

        val mergedPoints = mergeSeriesPoints(
            existing = getStoredSeries(identity)?.points.orEmpty(),
            incoming = prices.map { point ->
                StoredPricePoint(
                    date = point.date.toString(),
                    closePricePln = point.closePricePln.toPlainString()
                )
            }
        )
        val stored = StoredSeriesSnapshot(
            identity = identity,
            points = mergedPoints
        )
        val existing = getStoredSeries(identity)

        appPreferenceService.put(
            key = preferenceKey(SnapshotPreferenceType.SERIES.preferenceType, identity),
            serializer = StoredSeriesSnapshot.serializer(),
            value = stored
        )
        updateSuccessMetadata(
            snapshotType = SnapshotPreferenceType.SERIES,
            identity = identity,
            canonicalChanged = existing != stored,
            sourceFrom = mergedPoints.minByOrNull(StoredPricePoint::date)?.date,
            sourceTo = mergedPoints.maxByOrNull(StoredPricePoint::date)?.date,
            sourceAsOf = mergedPoints.maxByOrNull(StoredPricePoint::date)?.date,
            pointCount = mergedPoints.size
        )
    }

    suspend fun recordSeriesFailure(identity: String, reason: String?) {
        val stored = getStoredSeries(identity)
        updateFailureMetadata(
            snapshotType = SnapshotPreferenceType.SERIES,
            identity = identity,
            sourceFrom = stored?.points?.minByOrNull(StoredPricePoint::date)?.date,
            sourceTo = stored?.points?.maxByOrNull(StoredPricePoint::date)?.date,
            sourceAsOf = stored?.points?.maxByOrNull(StoredPricePoint::date)?.date,
            pointCount = stored?.points?.size,
            reason = reason
        )
    }

    suspend fun getSeries(
        identity: String,
        from: LocalDate,
        to: LocalDate
    ): List<HistoricalPricePoint>? {
        val stored = getStoredSeries(identity) ?: return null
        val points = stored.points
            .map { point ->
                HistoricalPricePoint(
                    date = LocalDate.parse(point.date),
                    closePricePln = point.closePricePln.toBigDecimal()
                )
            }
            .filter { point -> !point.date.isBefore(from) && !point.date.isAfter(to) }

        return points.takeIf { it.isNotEmpty() }
    }

    suspend fun putMonthlyInflation(points: List<MonthlyInflationPoint>) {
        if (points.isEmpty()) {
            return
        }

        val identity = "inflation.monthly"
        val mergedPoints = mergeMonthlyInflationPoints(
            existing = getStoredMonthlyInflation(identity)?.points.orEmpty(),
            incoming = points.map { point ->
                StoredMonthlyInflationPoint(
                    month = point.month.toString(),
                    multiplier = point.multiplier.toPlainString()
                )
            }
        )
        val stored = StoredMonthlyInflationSnapshot(
            identity = identity,
            points = mergedPoints
        )
        val existing = getStoredMonthlyInflation(identity)

        appPreferenceService.put(
            key = preferenceKey(SnapshotPreferenceType.INFLATION_MONTHLY.preferenceType, identity),
            serializer = StoredMonthlyInflationSnapshot.serializer(),
            value = stored
        )
        updateSuccessMetadata(
            snapshotType = SnapshotPreferenceType.INFLATION_MONTHLY,
            identity = identity,
            canonicalChanged = existing != stored,
            sourceFrom = mergedPoints.minByOrNull(StoredMonthlyInflationPoint::month)?.month,
            sourceTo = mergedPoints.maxByOrNull(StoredMonthlyInflationPoint::month)?.month,
            sourceAsOf = mergedPoints.maxByOrNull(StoredMonthlyInflationPoint::month)?.month,
            pointCount = mergedPoints.size
        )
    }

    suspend fun recordMonthlyInflationFailure(reason: String?) {
        val identity = "inflation.monthly"
        val stored = getStoredMonthlyInflation(identity)
        updateFailureMetadata(
            snapshotType = SnapshotPreferenceType.INFLATION_MONTHLY,
            identity = identity,
            sourceFrom = stored?.points?.minByOrNull(StoredMonthlyInflationPoint::month)?.month,
            sourceTo = stored?.points?.maxByOrNull(StoredMonthlyInflationPoint::month)?.month,
            sourceAsOf = stored?.points?.maxByOrNull(StoredMonthlyInflationPoint::month)?.month,
            pointCount = stored?.points?.size,
            reason = reason
        )
    }

    suspend fun getMonthlyInflation(
        from: YearMonth,
        untilExclusive: YearMonth
    ): InflationSeriesResult.Success? {
        val stored = getStoredMonthlyInflation("inflation.monthly") ?: return null
        val points = stored.points
            .map { point ->
                MonthlyInflationPoint(
                    month = YearMonth.parse(point.month),
                    multiplier = point.multiplier.toBigDecimal()
                )
            }
            .filter { point -> point.month >= from && point.month < untilExclusive }
            .sortedBy(MonthlyInflationPoint::month)

        if (points.isEmpty()) {
            return null
        }

        var coveredUntil = from
        val contiguous = mutableListOf<MonthlyInflationPoint>()
        for (point in points) {
            if (point.month != coveredUntil) {
                break
            }
            contiguous += point
            coveredUntil = coveredUntil.plusMonths(1)
        }

        if (contiguous.isEmpty()) {
            return null
        }

        return InflationSeriesResult.Success(
            from = contiguous.first().month,
            until = contiguous.last().month.plusMonths(1),
            points = contiguous,
            fromCache = true
        )
    }

    suspend fun putCumulativeInflation(result: InflationAdjustmentResult.Success) {
        val identity = result.from.toString()
        val stored = StoredInflationWindow(
            from = result.from.toString(),
            until = result.until.toString(),
            multiplier = result.multiplier.toPlainString()
        )
        val existing = getStoredInflationWindow(identity)

        appPreferenceService.put(
            key = preferenceKey(SnapshotPreferenceType.INFLATION_WINDOW.preferenceType, identity),
            serializer = StoredInflationWindow.serializer(),
            value = stored
        )
        updateSuccessMetadata(
            snapshotType = SnapshotPreferenceType.INFLATION_WINDOW,
            identity = identity,
            canonicalChanged = existing != stored,
            sourceFrom = stored.from,
            sourceTo = sourceToMonth(from = stored.from, untilExclusive = stored.until),
            sourceAsOf = stored.until,
            pointCount = null
        )
    }

    suspend fun recordCumulativeInflationFailure(from: YearMonth, reason: String?) {
        val identity = from.toString()
        val stored = getStoredInflationWindow(identity)
        updateFailureMetadata(
            snapshotType = SnapshotPreferenceType.INFLATION_WINDOW,
            identity = identity,
            sourceFrom = stored?.from,
            sourceTo = stored?.let { sourceToMonth(from = it.from, untilExclusive = it.until) },
            sourceAsOf = stored?.until,
            pointCount = null,
            reason = reason
        )
    }

    suspend fun getCumulativeInflation(from: YearMonth): InflationAdjustmentResult.Success? {
        val direct = getStoredInflationWindow(from.toString())
        if (direct != null) {
            return InflationAdjustmentResult.Success(
                from = YearMonth.parse(direct.from),
                until = YearMonth.parse(direct.until),
                multiplier = direct.multiplier.toBigDecimal(),
                fromCache = true
            )
        }

        val monthly = getMonthlyInflation(from = from, untilExclusive = YearMonth.now().plusMonths(1)) ?: return null
        val multiplier = monthly.points.fold(BigDecimal.ONE) { total, point ->
            total.multiply(point.multiplier)
        }.stripTrailingZeros()

        return InflationAdjustmentResult.Success(
            from = from,
            until = monthly.until,
            multiplier = multiplier,
            fromCache = true
        )
    }

    private suspend fun getStoredQuote(identity: String): StoredQuoteSnapshot? =
        appPreferenceService.getOrNull(
            key = preferenceKey(SnapshotPreferenceType.QUOTE.preferenceType, identity),
            serializer = StoredQuoteSnapshot.serializer()
        )

    private suspend fun getStoredSeries(identity: String): StoredSeriesSnapshot? =
        appPreferenceService.getOrNull(
            key = preferenceKey(SnapshotPreferenceType.SERIES.preferenceType, identity),
            serializer = StoredSeriesSnapshot.serializer()
        )

    private suspend fun getStoredMonthlyInflation(identity: String): StoredMonthlyInflationSnapshot? =
        appPreferenceService.getOrNull(
            key = preferenceKey(SnapshotPreferenceType.INFLATION_MONTHLY.preferenceType, identity),
            serializer = StoredMonthlyInflationSnapshot.serializer()
        )

    private suspend fun getStoredInflationWindow(identity: String): StoredInflationWindow? =
        appPreferenceService.getOrNull(
            key = preferenceKey(SnapshotPreferenceType.INFLATION_WINDOW.preferenceType, identity),
            serializer = StoredInflationWindow.serializer()
        )

    private suspend fun getStoredMetadata(
        snapshotType: SnapshotPreferenceType,
        identity: String
    ): MarketDataSnapshotMetadata? = appPreferenceService.getOrNull(
        key = metadataPreferenceKey(snapshotType.preferenceType, identity),
        serializer = MarketDataSnapshotMetadata.serializer()
    )

    private suspend fun updateSuccessMetadata(
        snapshotType: SnapshotPreferenceType,
        identity: String,
        canonicalChanged: Boolean,
        sourceFrom: String?,
        sourceTo: String?,
        sourceAsOf: String?,
        pointCount: Int?
    ) {
        val now = Instant.now(clock)
        val previous = getStoredMetadata(snapshotType = snapshotType, identity = identity)
        val canonicalUpdatedAt = when {
            canonicalChanged -> now
            previous?.canonicalUpdatedAt != null -> Instant.parse(previous.canonicalUpdatedAt)
            else -> now
        }
        val metadata = MarketDataSnapshotMetadata(
            snapshotType = snapshotType.name,
            identity = identity,
            status = MarketDataSnapshotStatus.FRESH.name,
            lastCheckedAt = now.toString(),
            lastSuccessfulCheckAt = now.toString(),
            canonicalUpdatedAt = canonicalUpdatedAt.toString(),
            sourceFrom = sourceFrom,
            sourceTo = sourceTo,
            sourceAsOf = sourceAsOf,
            pointCount = pointCount,
            failureCount = 0,
            lastFailureAt = null,
            lastFailureReason = null
        )
        appPreferenceService.put(
            key = metadataPreferenceKey(snapshotType.preferenceType, identity),
            serializer = MarketDataSnapshotMetadata.serializer(),
            value = metadata
        )
    }

    private suspend fun updateFailureMetadata(
        snapshotType: SnapshotPreferenceType,
        identity: String,
        sourceFrom: String?,
        sourceTo: String?,
        sourceAsOf: String?,
        pointCount: Int?,
        reason: String?
    ) {
        val now = Instant.now(clock)
        val previous = getStoredMetadata(snapshotType = snapshotType, identity = identity)
        val metadata = MarketDataSnapshotMetadata(
            snapshotType = snapshotType.name,
            identity = identity,
            status = MarketDataSnapshotStatus.FAILED.name,
            lastCheckedAt = now.toString(),
            lastSuccessfulCheckAt = previous?.lastSuccessfulCheckAt,
            canonicalUpdatedAt = previous?.canonicalUpdatedAt,
            sourceFrom = sourceFrom ?: previous?.sourceFrom,
            sourceTo = sourceTo ?: previous?.sourceTo,
            sourceAsOf = sourceAsOf ?: previous?.sourceAsOf,
            pointCount = pointCount ?: previous?.pointCount,
            failureCount = (previous?.failureCount ?: 0) + 1,
            lastFailureAt = now.toString(),
            lastFailureReason = reason?.takeIf { it.isNotBlank() } ?: previous?.lastFailureReason
        )
        appPreferenceService.put(
            key = metadataPreferenceKey(snapshotType.preferenceType, identity),
            serializer = MarketDataSnapshotMetadata.serializer(),
            value = metadata
        )
    }

    private fun mergeSeriesPoints(
        existing: List<StoredPricePoint>,
        incoming: List<StoredPricePoint>
    ): List<StoredPricePoint> = (existing + incoming)
        .associateBy(StoredPricePoint::date)
        .toSortedMap()
        .values
        .toList()

    private fun mergeMonthlyInflationPoints(
        existing: List<StoredMonthlyInflationPoint>,
        incoming: List<StoredMonthlyInflationPoint>
    ): List<StoredMonthlyInflationPoint> = (existing + incoming)
        .associateBy(StoredMonthlyInflationPoint::month)
        .toSortedMap()
        .values
        .toList()

    private fun preferenceKey(type: String, identity: String): String =
        "${MarketDataSnapshotPreferences.PREFERENCE_KEY_PREFIX}$type.${identity.sha256Hex()}"

    private fun metadataPreferenceKey(type: String, identity: String): String =
        "${MarketDataSnapshotPreferences.METADATA_PREFERENCE_KEY_PREFIX}$type.${identity.sha256Hex()}"

    private fun String.sha256Hex(): String =
        MessageDigest.getInstance("SHA-256")
            .digest(toByteArray(Charsets.UTF_8))
            .joinToString(separator = "") { byte -> "%02x".format(byte) }
}

data class MarketDataSnapshotSummary(
    val snapshotType: String,
    val identity: String,
    val cachedAt: Instant,
    val sourceFrom: String?,
    val sourceTo: String?,
    val sourceAsOf: String?,
    val pointCount: Int?,
    val status: MarketDataSnapshotStatus,
    val lastCheckedAt: Instant,
    val lastSuccessfulCheckAt: Instant?,
    val canonicalUpdatedAt: Instant?,
    val failureCount: Int,
    val lastFailureAt: Instant?,
    val lastFailureReason: String?
)

enum class MarketDataSnapshotStatus {
    FRESH,
    DELAYED,
    STALE,
    FAILED
}

private data class SnapshotIdentity(
    val snapshotType: SnapshotPreferenceType,
    val identity: String
)

private enum class SnapshotPreferenceType(val preferenceType: String, val summaryType: String) {
    QUOTE("quote", "QUOTE"),
    SERIES("series", "PRICE_SERIES"),
    INFLATION_MONTHLY("inflation-monthly", "INFLATION_MONTHLY"),
    INFLATION_WINDOW("inflation-window", "INFLATION_WINDOW")
}

private data class PayloadSnapshotSummary(
    val key: SnapshotIdentity,
    val identity: String,
    val storedAt: Instant,
    val sourceFrom: String?,
    val sourceTo: String?,
    val sourceAsOf: String?,
    val pointCount: Int?
)

private fun StoredQuoteSnapshot.toPayloadSummary(storedAt: Instant): PayloadSnapshotSummary =
    PayloadSnapshotSummary(
        key = SnapshotIdentity(SnapshotPreferenceType.QUOTE, identity),
        identity = identity,
        storedAt = storedAt,
        sourceFrom = valuedAt,
        sourceTo = valuedAt,
        sourceAsOf = valuedAt,
        pointCount = 1
    )

private fun StoredSeriesSnapshot.toPayloadSummary(storedAt: Instant): PayloadSnapshotSummary =
    PayloadSnapshotSummary(
        key = SnapshotIdentity(SnapshotPreferenceType.SERIES, identity),
        identity = identity,
        storedAt = storedAt,
        sourceFrom = points.minByOrNull(StoredPricePoint::date)?.date,
        sourceTo = points.maxByOrNull(StoredPricePoint::date)?.date,
        sourceAsOf = points.maxByOrNull(StoredPricePoint::date)?.date,
        pointCount = points.size
    )

private fun StoredMonthlyInflationSnapshot.toPayloadSummary(storedAt: Instant): PayloadSnapshotSummary =
    PayloadSnapshotSummary(
        key = SnapshotIdentity(SnapshotPreferenceType.INFLATION_MONTHLY, identity),
        identity = identity,
        storedAt = storedAt,
        sourceFrom = points.minByOrNull(StoredMonthlyInflationPoint::month)?.month,
        sourceTo = points.maxByOrNull(StoredMonthlyInflationPoint::month)?.month,
        sourceAsOf = points.maxByOrNull(StoredMonthlyInflationPoint::month)?.month,
        pointCount = points.size
    )

private fun StoredInflationWindow.toPayloadSummary(storedAt: Instant): PayloadSnapshotSummary =
    PayloadSnapshotSummary(
        key = SnapshotIdentity(SnapshotPreferenceType.INFLATION_WINDOW, from),
        identity = from,
        storedAt = storedAt,
        sourceFrom = from,
        sourceTo = sourceToMonth(from = from, untilExclusive = until),
        sourceAsOf = until,
        pointCount = null
    )

private fun sourceToMonth(from: String, untilExclusive: String): String =
    runCatching {
        val start = YearMonth.parse(from)
        val endExclusive = YearMonth.parse(untilExclusive)
        if (endExclusive > start) {
            endExclusive.minusMonths(1).toString()
        } else {
            start.toString()
        }
    }.getOrDefault(untilExclusive)

@Serializable
internal data class StoredQuoteSnapshot(
    val identity: String,
    val valuedAt: String,
    val pricePerUnitPln: String,
    val pricePerUnitNative: String? = null,
    val currentRatePercent: String? = null,
    val previousClosePln: String? = null
)

@Serializable
internal data class StoredSeriesSnapshot(
    val identity: String,
    val points: List<StoredPricePoint>
)

@Serializable
internal data class StoredPricePoint(
    val date: String,
    val closePricePln: String
)

@Serializable
internal data class StoredMonthlyInflationSnapshot(
    val identity: String,
    val points: List<StoredMonthlyInflationPoint>
)

@Serializable
internal data class StoredMonthlyInflationPoint(
    val month: String,
    val multiplier: String
)

@Serializable
internal data class StoredInflationWindow(
    val from: String,
    val until: String,
    val multiplier: String
)
