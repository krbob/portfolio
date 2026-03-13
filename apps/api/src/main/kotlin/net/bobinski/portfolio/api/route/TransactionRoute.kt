package net.bobinski.portfolio.api.route

import io.ktor.http.HttpStatusCode
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.route
import kotlinx.serialization.Serializable
import net.bobinski.portfolio.api.domain.model.Transaction
import net.bobinski.portfolio.api.domain.model.TransactionType
import net.bobinski.portfolio.api.domain.service.CreateTransactionCommand
import net.bobinski.portfolio.api.domain.service.TransactionService
import org.koin.ktor.ext.inject
import java.math.BigDecimal
import java.time.LocalDate
import java.util.UUID

fun Route.transactionRoute() {
    val transactionService: TransactionService by inject()

    route("/v1/transactions") {
        get {
            call.respond(transactionService.list().map { it.toResponse() })
        }

        post {
            val request = call.receive<CreateTransactionRequest>()
            val transaction = transactionService.create(request.toCommand())
            call.respond(HttpStatusCode.Created, transaction.toResponse())
        }
    }
}

@Serializable
data class CreateTransactionRequest(
    val accountId: String,
    val instrumentId: String? = null,
    val type: String,
    val tradeDate: String,
    val settlementDate: String? = null,
    val quantity: String? = null,
    val unitPrice: String? = null,
    val grossAmount: String,
    val feeAmount: String = "0",
    val taxAmount: String = "0",
    val currency: String,
    val fxRateToPln: String? = null,
    val notes: String = ""
)

@Serializable
data class TransactionResponse(
    val id: String,
    val accountId: String,
    val instrumentId: String?,
    val type: String,
    val tradeDate: String,
    val settlementDate: String?,
    val quantity: String?,
    val unitPrice: String?,
    val grossAmount: String,
    val feeAmount: String,
    val taxAmount: String,
    val currency: String,
    val fxRateToPln: String?,
    val notes: String,
    val createdAt: String,
    val updatedAt: String
)

private fun CreateTransactionRequest.toCommand(): CreateTransactionCommand = CreateTransactionCommand(
    accountId = parseUuid(accountId, "accountId"),
    instrumentId = instrumentId?.let { parseUuid(it, "instrumentId") },
    type = parseTransactionType(type),
    tradeDate = parseDate(tradeDate, "tradeDate"),
    settlementDate = settlementDate?.let { parseDate(it, "settlementDate") },
    quantity = quantity?.let { parseDecimal(it, "quantity") },
    unitPrice = unitPrice?.let { parseDecimal(it, "unitPrice") },
    grossAmount = parseDecimal(grossAmount, "grossAmount"),
    feeAmount = parseDecimal(feeAmount, "feeAmount"),
    taxAmount = parseDecimal(taxAmount, "taxAmount"),
    currency = currency,
    fxRateToPln = fxRateToPln?.let { parseDecimal(it, "fxRateToPln") },
    notes = notes
)

private fun Transaction.toResponse(): TransactionResponse = TransactionResponse(
    id = id.toString(),
    accountId = accountId.toString(),
    instrumentId = instrumentId?.toString(),
    type = type.name,
    tradeDate = tradeDate.toString(),
    settlementDate = settlementDate?.toString(),
    quantity = quantity?.toPlainString(),
    unitPrice = unitPrice?.toPlainString(),
    grossAmount = grossAmount.toPlainString(),
    feeAmount = feeAmount.toPlainString(),
    taxAmount = taxAmount.toPlainString(),
    currency = currency,
    fxRateToPln = fxRateToPln?.toPlainString(),
    notes = notes,
    createdAt = createdAt.toString(),
    updatedAt = updatedAt.toString()
)

private fun parseUuid(value: String, field: String): UUID =
    try {
        UUID.fromString(value)
    } catch (_: IllegalArgumentException) {
        throw IllegalArgumentException("$field must be a valid UUID.")
    }

private fun parseDate(value: String, field: String): LocalDate =
    try {
        LocalDate.parse(value)
    } catch (_: Exception) {
        throw IllegalArgumentException("$field must use ISO date format YYYY-MM-DD.")
    }

private fun parseDecimal(value: String, field: String): BigDecimal =
    value.toBigDecimalOrNull() ?: throw IllegalArgumentException("$field must be a decimal string.")

private fun parseTransactionType(value: String): TransactionType =
    try {
        TransactionType.valueOf(value)
    } catch (_: IllegalArgumentException) {
        throw IllegalArgumentException("type must be one of ${TransactionType.entries.joinToString()}.")
    }
