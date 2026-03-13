package net.bobinski.portfolio.api.marketdata.client

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import net.bobinski.portfolio.api.marketdata.model.HistoricalPricePoint
import java.math.BigDecimal
import java.net.URI
import java.net.URLEncoder
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.nio.charset.StandardCharsets
import java.time.Duration
import java.time.LocalDate

class StockAnalystClient(
    private val httpClient: HttpClient,
    private val json: Json,
    private val baseUrl: String
) {
    suspend fun quoteInPln(symbol: String): StockAnalystQuote = withContext(Dispatchers.IO) {
        val encodedSymbol = URLEncoder.encode(symbol, StandardCharsets.UTF_8).replace("+", "%20")
        val request = HttpRequest.newBuilder()
            .uri(URI.create("${baseUrl.trimEnd('/')}/quote/$encodedSymbol?currency=PLN"))
            .timeout(Duration.ofSeconds(10))
            .GET()
            .build()

        val response = httpClient.send(request, HttpResponse.BodyHandlers.ofString())
        if (response.statusCode() !in 200..299) {
            throw MarketDataClientException("stock-analyst returned HTTP ${response.statusCode()} for symbol $symbol.")
        }

        val payload = json.decodeFromString<StockAnalystQuoteResponse>(response.body())
        StockAnalystQuote(
            symbol = payload.symbol,
            currency = payload.currency,
            date = LocalDate.parse(payload.date),
            lastPrice = payload.lastPrice
        )
    }

    suspend fun historyInPln(symbol: String): List<HistoricalPricePoint> = withContext(Dispatchers.IO) {
        val encodedSymbol = URLEncoder.encode(symbol, StandardCharsets.UTF_8).replace("+", "%20")
        val request = HttpRequest.newBuilder()
            .uri(URI.create("${baseUrl.trimEnd('/')}/history/$encodedSymbol?period=max&interval=1d&currency=PLN"))
            .timeout(Duration.ofSeconds(20))
            .GET()
            .build()

        val response = httpClient.send(request, HttpResponse.BodyHandlers.ofString())
        if (response.statusCode() !in 200..299) {
            throw MarketDataClientException("stock-analyst history returned HTTP ${response.statusCode()} for symbol $symbol.")
        }

        val payload = json.decodeFromString<StockAnalystHistoryResponse>(response.body())
        payload.prices.map { price ->
            HistoricalPricePoint(
                date = LocalDate.parse(price.date),
                closePricePln = BigDecimal.valueOf(price.close)
            )
        }
    }
}

data class StockAnalystQuote(
    val symbol: String,
    val currency: String?,
    val date: LocalDate,
    val lastPrice: Double
)

@Serializable
private data class StockAnalystQuoteResponse(
    val symbol: String,
    val currency: String? = null,
    val date: String,
    @SerialName("lastPrice") val lastPrice: Double
)

@Serializable
private data class StockAnalystHistoryResponse(
    val prices: List<StockAnalystHistoryPriceResponse>
)

@Serializable
private data class StockAnalystHistoryPriceResponse(
    val date: String,
    val close: Double
)
