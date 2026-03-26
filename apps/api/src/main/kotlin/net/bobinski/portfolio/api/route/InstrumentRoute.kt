package net.bobinski.portfolio.api.route

import io.ktor.http.HttpStatusCode
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.route
import kotlinx.serialization.Serializable
import net.bobinski.portfolio.api.domain.model.AssetClass
import net.bobinski.portfolio.api.domain.model.EdoTerms
import net.bobinski.portfolio.api.domain.model.Instrument
import net.bobinski.portfolio.api.domain.model.InstrumentKind
import net.bobinski.portfolio.api.domain.model.ValuationSource
import net.bobinski.portfolio.api.domain.service.CreateInstrumentCommand
import net.bobinski.portfolio.api.domain.service.InstrumentService
import org.koin.ktor.ext.inject
import java.time.YearMonth

fun Route.instrumentRoute() {
    val instrumentService: InstrumentService by inject()

    route("/v1/instruments") {
        get {
            call.respond(instrumentService.list().map { it.toResponse() })
        }.documented(
            operationId = "listInstruments",
            summary = "List instruments",
            description = "Returns the full instrument catalog used by the portfolio ledger and read models.",
            tag = "Instruments"
        )

        post {
            val request = call.receive<CreateInstrumentRequest>()
            val instrument = instrumentService.create(
                CreateInstrumentCommand(
                    name = request.name,
                    kind = InstrumentKind.valueOf(request.kind),
                    assetClass = AssetClass.valueOf(request.assetClass),
                    symbol = request.symbol,
                    currency = request.currency,
                    valuationSource = ValuationSource.valueOf(request.valuationSource),
                    edoTerms = request.edoTerms?.toDomain()
                )
            )

            call.respond(HttpStatusCode.Created, instrument.toResponse())
        }.documented(
            operationId = "createInstrument",
            summary = "Create an instrument",
            description = "Creates a new instrument definition, including valuation source and optional EDO terms.",
            tag = "Instruments"
        )
    }
}

@Serializable
data class CreateInstrumentRequest(
    val name: String,
    val kind: String,
    val assetClass: String,
    val symbol: String? = null,
    val currency: String,
    val valuationSource: String,
    val edoTerms: EdoTermsRequest? = null
)

@Serializable
data class EdoTermsRequest(
    val seriesMonth: String,
    val firstPeriodRateBps: Int,
    val marginBps: Int
)

@Serializable
data class InstrumentResponse(
    val id: String,
    val name: String,
    val kind: String,
    val assetClass: String,
    val symbol: String?,
    val currency: String,
    val valuationSource: String,
    val edoTerms: EdoTermsResponse? = null,
    val isActive: Boolean,
    val createdAt: String,
    val updatedAt: String
)

@Serializable
data class EdoTermsResponse(
    val seriesMonth: String,
    val firstPeriodRateBps: Int,
    val marginBps: Int
)

private fun EdoTermsRequest.toDomain(): EdoTerms = EdoTerms(
    seriesMonth = YearMonth.parse(seriesMonth),
    firstPeriodRateBps = firstPeriodRateBps,
    marginBps = marginBps
)

private fun Instrument.toResponse(): InstrumentResponse = InstrumentResponse(
    id = id.toString(),
    name = name,
    kind = kind.name,
    assetClass = assetClass.name,
    symbol = symbol,
    currency = currency,
    valuationSource = valuationSource.name,
    edoTerms = edoTerms?.let {
        EdoTermsResponse(
            seriesMonth = it.seriesMonth.toString(),
            firstPeriodRateBps = it.firstPeriodRateBps,
            marginBps = it.marginBps
        )
    },
    isActive = isActive,
    createdAt = createdAt.toString(),
    updatedAt = updatedAt.toString()
)
