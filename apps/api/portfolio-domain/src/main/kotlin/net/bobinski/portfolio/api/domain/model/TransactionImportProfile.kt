package net.bobinski.portfolio.api.domain.model

import java.time.Instant
import java.util.UUID
import kotlinx.serialization.Serializable

data class TransactionImportProfile(
    val id: UUID,
    val name: String,
    val description: String,
    val delimiter: CsvDelimiter,
    val dateFormat: CsvDateFormat,
    val decimalSeparator: CsvDecimalSeparator,
    val skipDuplicatesByDefault: Boolean,
    val headerMappings: TransactionImportHeaderMappings,
    val defaults: TransactionImportDefaults,
    val createdAt: Instant,
    val updatedAt: Instant
) {
    init {
        require(name.isNotBlank()) { "Import profile name must not be blank." }
        require(updatedAt >= createdAt) { "Updated timestamp must not be before created timestamp." }
    }
}

enum class CsvDelimiter {
    COMMA,
    SEMICOLON,
    TAB
}

enum class CsvDateFormat {
    ISO_LOCAL_DATE,
    DMY_DOTS,
    DMY_SLASH,
    MDY_SLASH
}

enum class CsvDecimalSeparator {
    DOT,
    COMMA
}

@Serializable
data class TransactionImportHeaderMappings(
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
) {
    init {
        require(!tradeDate.isNullOrBlank()) { "Import profile trade date column must not be blank." }
        require(!grossAmount.isNullOrBlank()) { "Import profile gross amount column must not be blank." }
        require(!type.isNullOrBlank()) { "Import profile type column must not be blank." }
    }
}

@Serializable
data class TransactionImportDefaults(
    val accountId: String? = null,
    val currency: String? = null
) {
    init {
        require(currency == null || isIsoCurrencyCode(currency)) {
            "Import profile default currency must use a 3-letter ISO code."
        }
    }
}
