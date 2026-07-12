package net.bobinski.portfolio.api.marketdata.client

import kotlinx.serialization.json.Json
import net.bobinski.portfolio.api.marketdata.contract.generated.StockAnalystApiErrorPayload
import net.bobinski.portfolio.api.marketdata.contract.generated.StockAnalystContractPaths
import net.bobinski.portfolio.api.marketdata.contract.generated.StockAnalystDataProvenancePayload
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
        val payload = transport.get(
            uri = buildUpstreamUri(
                baseUrl = baseUrl,
                pathTemplate = StockAnalystContractPaths.QUOTE,
                pathParameters = mapOf("stock" to symbol),
                queryParameters = listOf("currency" to currency)
            ),
            timeout = UpstreamTimeoutBudgets.STOCK_ANALYST,
            context = UpstreamRequestContext(
                upstream = STOCK_ANALYST,
                operation = "quote",
                subject = symbol
            ),
            decodeSuccess = { body -> json.decodeFromString<StockAnalystQuotePayload>(body) },
            decodeError = ::decodeError
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
        val payload = transport.get(
            uri = buildUpstreamUri(
                baseUrl = baseUrl,
                pathTemplate = StockAnalystContractPaths.HISTORY,
                pathParameters = mapOf("stock" to symbol),
                queryParameters = listOf(
                    "period" to "max",
                    "interval" to "1d",
                    "currency" to currency,
                    "from" to from?.toString(),
                    "to" to to?.toString()
                )
            ),
            timeout = UpstreamTimeoutBudgets.STOCK_ANALYST,
            context = UpstreamRequestContext(
                upstream = STOCK_ANALYST,
                operation = "history",
                subject = symbol
            ),
            decodeSuccess = { body -> json.decodeFromString<StockAnalystStockHistoryPayload>(body) },
            decodeError = ::decodeError
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
        status = status
    )

    private companion object {
        const val STOCK_ANALYST = "stock-analyst"
    }
}

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
    val status: String
)
