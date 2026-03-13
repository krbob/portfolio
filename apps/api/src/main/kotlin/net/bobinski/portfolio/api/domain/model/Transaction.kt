package net.bobinski.portfolio.api.domain.model

import java.math.BigDecimal
import java.time.Instant
import java.time.LocalDate
import java.util.UUID

data class Transaction(
    val id: UUID,
    val accountId: UUID,
    val instrumentId: UUID?,
    val type: TransactionType,
    val tradeDate: LocalDate,
    val settlementDate: LocalDate?,
    val quantity: BigDecimal?,
    val unitPrice: BigDecimal?,
    val grossAmount: BigDecimal,
    val feeAmount: BigDecimal,
    val taxAmount: BigDecimal,
    val currency: String,
    val fxRateToPln: BigDecimal?,
    val notes: String,
    val createdAt: Instant,
    val updatedAt: Instant
) {
    init {
        require(isIsoCurrencyCode(currency)) { "Transaction currency must be a 3-letter ISO code." }
        require(grossAmount >= BigDecimal.ZERO) { "Transaction gross amount must not be negative." }
        require(feeAmount >= BigDecimal.ZERO) { "Transaction fee amount must not be negative." }
        require(taxAmount >= BigDecimal.ZERO) { "Transaction tax amount must not be negative." }
        require(fxRateToPln == null || fxRateToPln > BigDecimal.ZERO) { "FX rate to PLN must be positive." }
        require(updatedAt >= createdAt) { "Updated timestamp must not be before created timestamp." }
        require(settlementDate == null || !settlementDate.isBefore(tradeDate)) {
            "Settlement date must not be before trade date."
        }
        validateTypeSpecificRules()
    }

    private fun validateTypeSpecificRules() {
        when (type) {
            TransactionType.BUY,
            TransactionType.SELL -> {
                require(instrumentId != null) { "$type transactions require an instrument." }
                require(quantity != null && quantity > BigDecimal.ZERO) { "$type transactions require positive quantity." }
                require(unitPrice != null && unitPrice >= BigDecimal.ZERO) { "$type transactions require unit price." }
            }

            TransactionType.DEPOSIT,
            TransactionType.WITHDRAWAL,
            TransactionType.FEE,
            TransactionType.TAX,
            TransactionType.INTEREST -> {
                require(quantity == null) { "$type transactions must not carry quantity." }
                require(unitPrice == null) { "$type transactions must not carry unit price." }
            }

            TransactionType.CORRECTION -> {
                require(notes.isNotBlank()) { "Correction transactions require an audit note." }
            }
        }
    }
}

enum class TransactionType {
    BUY,
    SELL,
    DEPOSIT,
    WITHDRAWAL,
    FEE,
    TAX,
    INTEREST,
    CORRECTION
}
