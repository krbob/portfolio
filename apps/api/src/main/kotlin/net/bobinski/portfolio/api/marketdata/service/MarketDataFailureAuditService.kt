package net.bobinski.portfolio.api.marketdata.service

import java.time.LocalDate
import net.bobinski.portfolio.api.domain.model.AuditEventCategory
import net.bobinski.portfolio.api.domain.model.AuditEventOutcome
import net.bobinski.portfolio.api.domain.service.AuditLogService
import net.bobinski.portfolio.api.marketdata.client.MarketDataClientException

class MarketDataFailureAuditService(
    private val auditLogService: AuditLogService
) {
    suspend fun recordFailure(
        upstream: String,
        operation: String,
        reason: String,
        symbol: String? = null,
        instrumentId: String? = null,
        instrumentName: String? = null,
        valuationSource: String? = null,
        purchaseDate: LocalDate? = null,
        from: LocalDate? = null,
        to: LocalDate? = null,
        exception: Throwable? = null
    ) {
        val clientException = exception as? MarketDataClientException
        val resolvedUpstream = clientException?.upstream ?: upstream
        val resolvedOperation = clientException?.operation ?: operation
        val resolvedSymbol = clientException?.symbol ?: symbol
        val message = buildFailureMessage(
            upstream = resolvedUpstream,
            operation = resolvedOperation,
            symbol = resolvedSymbol,
            purchaseDate = purchaseDate
        )

        auditLogService.record(
            category = AuditEventCategory.SYSTEM,
            action = "MARKET_DATA_REQUEST_FAILED",
            outcome = AuditEventOutcome.FAILURE,
            entityType = "MARKET_DATA",
            entityId = instrumentId ?: resolvedSymbol ?: purchaseDate?.toString(),
            message = message,
            metadata = buildMap {
                put("upstream", resolvedUpstream)
                put("operation", resolvedOperation)
                resolvedSymbol?.let { put("symbol", it) }
                instrumentName?.let { put("instrumentName", it) }
                valuationSource?.let { put("valuationSource", it) }
                purchaseDate?.let { put("purchaseDate", it.toString()) }
                from?.let { put("from", it.toString()) }
                to?.let { put("to", it.toString()) }
                put("reason", reason)
                clientException?.statusCode?.let { put("statusCode", it.toString()) }
                clientException?.responseBodyPreview?.let { put("responseBodyPreview", it) }
                exception?.javaClass?.simpleName?.takeIf { it.isNotBlank() }?.let { put("exceptionType", it) }
            }
        )
    }

    private fun buildFailureMessage(
        upstream: String,
        operation: String,
        symbol: String?,
        purchaseDate: LocalDate?
    ): String {
        val subject = symbol
            ?: purchaseDate?.let { "purchase date $it" }
            ?: "requested data"
        return "${upstream.replaceFirstChar(Char::titlecase)} $operation failed for $subject."
    }
}
