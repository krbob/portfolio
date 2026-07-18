package net.bobinski.portfolio.api.marketdata.client

import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import net.bobinski.portfolio.api.marketdata.contract.generated.StockAnalystApiErrorPayload
import net.bobinski.portfolio.api.marketdata.contract.generated.StockAnalystContractPaths
import net.bobinski.portfolio.api.marketdata.contract.generated.StockAnalystDataProvenancePayload
import net.bobinski.portfolio.api.marketdata.contract.generated.StockAnalystHistoricalPricePayload
import net.bobinski.portfolio.api.marketdata.contract.generated.StockAnalystQuotePayload
import net.bobinski.portfolio.api.marketdata.contract.generated.StockAnalystStockHistoryPayload
import net.bobinski.portfolio.api.marketdata.model.HistoricalPricePoint
import java.math.BigDecimal
import java.net.http.HttpClient
import java.time.Instant
import java.time.LocalDate

class StockAnalystClient(
    httpClient: HttpClient,
    private val json: Json,
    private val baseUrl: String
) {
    private val transport = UpstreamHttpTransport(httpClient)

    suspend fun quote(symbol: String, currency: String? = null): StockAnalystQuote {
        val payload = getWithLegacyRouteFallback(
            versionedPath = StockAnalystContractPaths.QUOTE,
            legacyPath = LEGACY_QUOTE_PATH,
            pathParameters = mapOf("stock" to symbol),
            queryParameters = listOf("currency" to currency),
            context = UpstreamRequestContext(
                upstream = STOCK_ANALYST,
                operation = "quote",
                subject = symbol
            ),
            decodeSuccess = { body -> json.decodeFromString<StockAnalystQuotePayload>(body) },
            decodeLegacySuccess = { body ->
                json.decodeFromString<LegacyStockAnalystQuotePayload>(body).toCurrentPayload()
            }
        )
        return StockAnalystQuote(
            symbol = payload.symbol,
            currency = payload.currency,
            date = LocalDate.parse(payload.date),
            lastPrice = payload.lastPrice,
            previousClose = payload.previousClose,
            provenance = payload.provenance.toDomain()
        )
    }

    suspend fun quoteInPln(symbol: String): StockAnalystQuote = quote(symbol = symbol, currency = "PLN")

    suspend fun history(
        symbol: String,
        currency: String? = null,
        from: LocalDate? = null,
        to: LocalDate? = null
    ): StockAnalystHistory {
        val payload = getWithLegacyRouteFallback(
            versionedPath = StockAnalystContractPaths.HISTORY,
            legacyPath = LEGACY_HISTORY_PATH,
            pathParameters = mapOf("stock" to symbol),
            queryParameters = listOf(
                "period" to "max",
                "interval" to "1d",
                "currency" to currency,
                "from" to from?.toString(),
                "to" to to?.toString()
            ),
            context = UpstreamRequestContext(
                upstream = STOCK_ANALYST,
                operation = "history",
                subject = symbol
            ),
            decodeSuccess = { body -> json.decodeFromString<StockAnalystStockHistoryPayload>(body) },
            decodeLegacySuccess = { body ->
                json.decodeFromString<LegacyStockAnalystHistoryPayload>(body).toCurrentPayload(currency)
            }
        )
        return StockAnalystHistory(
            prices = payload.prices.map { price ->
                HistoricalPricePoint(
                    date = LocalDate.parse(price.date),
                    closePricePln = BigDecimal.valueOf(price.close)
                )
            },
            provenance = payload.provenance.toDomain()
        )
    }

    suspend fun historyInPln(
        symbol: String,
        from: LocalDate? = null,
        to: LocalDate? = null
    ): StockAnalystHistory = history(symbol = symbol, currency = "PLN", from = from, to = to)

    private suspend fun <T> getWithLegacyRouteFallback(
        versionedPath: String,
        legacyPath: String,
        pathParameters: Map<String, String>,
        queryParameters: List<Pair<String, String?>>,
        context: UpstreamRequestContext,
        decodeSuccess: (String) -> T,
        decodeLegacySuccess: (String) -> T
    ): T = requestSemaphore.withPermit {
        try {
            get(
                path = versionedPath,
                pathParameters = pathParameters,
                queryParameters = queryParameters,
                context = context,
                decodeSuccess = decodeSuccess
            )
        } catch (exception: MarketDataClientException) {
            if (!exception.isRouteNotFound()) {
                throw exception
            }
            get(
                path = legacyPath,
                pathParameters = pathParameters,
                queryParameters = queryParameters,
                context = context,
                decodeSuccess = decodeLegacySuccess
            )
        }
    }

    private suspend fun <T> get(
        path: String,
        pathParameters: Map<String, String>,
        queryParameters: List<Pair<String, String?>>,
        context: UpstreamRequestContext,
        decodeSuccess: (String) -> T
    ): T = transport.get(
        uri = buildUpstreamUri(
            baseUrl = baseUrl,
            pathTemplate = path,
            pathParameters = pathParameters,
            queryParameters = queryParameters
        ),
        timeout = UpstreamTimeoutBudgets.STOCK_ANALYST,
        context = context,
        decodeSuccess = decodeSuccess,
        decodeError = ::decodeError
    )

    private fun decodeError(body: String): UpstreamErrorEnvelope? = runCatching {
        json.decodeFromString<StockAnalystApiErrorPayload>(body).toEnvelope()
    }.getOrNull()

    private fun StockAnalystApiErrorPayload.toEnvelope() = UpstreamErrorEnvelope(
        error = error,
        errorCode = errorCode,
        retryable = retryable,
        requestId = requestId
    )

    private fun StockAnalystDataProvenancePayload.toDomain() = StockAnalystDataProvenance(
        source = source,
        retrievedAt = Instant.parse(retrievedAt),
        marketTimestamp = marketTimestamp?.let(Instant::parse),
        marketDate = marketDate?.let(LocalDate::parse),
        currency = currency,
        unitScale = unitScale,
        adjustment = adjustment,
        coverageFrom = coverageFrom?.let(LocalDate::parse),
        coverageTo = coverageTo?.let(LocalDate::parse),
        status = status,
        priceStatus = priceStatus,
        analyticsStatus = analyticsStatus,
        analyticsLimitations = analyticsLimitations.orEmpty()
    )

    private companion object {
        const val STOCK_ANALYST = "stock-analyst"
        const val LEGACY_QUOTE_PATH = "/quote/{stock}"
        const val LEGACY_HISTORY_PATH = "/history/{stock}"
        // One history request can fan out to two parallel yfinance loaders
        // (metadata + prices). Keeping two requests in flight stays within the
        // Stock Analyst backend's default four-loader bulkhead.
        const val MAX_CONCURRENT_REQUESTS = 2
        val requestSemaphore = Semaphore(MAX_CONCURRENT_REQUESTS)
    }
}

