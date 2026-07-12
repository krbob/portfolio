package net.bobinski.portfolio.api.marketdata.client

import kotlinx.serialization.json.Json
import net.bobinski.portfolio.api.domain.model.EdoLotTerms
import net.bobinski.portfolio.api.marketdata.contract.generated.EdoCalculatorApiErrorResponsePayload
import net.bobinski.portfolio.api.marketdata.contract.generated.EdoCalculatorContractPaths
import net.bobinski.portfolio.api.marketdata.contract.generated.EdoCalculatorEdoHistoryResponsePayload
import net.bobinski.portfolio.api.marketdata.contract.generated.EdoCalculatorEdoResponsePayload
import net.bobinski.portfolio.api.marketdata.contract.generated.EdoCalculatorInflationResponsePayload
import net.bobinski.portfolio.api.marketdata.contract.generated.EdoCalculatorMonthlyInflationSeriesResponsePayload
import net.bobinski.portfolio.api.marketdata.model.HistoricalPricePoint
import java.math.BigDecimal
import java.net.http.HttpClient
import java.time.LocalDate
import java.time.YearMonth

class EdoCalculatorClient(
    httpClient: HttpClient,
    private val json: Json,
    private val baseUrl: String
) {
    private val transport = UpstreamHttpTransport(httpClient)

    suspend fun unitValueInPln(terms: EdoLotTerms, asOf: LocalDate? = null): EdoUnitValue {
        val path = if (asOf == null) {
            EdoCalculatorContractPaths.CURRENT_VALUE
        } else {
            EdoCalculatorContractPaths.VALUE_AT_DATE
        }
        val payload = transport.get(
            uri = buildUpstreamUri(
                baseUrl = baseUrl,
                pathTemplate = path,
                queryParameters = edoParameters(terms) + listOf(
                    "asOfYear" to asOf?.year?.toString(),
                    "asOfMonth" to asOf?.monthValue?.toString(),
                    "asOfDay" to asOf?.dayOfMonth?.toString()
                )
            ),
            timeout = UpstreamTimeoutBudgets.EDO_CALCULATOR,
            context = context("value", terms.purchaseDate.toString()),
            decodeSuccess = { body -> json.decodeFromString<EdoCalculatorEdoResponsePayload>(body) },
            decodeError = ::decodeError
        )
        val activePeriod = payload.edoValue.periods.firstOrNull { it.daysElapsed < it.daysInPeriod }
        return EdoUnitValue(
            asOf = LocalDate.parse(payload.asOf),
            totalValue = payload.edoValue.totalValue.toBigDecimal(),
            currentRatePercent = activePeriod?.ratePercent?.toBigDecimal()
        )
    }

    suspend fun historyInPln(
        terms: EdoLotTerms,
        from: LocalDate? = null,
        to: LocalDate? = null
    ): List<HistoricalPricePoint> {
        val payload = transport.get(
            uri = buildUpstreamUri(
                baseUrl = baseUrl,
                pathTemplate = EdoCalculatorContractPaths.HISTORY,
                queryParameters = edoParameters(terms) + listOf(
                    "fromYear" to from?.year?.toString(),
                    "fromMonth" to from?.monthValue?.toString(),
                    "fromDay" to from?.dayOfMonth?.toString(),
                    "toYear" to to?.year?.toString(),
                    "toMonth" to to?.monthValue?.toString(),
                    "toDay" to to?.dayOfMonth?.toString()
                )
            ),
            timeout = UpstreamTimeoutBudgets.EDO_CALCULATOR,
            context = context("history", terms.purchaseDate.toString()),
            decodeSuccess = { body -> json.decodeFromString<EdoCalculatorEdoHistoryResponsePayload>(body) },
            decodeError = ::decodeError
        )
        return payload.points.map { point ->
            HistoricalPricePoint(
                date = LocalDate.parse(point.date),
                closePricePln = point.totalValue.toBigDecimal()
            )
        }
    }

    suspend fun inflationSince(from: YearMonth): InflationWindow {
        val payload = transport.get(
            uri = buildUpstreamUri(
                baseUrl = baseUrl,
                pathTemplate = EdoCalculatorContractPaths.INFLATION_SINCE,
                queryParameters = listOf(
                    "year" to from.year.toString(),
                    "month" to from.monthValue.toString()
                )
            ),
            timeout = UpstreamTimeoutBudgets.EDO_CALCULATOR,
            context = context("inflation", from.toString()),
            decodeSuccess = { body -> json.decodeFromString<EdoCalculatorInflationResponsePayload>(body) },
            decodeError = ::decodeError
        )
        return InflationWindow(
            from = YearMonth.parse(payload.from),
            until = YearMonth.parse(payload.until),
            multiplier = payload.multiplier.toBigDecimal()
        )
    }

    suspend fun monthlyInflation(from: YearMonth, untilExclusive: YearMonth): MonthlyInflationSeries {
        val subject = "$from..$untilExclusive"
        val payload = transport.get(
            uri = buildUpstreamUri(
                baseUrl = baseUrl,
                pathTemplate = EdoCalculatorContractPaths.MONTHLY_INFLATION,
                queryParameters = listOf(
                    "startYear" to from.year.toString(),
                    "startMonth" to from.monthValue.toString(),
                    "endYear" to untilExclusive.year.toString(),
                    "endMonth" to untilExclusive.monthValue.toString()
                )
            ),
            timeout = UpstreamTimeoutBudgets.EDO_CALCULATOR,
            context = context("monthly-inflation", subject),
            decodeSuccess = { body ->
                json.decodeFromString<EdoCalculatorMonthlyInflationSeriesResponsePayload>(body)
            },
            decodeError = ::decodeError
        )
        return MonthlyInflationSeries(
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

    private fun edoParameters(terms: EdoLotTerms): List<Pair<String, String>> = listOf(
        "purchaseYear" to terms.purchaseDate.year.toString(),
        "purchaseMonth" to terms.purchaseDate.monthValue.toString(),
        "purchaseDay" to terms.purchaseDate.dayOfMonth.toString(),
        "firstPeriodRate" to terms.firstPeriodRateBps.toDecimalRate(),
        "margin" to terms.marginBps.toDecimalRate(),
        "principal" to "100"
    )

    private fun decodeError(body: String): UpstreamErrorEnvelope? = runCatching {
        json.decodeFromString<EdoCalculatorApiErrorResponsePayload>(body).toEnvelope()
    }.getOrNull()

    private fun EdoCalculatorApiErrorResponsePayload.toEnvelope() = UpstreamErrorEnvelope(
        error = error,
        errorCode = errorCode,
        retryable = retryable,
        requestId = requestId
    )

    private fun context(operation: String, subject: String) = UpstreamRequestContext(
        upstream = EDO_CALCULATOR,
        operation = operation,
        subject = subject
    )

    private fun Int.toDecimalRate(): String =
        BigDecimal(this).divide(BigDecimal(100)).stripTrailingZeros().toPlainString()

    private companion object {
        const val EDO_CALCULATOR = "edo-calculator"
    }
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
