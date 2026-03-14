package net.bobinski.portfolio.api.domain.model

import java.time.Instant
import java.util.UUID

data class Account(
    val id: UUID,
    val name: String,
    val institution: String,
    val type: AccountType,
    val baseCurrency: String,
    val isActive: Boolean,
    val createdAt: Instant,
    val updatedAt: Instant
) {
    init {
        require(name.isNotBlank()) { "Account name must not be blank." }
        require(institution.isNotBlank()) { "Institution must not be blank." }
        require(isIsoCurrencyCode(baseCurrency)) { "Base currency must be a 3-letter ISO code." }
    }
}

enum class AccountType {
    BROKERAGE,
    BOND_REGISTER,
    CASH
}
