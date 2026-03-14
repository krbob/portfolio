package net.bobinski.portfolio.api.domain.model

import java.math.BigDecimal
import java.time.Instant
import java.util.UUID

data class PortfolioTarget(
    val id: UUID,
    val assetClass: AssetClass,
    val targetWeight: BigDecimal,
    val createdAt: Instant,
    val updatedAt: Instant
) {
    init {
        require(targetWeight >= BigDecimal.ZERO && targetWeight <= BigDecimal.ONE) {
            "Target weight must be within 0..1."
        }
        require(updatedAt >= createdAt) { "Updated timestamp must not be before created timestamp." }
    }
}
