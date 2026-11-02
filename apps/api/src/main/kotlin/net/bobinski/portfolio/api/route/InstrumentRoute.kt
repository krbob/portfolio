package net.bobinski.portfolio.api.route

import io.ktor.http.HttpStatusCode
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.put
import io.ktor.server.routing.route
import kotlinx.serialization.Serializable
import net.bobinski.portfolio.api.domain.model.AssetClass
import net.bobinski.portfolio.api.domain.model.EdoTerms
import net.bobinski.portfolio.api.domain.model.Instrument
import net.bobinski.portfolio.api.domain.model.InstrumentKind
import net.bobinski.portfolio.api.domain.model.ValuationSource
import net.bobinski.portfolio.api.domain.service.CreateInstrumentCommand
import net.bobinski.portfolio.api.domain.service.InstrumentService
import net.bobinski.portfolio.api.domain.service.UpdateInstrumentCommand
import net.bobinski.portfolio.api.marketdata.service.EdoCatalogUnavailableException
import net.bobinski.portfolio.api.marketdata.service.EdoSeriesCatalogService
import net.bobinski.portfolio.api.plugins.ApiErrorCode
import net.bobinski.portfolio.api.plugins.ErrorResponse
import net.bobinski.portfolio.api.plugins.respondError
import org.koin.ktor.ext.inject
import java.time.YearMonth
import java.util.UUID
import kotlin.reflect.typeOf

fun Route.instrumentRoute() {
    val instrumentService: InstrumentService by inject()

    route("/v1/instruments") {
        edoSeriesCatalogRoute()

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
            description = "Creates a supported instrument definition. ETF, stock, cash and FX instruments use " +
                "stock-analyst and require a market symbol; EDO instruments use edo-calculator. Gold reference " +
                "data is configured separately.",
            tag = "Instruments"
        )

        route("/{id}") {
            put {
                val id = parseUuid(call.parameters["id"]!!, "id")
                val request = call.receive<UpdateInstrumentRequest>()
                val instrument = instrumentService.update(
                    UpdateInstrumentCommand(
                        id = id,
                        name = request.name,
                        symbol = request.symbol,
                        currency = request.currency,
                        valuationSource = ValuationSource.valueOf(request.valuationSource),
                        edoTerms = request.edoTerms?.toDomain()
                    )
                )
                call.respond(instrument.toResponse())
            }.documented(
                operationId = "updateInstrument",
                summary = "Update an instrument",
                description = "Updates mutable properties of an existing instrument. A legacy valuation source may " +
                    "be retained while editing metadata or migrated to the source supported by the instrument kind.",
                tag = "Instruments"
            )
        }
    }
}

private fun Route.edoSeriesCatalogRoute() {
    val edoCatalogService: EdoSeriesCatalogService by inject()
    get("/edo-series") {
        try {
            call.respond(edoCatalogService.catalog())
        } catch (_: EdoCatalogUnavailableException) {
            call.respondError(
                HttpStatusCode.ServiceUnavailable,
                "EDO emission catalog is unavailable.",
                ApiErrorCode.EDO_CATALOG_UNAVAILABLE,
                retryable = true
            )
        }
    }.documented(
        operationId = "getEdoSeriesCatalog",
        summary = "List verified EDO emissions",
        description = "Returns emission terms from edo-calculator for instrument creation. " +
            "Cached terms may be returned with stale=true during an upstream outage. " +
            "Saved instruments retain their own terms.",
        tag = "Instruments"
    ) {
        responses {
            response(HttpStatusCode.ServiceUnavailable.value) {
                description = "No cached emission catalog is available, or market data is disabled."
                schema = buildSchema(typeOf<ErrorResponse>())
            }
        }
    }
}

@Serializable
data class UpdateInstrumentRequest(
    val name: String,
    val symbol: String? = null,
    val currency: String,
    val valuationSource: String,
    val edoTerms: EdoTermsRequest? = null
)

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

private fun parseUuid(value: String, field: String): UUID = try {
    UUID.fromString(value)
} catch (_: IllegalArgumentException) {
    throw IllegalArgumentException("$field must be a valid UUID.")
}

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
