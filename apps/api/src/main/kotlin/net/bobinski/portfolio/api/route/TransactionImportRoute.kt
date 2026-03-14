package net.bobinski.portfolio.api.route

import io.ktor.http.HttpStatusCode
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.delete
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.put
import io.ktor.server.routing.route
import kotlinx.serialization.Serializable
import net.bobinski.portfolio.api.domain.model.CsvDateFormat
import net.bobinski.portfolio.api.domain.model.CsvDecimalSeparator
import net.bobinski.portfolio.api.domain.model.CsvDelimiter
import net.bobinski.portfolio.api.domain.model.TransactionImportDefaults
import net.bobinski.portfolio.api.domain.model.TransactionImportHeaderMappings
import net.bobinski.portfolio.api.domain.model.TransactionImportProfile
import net.bobinski.portfolio.api.domain.service.ImportTransactionCsvCommand
import net.bobinski.portfolio.api.domain.service.PreviewTransactionCsvImportCommand
import net.bobinski.portfolio.api.domain.service.SaveTransactionImportProfileCommand
import net.bobinski.portfolio.api.domain.service.TransactionCsvImportService
import net.bobinski.portfolio.api.domain.service.TransactionImportPreview
import net.bobinski.portfolio.api.domain.service.TransactionImportPreviewRow
import net.bobinski.portfolio.api.domain.service.TransactionImportProfileService
import net.bobinski.portfolio.api.domain.service.TransactionImportResult
import org.koin.ktor.ext.inject
import java.util.UUID

fun Route.transactionImportRoute() {
    val profileService: TransactionImportProfileService by inject()
    val csvImportService: TransactionCsvImportService by inject()

    route("/v1/transactions/import") {
        route("/profiles") {
            get {
                call.respond(profileService.list().map(TransactionImportProfile::toResponse))
            }

            post {
                val request = call.receive<SaveTransactionImportProfileRequest>()
                call.respond(HttpStatusCode.Created, profileService.create(request.toCommand()).toResponse())
            }

            route("/{id}") {
                put {
                    val id = call.parameters["id"]?.let(::parseUuid)
                        ?: throw IllegalArgumentException("id path parameter is required.")
                    val request = call.receive<SaveTransactionImportProfileRequest>()
                    call.respond(profileService.update(id, request.toCommand()).toResponse())
                }

                delete {
                    val id = call.parameters["id"]?.let(::parseUuid)
                        ?: throw IllegalArgumentException("id path parameter is required.")
                    profileService.delete(id)
                    call.respond(HttpStatusCode.NoContent)
                }
            }
        }

        post("/csv/preview") {
            val request = call.receive<CsvTransactionsImportRequest>()
            call.respond(csvImportService.preview(request.toPreviewCommand()).toResponse())
        }

        post("/csv") {
            val request = call.receive<CsvTransactionsImportRequest>()
            call.respond(HttpStatusCode.Created, csvImportService.import(request.toImportCommand()).toResponse())
        }
    }
}

@Serializable
data class SaveTransactionImportProfileRequest(
    val name: String,
    val description: String = "",
    val delimiter: String = CsvDelimiter.COMMA.name,
    val dateFormat: String = CsvDateFormat.ISO_LOCAL_DATE.name,
    val decimalSeparator: String = CsvDecimalSeparator.DOT.name,
    val skipDuplicatesByDefault: Boolean = true,
    val headerMappings: TransactionImportHeaderMappingsRequest = TransactionImportHeaderMappingsRequest(),
    val defaults: TransactionImportDefaultsRequest = TransactionImportDefaultsRequest()
)

@Serializable
data class TransactionImportProfileResponse(
    val id: String,
    val name: String,
    val description: String,
    val delimiter: String,
    val dateFormat: String,
    val decimalSeparator: String,
    val skipDuplicatesByDefault: Boolean,
    val headerMappings: TransactionImportHeaderMappingsResponse,
    val defaults: TransactionImportDefaultsResponse,
    val createdAt: String,
    val updatedAt: String
)

@Serializable
data class TransactionImportHeaderMappingsRequest(
    val account: String? = "account",
    val type: String? = "type",
    val tradeDate: String? = "tradeDate",
    val settlementDate: String? = "settlementDate",
    val instrument: String? = "instrument",
    val quantity: String? = "quantity",
    val unitPrice: String? = "unitPrice",
    val grossAmount: String? = "grossAmount",
    val feeAmount: String? = "feeAmount",
    val taxAmount: String? = "taxAmount",
    val currency: String? = "currency",
    val fxRateToPln: String? = "fxRateToPln",
    val notes: String? = "notes"
)

@Serializable
data class TransactionImportHeaderMappingsResponse(
    val account: String?,
    val type: String?,
    val tradeDate: String?,
    val settlementDate: String?,
    val instrument: String?,
    val quantity: String?,
    val unitPrice: String?,
    val grossAmount: String?,
    val feeAmount: String?,
    val taxAmount: String?,
    val currency: String?,
    val fxRateToPln: String?,
    val notes: String?
)

@Serializable
data class TransactionImportDefaultsRequest(
    val accountId: String? = null,
    val currency: String? = null
)

@Serializable
data class TransactionImportDefaultsResponse(
    val accountId: String?,
    val currency: String?
)

@Serializable
data class CsvTransactionsImportRequest(
    val profileId: String,
    val csv: String,
    val skipDuplicates: Boolean? = null
)

