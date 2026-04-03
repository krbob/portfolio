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
    suspend fun quote(symbol: String, currency: String? = null): StockAnalystQuote = withContext(Dispatchers.IO) {
        val encodedSymbol = URLEncoder.encode(symbol, StandardCharsets.UTF_8).replace("+", "%20")
        val currencyQuery = currency?.let { "?currency=$it" } ?: ""
        val request = HttpRequest.newBuilder()
            .uri(URI.create("${baseUrl.trimEnd('/')}/quote/$encodedSymbol$currencyQuery"))
            .timeout(Duration.ofSeconds(10))
            .GET()
            .build()

        val response = httpClient.send(request, HttpResponse.BodyHandlers.ofString())
        if (response.statusCode() !in 200..299) {
            throw MarketDataClientException(
                message = "stock-analyst returned HTTP ${response.statusCode()} for symbol $symbol.",
                upstream = "stock-analyst",
                operation = "quote",
                symbol = symbol,
                statusCode = response.statusCode(),
                responseBodyPreview = responseBodyPreview(response.body())
            )
        }

        val payload = json.decodeFromString<StockAnalystQuoteResponse>(response.body())
        StockAnalystQuote(
            symbol = payload.symbol,
            currency = payload.currency,
            date = LocalDate.parse(payload.date),
            lastPrice = payload.lastPrice,
            previousClose = payload.previousClose
        )
    }

    suspend fun quoteInPln(symbol: String): StockAnalystQuote = quote(symbol = symbol, currency = "PLN")

    suspend fun history(
        symbol: String,
        currency: String? = null,
        from: LocalDate? = null,
        to: LocalDate? = null
    ): List<HistoricalPricePoint> = withContext(Dispatchers.IO) {
        val encodedSymbol = URLEncoder.encode(symbol, StandardCharsets.UTF_8).replace("+", "%20")
        val currencyQuery = currency?.let { "&currency=$it" } ?: ""
        val fromQuery = from?.let { "&from=$it" } ?: ""
        val toQuery = to?.let { "&to=$it" } ?: ""
        val request = HttpRequest.newBuilder()
            .uri(URI.create("${baseUrl.trimEnd('/')}/history/$encodedSymbol?period=max&interval=1d$currencyQuery$fromQuery$toQuery"))
            .timeout(Duration.ofSeconds(20))
            .GET()
            .build()

        val response = httpClient.send(request, HttpResponse.BodyHandlers.ofString())
        if (response.statusCode() !in 200..299) {
            throw MarketDataClientException(
                message = "stock-analyst history returned HTTP ${response.statusCode()} for symbol $symbol.",
                upstream = "stock-analyst",
                operation = "history",
                symbol = symbol,
                statusCode = response.statusCode(),
                responseBodyPreview = responseBodyPreview(response.body())
            )
        }

        val payload = json.decodeFromString<StockAnalystHistoryResponse>(response.body())
        payload.prices.map { price ->
            HistoricalPricePoint(
                date = LocalDate.parse(price.date),
                closePricePln = BigDecimal.valueOf(price.close)
            )
        }
    }

    suspend fun historyInPln(
        symbol: String,
        from: LocalDate? = null,
        to: LocalDate? = null
    ): List<HistoricalPricePoint> = history(symbol = symbol, currency = "PLN", from = from, to = to)
}

data class StockAnalystQuote(
    val symbol: String,
    val currency: String?,
    val date: LocalDate,
    val lastPrice: Double,
    val previousClose: Double? = null
)

@Serializable
private data class StockAnalystQuoteResponse(
    val symbol: String,
    val currency: String? = null,
    val date: String,
    @SerialName("lastPrice") val lastPrice: Double,
    val previousClose: Double? = null
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
