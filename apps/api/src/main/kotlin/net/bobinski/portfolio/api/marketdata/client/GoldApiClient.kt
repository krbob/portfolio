package net.bobinski.portfolio.api.marketdata.client

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.contentOrNull
import java.math.BigDecimal
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Duration
import java.time.LocalDate
import java.time.ZoneOffset

class GoldApiClient(
    private val httpClient: HttpClient,
    private val json: Json,
    private val baseUrl: String
) {
    suspend fun historyUsd(
        apiKey: String,
        symbol: String = "XAU",
        from: LocalDate,
        to: LocalDate
    ): List<GoldApiHistoryPoint> = withContext(Dispatchers.IO) {
        val request = HttpRequest.newBuilder()
            .uri(URI.create(buildHistoryUrl(symbol = symbol, from = from, to = to)))
            .timeout(Duration.ofSeconds(20))
            .header("x-api-key", apiKey)
            .GET()
            .build()

        val response = httpClient.send(request, HttpResponse.BodyHandlers.ofString())
        if (response.statusCode() !in 200..299) {
            throw MarketDataClientException(
                message = "gold-api history returned HTTP ${response.statusCode()} for symbol $symbol.",
                upstream = "gold-api",
                operation = "history",
                symbol = symbol,
                statusCode = response.statusCode(),
                responseBodyPreview = responseBodyPreview(response.body())
            )
        }

        val payload = json.parseToJsonElement(response.body()).jsonArray
        payload.mapNotNull { element ->
            val point = element.jsonObject
            val day = point["day"]?.jsonPrimitive?.contentOrNull ?: return@mapNotNull null
            val avgPrice = point["avg_price"]?.jsonPrimitive?.contentOrNull ?: return@mapNotNull null
            GoldApiHistoryPoint(
                date = parseHistoryDay(day),
                closePriceUsd = BigDecimal(avgPrice)
            )
        }
    }

    private fun buildHistoryUrl(
        symbol: String,
        from: LocalDate,
        to: LocalDate
    ): String {
        val startTimestamp = from.atStartOfDay().toEpochSecond(ZoneOffset.UTC)
        val endTimestamp = to.plusDays(1).atStartOfDay().minusSeconds(1).toEpochSecond(ZoneOffset.UTC)
        return buildString {
            append(baseUrl.trimEnd('/'))
            append("/history")
            append("?symbol=")
            append(symbol)
            append("&groupBy=day")
            append("&aggregation=avg")
            append("&orderBy=asc")
            append("&startTimestamp=")
            append(startTimestamp)
            append("&endTimestamp=")
            append(endTimestamp)
        }
    }

    private fun parseHistoryDay(day: String): LocalDate {
        val normalized = day.substringBefore('T').substringBefore(' ')
        return LocalDate.parse(normalized)
    }
}

data class GoldApiHistoryPoint(
    val date: LocalDate,
    val closePriceUsd: BigDecimal
)