private fun MarketDataClientException.isRouteNotFound(): Boolean =
    statusCode == 404 && when (errorCode) {
        "ROUTE_NOT_FOUND" -> true
        null -> upstreamError == null && responseBodyPreview == null
        else -> false
    }

@Serializable
private data class LegacyStockAnalystQuotePayload(
    val symbol: String,
    val currency: String? = null,
    val date: String,
    val lastPrice: Double,
    val previousClose: Double? = null
) {
    fun toCurrentPayload(): StockAnalystQuotePayload = StockAnalystQuotePayload(
        symbol = symbol,
        currency = currency,
        date = date,
        lastPrice = lastPrice,
        previousClose = previousClose,
        provenance = legacyProvenance(
            currency = currency,
            marketDate = date,
            coverageFrom = null,
            coverageTo = date
        )
    )
}

@Serializable
private data class LegacyStockAnalystHistoryPayload(
    val prices: List<LegacyStockAnalystHistoricalPricePayload>
) {
    fun toCurrentPayload(currency: String?): StockAnalystStockHistoryPayload {
        val dates = prices.map(LegacyStockAnalystHistoricalPricePayload::date)
        return StockAnalystStockHistoryPayload(
            prices = prices.map { price ->
                StockAnalystHistoricalPricePayload(date = price.date, close = price.close)
            },
            provenance = legacyProvenance(
                currency = currency,
                marketDate = dates.maxOrNull(),
                coverageFrom = dates.minOrNull(),
                coverageTo = dates.maxOrNull()
            )
        )
    }
}

@Serializable
private data class LegacyStockAnalystHistoricalPricePayload(
    val date: String,
    val close: Double
)

private fun legacyProvenance(
    currency: String?,
    marketDate: String?,
    coverageFrom: String?,
    coverageTo: String?
): StockAnalystDataProvenancePayload = StockAnalystDataProvenancePayload(
    source = "YAHOO_FINANCE",
    retrievedAt = Instant.now().toString(),
    marketDate = marketDate,
    currency = currency,
    unitScale = 1.0,
    adjustment = "SPLIT_ADJUSTED",
    coverageFrom = coverageFrom,
    coverageTo = coverageTo,
    status = "FRESH"
)

data class StockAnalystQuote(
    val symbol: String,
    val currency: String?,
    val date: LocalDate,
    val lastPrice: Double,
    val previousClose: Double? = null,
    val provenance: StockAnalystDataProvenance
)

data class StockAnalystHistory(
    val prices: List<HistoricalPricePoint>,
    val provenance: StockAnalystDataProvenance
)

data class StockAnalystDataProvenance(
    val source: String,
    val retrievedAt: Instant,
    val marketTimestamp: Instant?,
    val marketDate: LocalDate?,
    val currency: String?,
    val unitScale: Double,
    val adjustment: String,
    val coverageFrom: LocalDate?,
    val coverageTo: LocalDate?,
    val status: String,
    val priceStatus: String? = null,
    val analyticsStatus: String? = null,
    val analyticsLimitations: List<String> = emptyList()
)
