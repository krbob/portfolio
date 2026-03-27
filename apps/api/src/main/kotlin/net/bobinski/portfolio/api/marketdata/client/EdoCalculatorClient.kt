package net.bobinski.portfolio.api.marketdata.client

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import net.bobinski.portfolio.api.domain.model.EdoLotTerms
import kotlinx.serialization.json.Json
import net.bobinski.portfolio.api.marketdata.model.HistoricalPricePoint
import java.math.BigDecimal
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Duration
import java.time.LocalDate
import java.time.YearMonth

class EdoCalculatorClient(
    private val httpClient: HttpClient,
    private val json: Json,
    private val baseUrl: String
) {
    suspend fun unitValueInPln(terms: EdoLotTerms, asOf: LocalDate? = null): EdoUnitValue = withContext(Dispatchers.IO) {
        val request = HttpRequest.newBuilder()
            .uri(URI.create(buildUrl(terms = terms, asOf = asOf)))
            .timeout(Duration.ofSeconds(10))
            .GET()
            .build()

        val response = httpClient.send(request, HttpResponse.BodyHandlers.ofString())
        if (response.statusCode() !in 200..299) {
            throw MarketDataClientException(
                message = "edo-calculator returned HTTP ${response.statusCode()} for purchase date ${terms.purchaseDate}.",
                upstream = "edo-calculator",
                operation = "value",
                symbol = terms.purchaseDate.toString(),
                statusCode = response.statusCode(),
                responseBodyPreview = responseBodyPreview(response.body())
            )
        }

        val payload = json.decodeFromString<EdoCalculatorResponse>(response.body())
        val activePeriod = payload.edoValue.periods.firstOrNull { it.daysElapsed < it.daysInPeriod }
        EdoUnitValue(
            asOf = LocalDate.parse(payload.asOf),
            totalValue = payload.edoValue.totalValue.toBigDecimal(),
            currentRatePercent = activePeriod?.ratePercent?.toBigDecimal()
        )
    }

    suspend fun historyInPln(
        terms: EdoLotTerms,
        from: LocalDate? = null,
        to: LocalDate? = null
    ): List<HistoricalPricePoint> = withContext(Dispatchers.IO) {
        val request = HttpRequest.newBuilder()
            .uri(URI.create(buildHistoryUrl(terms = terms, from = from, to = to)))
            .timeout(Duration.ofSeconds(20))
            .GET()
            .build()

        val response = httpClient.send(request, HttpResponse.BodyHandlers.ofString())
        if (response.statusCode() !in 200..299) {
            throw MarketDataClientException(
                message = "edo-calculator history returned HTTP ${response.statusCode()} for purchase date ${terms.purchaseDate}.",
                upstream = "edo-calculator",
                operation = "history",
                symbol = terms.purchaseDate.toString(),
                statusCode = response.statusCode(),
                responseBodyPreview = responseBodyPreview(response.body())
            )
        }

        val payload = json.decodeFromString<EdoHistoryResponse>(response.body())
        payload.points.map { point ->
            HistoricalPricePoint(
                date = LocalDate.parse(point.date),
                closePricePln = point.totalValue.toBigDecimal()
            )
        }
    }

    suspend fun inflationSince(from: YearMonth): InflationWindow = withContext(Dispatchers.IO) {
        val request = HttpRequest.newBuilder()
            .uri(URI.create(buildInflationSinceUrl(from = from)))
            .timeout(Duration.ofSeconds(10))
            .GET()
            .build()

        val response = httpClient.send(request, HttpResponse.BodyHandlers.ofString())
        if (response.statusCode() !in 200..299) {
            throw MarketDataClientException(
                message = "edo-calculator inflation returned HTTP ${response.statusCode()} for $from.",
                upstream = "edo-calculator",
                operation = "inflation",
                symbol = from.toString(),
                statusCode = response.statusCode(),
                responseBodyPreview = responseBodyPreview(response.body())
            )
        }

        val payload = json.decodeFromString<EdoInflationResponse>(response.body())
        InflationWindow(
            from = YearMonth.parse(payload.from),
            until = YearMonth.parse(payload.until),
            multiplier = payload.multiplier.toBigDecimal()
        )
    }

    suspend fun monthlyInflation(from: YearMonth, untilExclusive: YearMonth): MonthlyInflationSeries = withContext(Dispatchers.IO) {
        val request = HttpRequest.newBuilder()
            .uri(URI.create(buildMonthlyInflationUrl(from = from, untilExclusive = untilExclusive)))
            .timeout(Duration.ofSeconds(10))
            .GET()
            .build()

        val response = httpClient.send(request, HttpResponse.BodyHandlers.ofString())
        if (response.statusCode() !in 200..299) {
            throw MarketDataClientException(
                message = "edo-calculator monthly inflation returned HTTP ${response.statusCode()} for $from..$untilExclusive.",
                upstream = "edo-calculator",
                operation = "monthly-inflation",
                symbol = "$from..$untilExclusive",
                statusCode = response.statusCode(),
                responseBodyPreview = responseBodyPreview(response.body())
            )
        }

        val payload = json.decodeFromString<EdoMonthlyInflationResponse>(response.body())
        MonthlyInflationSeries(
            from = YearMonth.parse(payload.from),
            until = YearMonth.parse(payload.until),
            points = payload.points.map { point ->
                MonthlyInflationPoint(
                    month = YearMonth.parse(point.month),
                    multiplier = point.multiplier.toBigDecimal()
                )
            }
        )
    }

    private fun buildUrl(terms: EdoLotTerms, asOf: LocalDate?): String {
        val path = if (asOf == null) "/edo/value" else "/edo/value/at"
        val params = linkedMapOf(
            "purchaseYear" to terms.purchaseDate.year.toString(),
            "purchaseMonth" to terms.purchaseDate.monthValue.toString(),
            "purchaseDay" to terms.purchaseDate.dayOfMonth.toString(),
            "firstPeriodRate" to terms.firstPeriodRateBps.toDecimalRate(),
            "margin" to terms.marginBps.toDecimalRate(),
            "principal" to "100"
        )
        if (asOf != null) {
            params["asOfYear"] = asOf.year.toString()
            params["asOfMonth"] = asOf.monthValue.toString()
            params["asOfDay"] = asOf.dayOfMonth.toString()
        }

        val queryString = params.entries.joinToString("&") { (key, value) -> "$key=$value" }
        return "${baseUrl.trimEnd('/')}$path?$queryString"
    }

    private fun buildHistoryUrl(terms: EdoLotTerms, from: LocalDate?, to: LocalDate?): String {
        val params = linkedMapOf(
            "purchaseYear" to terms.purchaseDate.year.toString(),
            "purchaseMonth" to terms.purchaseDate.monthValue.toString(),
            "purchaseDay" to terms.purchaseDate.dayOfMonth.toString(),
            "firstPeriodRate" to terms.firstPeriodRateBps.toDecimalRate(),
            "margin" to terms.marginBps.toDecimalRate(),
            "principal" to "100"
        )
        if (from != null) {
            params["fromYear"] = from.year.toString()
            params["fromMonth"] = from.monthValue.toString()
            params["fromDay"] = from.dayOfMonth.toString()
        }
        if (to != null) {
            params["toYear"] = to.year.toString()
            params["toMonth"] = to.monthValue.toString()
            params["toDay"] = to.dayOfMonth.toString()
        }

        val queryString = params.entries.joinToString("&") { (key, value) -> "$key=$value" }
        return "${baseUrl.trimEnd('/')}/edo/history?$queryString"
    }

    private fun buildInflationSinceUrl(from: YearMonth): String =
        "${baseUrl.trimEnd('/')}/inflation/since?year=${from.year}&month=${from.monthValue}"

    private fun buildMonthlyInflationUrl(from: YearMonth, untilExclusive: YearMonth): String =
        "${baseUrl.trimEnd('/')}/inflation/monthly" +
            "?startYear=${from.year}&startMonth=${from.monthValue}" +
            "&endYear=${untilExclusive.year}&endMonth=${untilExclusive.monthValue}"

    private fun Int.toDecimalRate(): String =
        BigDecimal(this).divide(BigDecimal(100)).stripTrailingZeros().toPlainString()
}

