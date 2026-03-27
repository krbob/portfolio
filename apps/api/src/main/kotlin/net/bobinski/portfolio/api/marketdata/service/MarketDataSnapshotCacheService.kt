package net.bobinski.portfolio.api.marketdata.service

import java.math.BigDecimal
import java.security.MessageDigest
import java.time.Instant
import java.time.LocalDate
import java.time.YearMonth
import kotlinx.serialization.Serializable
import net.bobinski.portfolio.api.domain.service.AppPreferenceService
import net.bobinski.portfolio.api.marketdata.model.HistoricalPricePoint

class MarketDataSnapshotCacheService(
    private val appPreferenceService: AppPreferenceService
) {
    suspend fun listSnapshots(): List<MarketDataSnapshotSummary> =
        appPreferenceService.listByPrefix(MarketDataSnapshotPreferences.PREFERENCE_KEY_PREFIX)
            .mapNotNull { preference ->
                val key = preference.key.removePrefix(MarketDataSnapshotPreferences.PREFERENCE_KEY_PREFIX)
                val type = key.substringBefore('.', missingDelimiterValue = "")
                when (type) {
                    "quote" -> appPreferenceService.decodeOrNull(preference, StoredQuoteSnapshot.serializer())
                        ?.toSummary(preference.updatedAt)
                    "series" -> appPreferenceService.decodeOrNull(preference, StoredSeriesSnapshot.serializer())
                        ?.toSummary(preference.updatedAt)
                    "inflation-monthly" -> appPreferenceService.decodeOrNull(preference, StoredMonthlyInflationSnapshot.serializer())
                        ?.toSummary(preference.updatedAt)
                    "inflation-window" -> appPreferenceService.decodeOrNull(preference, StoredInflationWindow.serializer())
                        ?.toSummary(preference.updatedAt)
                    else -> null
                }
            }
            .sortedWith(
                compareByDescending<MarketDataSnapshotSummary> { it.cachedAt }
                    .thenBy(MarketDataSnapshotSummary::snapshotType)
                    .thenBy(MarketDataSnapshotSummary::identity)
            )

    suspend fun putQuote(identity: String, valuation: InstrumentValuation) {
        appPreferenceService.put(
            key = preferenceKey("quote", identity),
            serializer = StoredQuoteSnapshot.serializer(),
            value = StoredQuoteSnapshot(
                identity = identity,
                valuedAt = valuation.valuedAt.toString(),
                pricePerUnitPln = valuation.pricePerUnitPln.toPlainString(),
                currentRatePercent = valuation.currentRatePercent?.toPlainString()
            )
        )
    }

    suspend fun getQuote(identity: String): InstrumentValuation? {
        val stored = appPreferenceService.getOrNull(
            key = preferenceKey("quote", identity),
            serializer = StoredQuoteSnapshot.serializer()
        ) ?: return null

        return InstrumentValuation(
            pricePerUnitPln = stored.pricePerUnitPln.toBigDecimal(),
            valuedAt = LocalDate.parse(stored.valuedAt),
            currentRatePercent = stored.currentRatePercent?.toBigDecimal()
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

        appPreferenceService.put(
            key = preferenceKey("series", identity),
            serializer = StoredSeriesSnapshot.serializer(),
            value = StoredSeriesSnapshot(
                identity = identity,
                points = mergedPoints
            )
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

        appPreferenceService.put(
            key = preferenceKey("inflation-monthly", identity),
            serializer = StoredMonthlyInflationSnapshot.serializer(),
            value = StoredMonthlyInflationSnapshot(
                identity = identity,
                points = mergedPoints
            )
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
        appPreferenceService.put(
            key = preferenceKey("inflation-window", result.from.toString()),
            serializer = StoredInflationWindow.serializer(),
            value = StoredInflationWindow(
                from = result.from.toString(),
                until = result.until.toString(),
                multiplier = result.multiplier.toPlainString()
            )
        )
    }

    suspend fun getCumulativeInflation(from: YearMonth): InflationAdjustmentResult.Success? {
        val direct = appPreferenceService.getOrNull(
            key = preferenceKey("inflation-window", from.toString()),
            serializer = StoredInflationWindow.serializer()
        )
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

    private suspend fun getStoredSeries(identity: String): StoredSeriesSnapshot? =
        appPreferenceService.getOrNull(
            key = preferenceKey("series", identity),
            serializer = StoredSeriesSnapshot.serializer()
        )

    private suspend fun getStoredMonthlyInflation(identity: String): StoredMonthlyInflationSnapshot? =
        appPreferenceService.getOrNull(
            key = preferenceKey("inflation-monthly", identity),
            serializer = StoredMonthlyInflationSnapshot.serializer()
        )

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
    val pointCount: Int?
)

private fun StoredQuoteSnapshot.toSummary(cachedAt: Instant): MarketDataSnapshotSummary =
    MarketDataSnapshotSummary(
        snapshotType = "QUOTE",
        identity = identity,
        cachedAt = cachedAt,
        sourceFrom = valuedAt,
        sourceTo = valuedAt,
        sourceAsOf = valuedAt,
        pointCount = 1
    )

private fun StoredSeriesSnapshot.toSummary(cachedAt: Instant): MarketDataSnapshotSummary =
    MarketDataSnapshotSummary(
        snapshotType = "PRICE_SERIES",
        identity = identity,
        cachedAt = cachedAt,
        sourceFrom = points.minByOrNull(StoredPricePoint::date)?.date,
        sourceTo = points.maxByOrNull(StoredPricePoint::date)?.date,
        sourceAsOf = points.maxByOrNull(StoredPricePoint::date)?.date,
        pointCount = points.size
    )

private fun StoredMonthlyInflationSnapshot.toSummary(cachedAt: Instant): MarketDataSnapshotSummary =
    MarketDataSnapshotSummary(
        snapshotType = "INFLATION_MONTHLY",
        identity = identity,
        cachedAt = cachedAt,
        sourceFrom = points.minByOrNull(StoredMonthlyInflationPoint::month)?.month,
        sourceTo = points.maxByOrNull(StoredMonthlyInflationPoint::month)?.month,
        sourceAsOf = points.maxByOrNull(StoredMonthlyInflationPoint::month)?.month,
        pointCount = points.size
    )

private fun StoredInflationWindow.toSummary(cachedAt: Instant): MarketDataSnapshotSummary =
    MarketDataSnapshotSummary(
        snapshotType = "INFLATION_WINDOW",
        identity = from,
        cachedAt = cachedAt,
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
    val currentRatePercent: String? = null
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