private fun SaveTransactionImportProfileRequest.toCommand(): SaveTransactionImportProfileCommand =
    SaveTransactionImportProfileCommand(
        name = name,
        description = description,
        delimiter = parseCsvDelimiter(delimiter),
        dateFormat = parseCsvDateFormat(dateFormat),
        decimalSeparator = parseCsvDecimalSeparator(decimalSeparator),
        skipDuplicatesByDefault = skipDuplicatesByDefault,
        headerMappings = TransactionImportHeaderMappings(
            account = headerMappings.account,
            type = headerMappings.type,
            tradeDate = headerMappings.tradeDate,
            settlementDate = headerMappings.settlementDate,
            instrument = headerMappings.instrument,
            quantity = headerMappings.quantity,
            unitPrice = headerMappings.unitPrice,
            grossAmount = headerMappings.grossAmount,
            feeAmount = headerMappings.feeAmount,
            taxAmount = headerMappings.taxAmount,
            currency = headerMappings.currency,
            fxRateToPln = headerMappings.fxRateToPln,
            notes = headerMappings.notes
        ),
        defaults = TransactionImportDefaults(
            accountId = defaults.accountId,
            currency = defaults.currency?.uppercase()
        )
    )

private fun CsvTransactionsImportRequest.toPreviewCommand(): PreviewTransactionCsvImportCommand =
    PreviewTransactionCsvImportCommand(
        profileId = parseUuid(profileId),
        csv = csv,
        skipDuplicates = skipDuplicates
    )

private fun CsvTransactionsImportRequest.toImportCommand(): ImportTransactionCsvCommand =
    ImportTransactionCsvCommand(
        profileId = parseUuid(profileId),
        csv = csv,
        skipDuplicates = skipDuplicates
    )

private fun TransactionImportProfile.toResponse(): TransactionImportProfileResponse =
    TransactionImportProfileResponse(
        id = id.toString(),
        name = name,
        description = description,
        delimiter = delimiter.name,
        dateFormat = dateFormat.name,
        decimalSeparator = decimalSeparator.name,
        skipDuplicatesByDefault = skipDuplicatesByDefault,
        headerMappings = TransactionImportHeaderMappingsResponse(
            account = headerMappings.account,
            type = headerMappings.type,
            tradeDate = headerMappings.tradeDate,
            settlementDate = headerMappings.settlementDate,
            instrument = headerMappings.instrument,
            quantity = headerMappings.quantity,
            unitPrice = headerMappings.unitPrice,
            grossAmount = headerMappings.grossAmount,
            feeAmount = headerMappings.feeAmount,
            taxAmount = headerMappings.taxAmount,
            currency = headerMappings.currency,
            fxRateToPln = headerMappings.fxRateToPln,
            notes = headerMappings.notes
        ),
        defaults = TransactionImportDefaultsResponse(
            accountId = defaults.accountId,
            currency = defaults.currency
        ),
        createdAt = createdAt.toString(),
        updatedAt = updatedAt.toString()
    )

private fun TransactionImportResult.toResponse(): ImportTransactionsResponse = ImportTransactionsResponse(
    createdCount = createdCount,
    skippedDuplicateCount = skippedDuplicateCount,
    transactions = transactions.map { transaction ->
        TransactionResponse(
            id = transaction.id.toString(),
            accountId = transaction.accountId.toString(),
            instrumentId = transaction.instrumentId?.toString(),
            type = transaction.type.name,
            tradeDate = transaction.tradeDate.toString(),
            settlementDate = transaction.settlementDate?.toString(),
            quantity = transaction.quantity?.toPlainString(),
            unitPrice = transaction.unitPrice?.toPlainString(),
            grossAmount = transaction.grossAmount.toPlainString(),
            feeAmount = transaction.feeAmount.toPlainString(),
            taxAmount = transaction.taxAmount.toPlainString(),
            currency = transaction.currency,
            fxRateToPln = transaction.fxRateToPln?.toPlainString(),
            notes = transaction.notes,
            createdAt = transaction.createdAt.toString(),
            updatedAt = transaction.updatedAt.toString()
        )
    }
)

private fun TransactionImportPreview.toResponse(): ImportTransactionsPreviewResponse =
    ImportTransactionsPreviewResponse(
        totalRowCount = totalRowCount,
        importableRowCount = importableRowCount,
        duplicateRowCount = duplicateRowCount,
        invalidRowCount = invalidRowCount,
        rows = rows.map(TransactionImportPreviewRow::toResponse)
    )

private fun TransactionImportPreviewRow.toResponse(): ImportTransactionsPreviewRowResponse =
    ImportTransactionsPreviewRowResponse(
        rowNumber = rowNumber,
        status = status.name,
        message = message
    )

private fun parseUuid(value: String): UUID = try {
    UUID.fromString(value)
} catch (_: IllegalArgumentException) {
    throw IllegalArgumentException("Expected a valid UUID.")
}

private fun parseCsvDelimiter(value: String): CsvDelimiter = try {
    CsvDelimiter.valueOf(value.uppercase())
} catch (_: IllegalArgumentException) {
    throw IllegalArgumentException("delimiter must be one of ${CsvDelimiter.entries.joinToString()}.")
}

private fun parseCsvDateFormat(value: String): CsvDateFormat = try {
    CsvDateFormat.valueOf(value.uppercase())
} catch (_: IllegalArgumentException) {
    throw IllegalArgumentException("dateFormat must be one of ${CsvDateFormat.entries.joinToString()}.")
}

private fun parseCsvDecimalSeparator(value: String): CsvDecimalSeparator = try {
    CsvDecimalSeparator.valueOf(value.uppercase())
} catch (_: IllegalArgumentException) {
    throw IllegalArgumentException(
        "decimalSeparator must be one of ${CsvDecimalSeparator.entries.joinToString()}."
    )
}
