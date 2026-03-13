package net.bobinski.portfolio.api.marketdata.client

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import net.bobinski.portfolio.api.domain.model.EdoTerms
import java.math.BigDecimal
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Duration
import java.time.LocalDate

class EdoCalculatorClient(
    private val httpClient: HttpClient,
    private val json: Json,
    private val baseUrl: String
) {
    suspend fun unitValueInPln(terms: EdoTerms, asOf: LocalDate? = null): EdoUnitValue = withContext(Dispatchers.IO) {
        val request = HttpRequest.newBuilder()
            .uri(URI.create(buildUrl(terms = terms, asOf = asOf)))
            .timeout(Duration.ofSeconds(10))
            .GET()
            .build()

        val response = httpClient.send(request, HttpResponse.BodyHandlers.ofString())
        if (response.statusCode() !in 200..299) {
            throw MarketDataClientException(
                "edo-calculator returned HTTP ${response.statusCode()} for purchase date ${terms.purchaseDate}."
            )
        }

        val payload = json.decodeFromString<EdoCalculatorResponse>(response.body())
        EdoUnitValue(
            asOf = LocalDate.parse(payload.asOf),
            totalValue = payload.edoValue.totalValue.toBigDecimal()
        )
    }

    private fun buildUrl(terms: EdoTerms, asOf: LocalDate?): String {
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

    private fun Int.toDecimalRate(): String =
        BigDecimal(this).divide(BigDecimal(100)).stripTrailingZeros().toPlainString()
}

data class EdoUnitValue(
    val asOf: LocalDate,
    val totalValue: BigDecimal
)

@Serializable
private data class EdoCalculatorResponse(
    val asOf: String,
    val edoValue: EdoValueResponse
)

@Serializable
private data class EdoValueResponse(
    val totalValue: String
)