data class EdoUnitValue(
    val asOf: LocalDate,
    val totalValue: BigDecimal,
    val currentRatePercent: BigDecimal? = null
)

data class InflationWindow(
    val from: YearMonth,
    val until: YearMonth,
    val multiplier: BigDecimal
)

data class MonthlyInflationSeries(
    val from: YearMonth,
    val until: YearMonth,
    val points: List<MonthlyInflationPoint>
)

data class MonthlyInflationPoint(
    val month: YearMonth,
    val multiplier: BigDecimal
)

@Serializable
private data class EdoCalculatorResponse(
    val asOf: String,
    val edoValue: EdoValueResponse
)

@Serializable
private data class EdoValueResponse(
    val totalValue: String,
    val periods: List<EdoPeriodResponse> = emptyList()
)

@Serializable
private data class EdoPeriodResponse(
    val daysInPeriod: Int,
    val daysElapsed: Int,
    val ratePercent: String
)

@Serializable
private data class EdoHistoryResponse(
    val points: List<EdoHistoryPointResponse>
)

@Serializable
private data class EdoHistoryPointResponse(
    val date: String,
    val totalValue: String
)

@Serializable
private data class EdoInflationResponse(
    val from: String,
    val until: String,
    val multiplier: String
)

@Serializable
private data class EdoMonthlyInflationResponse(
    val from: String,
    val until: String,
    val points: List<EdoMonthlyInflationPointResponse>
)

@Serializable
private data class EdoMonthlyInflationPointResponse(
    val month: String,
    val multiplier: String
)
