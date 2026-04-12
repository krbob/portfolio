package net.bobinski.portfolio.api.domain.service

import java.time.Clock
import java.time.DayOfWeek
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.ZonedDateTime

class MarketDataFreshnessPolicy(
    private val clock: Clock,
    private val staleAfterTradingDays: Long
) {
    fun isQuoteStale(
        valuedAt: LocalDate,
        symbolHint: String? = null
    ): Boolean = isStale(
        valuedAt = valuedAt,
        asOf = LocalDate.now(clock),
        symbolHint = symbolHint,
        dataType = MarketDataFreshnessType.QUOTE
    )

    fun isDailySeriesStale(
        valuedAt: LocalDate,
        asOf: LocalDate,
        symbolHint: String? = null
    ): Boolean = isStale(
        valuedAt = valuedAt,
        asOf = asOf,
        symbolHint = symbolHint,
        dataType = MarketDataFreshnessType.DAILY_SERIES
    )

    private fun isStale(
        valuedAt: LocalDate,
        asOf: LocalDate,
        symbolHint: String?,
        dataType: MarketDataFreshnessType
    ): Boolean {
        if (!valuedAt.isBefore(asOf)) {
            return false
        }

        val venue = venueForSymbol(symbolHint)
        val expectedLatestDate = expectedLatestTradingDate(
            asOf = asOf,
            venue = venue,
            dataType = dataType
        )
        if (!valuedAt.isBefore(expectedLatestDate)) {
            return false
        }

        val missedTradingDays = tradingDaysBetweenExclusive(
            startExclusive = valuedAt,
            endInclusive = expectedLatestDate
        )
        return when (dataType) {
            MarketDataFreshnessType.QUOTE -> missedTradingDays > staleThreshold(venue)
            MarketDataFreshnessType.DAILY_SERIES -> missedTradingDays >= staleThreshold(venue)
        }
    }

    private fun expectedLatestTradingDate(
        asOf: LocalDate,
        venue: MarketVenueHint,
        dataType: MarketDataFreshnessType
    ): LocalDate {
        val marketNow = ZonedDateTime.ofInstant(Instant.now(clock), venue.zoneId)
        val baseDate = if (asOf == marketNow.toLocalDate() && shouldDeferToPreviousTradingDay(marketNow.toLocalTime(), venue, dataType)) {
            asOf.minusDays(1)
        } else {
            asOf
        }
        return latestTradingDayOnOrBefore(baseDate)
    }

    private fun shouldDeferToPreviousTradingDay(
        marketTime: LocalTime,
        venue: MarketVenueHint,
        dataType: MarketDataFreshnessType
    ): Boolean = when (dataType) {
        MarketDataFreshnessType.QUOTE -> marketTime.isBefore(venue.marketOpenTime)
        MarketDataFreshnessType.DAILY_SERIES -> marketTime.isBefore(venue.dailySeriesPublishTime)
    }

    private fun latestTradingDayOnOrBefore(date: LocalDate): LocalDate {
        var current = date
        while (!isTradingDay(current)) {
            current = current.minusDays(1)
        }
        return current
    }

    private fun tradingDaysBetweenExclusive(
        startExclusive: LocalDate,
        endInclusive: LocalDate
    ): Long {
        var count = 0L
        var current = startExclusive.plusDays(1)
        while (!current.isAfter(endInclusive)) {
            if (isTradingDay(current)) {
                count += 1
            }
            current = current.plusDays(1)
        }
        return count
    }

    private fun staleThreshold(venue: MarketVenueHint): Long =
        staleAfterTradingDays + venue.extraGraceTradingDays

    private fun isTradingDay(date: LocalDate): Boolean = when (date.dayOfWeek) {
        DayOfWeek.SATURDAY,
        DayOfWeek.SUNDAY -> false

        else -> true
    }

    private fun venueForSymbol(symbolHint: String?): MarketVenueHint {
        val symbol = symbolHint?.trim()?.uppercase().orEmpty()
        return when {
            symbol.endsWith(".L") -> MarketVenueHint(
                zoneId = ZoneId.of("Europe/London"),
                marketOpenTime = LocalTime.of(8, 0),
                dailySeriesPublishTime = LocalTime.of(19, 30),
                extraGraceTradingDays = 1
            )

            symbol.endsWith(".DE") -> MarketVenueHint(
                zoneId = ZoneId.of("Europe/Berlin"),
                marketOpenTime = LocalTime.of(9, 0),
                dailySeriesPublishTime = LocalTime.of(19, 30)
            )

            symbol.endsWith(".WA") -> MarketVenueHint(
                zoneId = ZoneId.of("Europe/Warsaw"),
                marketOpenTime = LocalTime.of(9, 0),
                dailySeriesPublishTime = LocalTime.of(19, 0)
            )

            symbol.endsWith("=X") -> MarketVenueHint(
                zoneId = ZoneId.of("UTC"),
                marketOpenTime = LocalTime.MIDNIGHT,
                dailySeriesPublishTime = LocalTime.of(23, 0)
            )

            symbol.endsWith("=F") -> MarketVenueHint(
                zoneId = ZoneId.of("America/Chicago"),
                marketOpenTime = LocalTime.of(8, 30),
                dailySeriesPublishTime = LocalTime.of(18, 0)
            )

            else -> MarketVenueHint(
                zoneId = ZoneId.of("UTC"),
                marketOpenTime = LocalTime.of(9, 0),
                dailySeriesPublishTime = LocalTime.of(20, 0)
            )
        }
    }
}

private data class MarketVenueHint(
    val zoneId: ZoneId,
    val marketOpenTime: LocalTime,
    val dailySeriesPublishTime: LocalTime,
    val extraGraceTradingDays: Long = 0
)

private enum class MarketDataFreshnessType {
    QUOTE,
    DAILY_SERIES
}
