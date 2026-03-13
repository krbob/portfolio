package net.bobinski.portfolio.api.domain.model

import java.math.BigDecimal
import java.time.Instant
import java.time.LocalDate

data class DailySnapshot(
    val snapshotDate: LocalDate,
    val totalValuePln: BigDecimal,
    val totalValueUsd: BigDecimal,
    val totalValueAu: BigDecimal,
    val totalContributionsPln: BigDecimal,
    val totalContributionsUsd: BigDecimal,
    val totalContributionsAu: BigDecimal,
    val equityWeight: BigDecimal,
    val bondWeight: BigDecimal,
    val createdAt: Instant
) {
    init {
        require(snapshotDate.year >= 1900) { "Snapshot date must be realistic." }
        require(totalValuePln >= BigDecimal.ZERO) { "Portfolio value in PLN must not be negative." }
        require(totalValueUsd >= BigDecimal.ZERO) { "Portfolio value in USD must not be negative." }
        require(totalValueAu >= BigDecimal.ZERO) { "Portfolio value in gold must not be negative." }
        require(totalContributionsPln >= BigDecimal.ZERO) { "Contributions in PLN must not be negative." }
        require(totalContributionsUsd >= BigDecimal.ZERO) { "Contributions in USD must not be negative." }
        require(totalContributionsAu >= BigDecimal.ZERO) { "Contributions in gold must not be negative." }
        require(weightInRange(equityWeight)) { "Equity weight must be within 0..1." }
        require(weightInRange(bondWeight)) { "Bond weight must be within 0..1." }
    }
}

private fun weightInRange(weight: BigDecimal): Boolean =
    weight >= BigDecimal.ZERO && weight <= BigDecimal.ONE
