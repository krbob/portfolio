package net.bobinski.portfolio.api.domain.model

import java.time.Instant
import java.time.LocalDate
import java.util.UUID

data class Instrument(
    val id: UUID,
    val name: String,
    val kind: InstrumentKind,
    val assetClass: AssetClass,
    val symbol: String?,
    val currency: String,
    val valuationSource: ValuationSource,
    val edoTerms: EdoTerms? = null,
    val isActive: Boolean,
    val createdAt: Instant,
    val updatedAt: Instant
) {
    init {
        require(name.isNotBlank()) { "Instrument name must not be blank." }
        require(isIsoCurrencyCode(currency)) { "Instrument currency must be a 3-letter ISO code." }
        require(symbol.isNullOrBlank() || symbol == symbol.trim()) { "Instrument symbol must be trimmed." }
        require(updatedAt >= createdAt) { "Updated timestamp must not be before created timestamp." }
        validateKindSpecificRules()
    }

    private fun validateKindSpecificRules() {
        when (kind) {
            InstrumentKind.BOND_EDO -> {
                require(assetClass == AssetClass.BONDS) { "EDO instruments must belong to bonds asset class." }
                require(valuationSource == ValuationSource.EDO_CALCULATOR) {
                    "EDO instruments must use edo-calculator valuation."
                }
                requireNotNull(edoTerms) { "EDO instruments require dedicated terms." }
            }

            InstrumentKind.BENCHMARK_GOLD -> {
                require(assetClass == AssetClass.BENCHMARK) { "Gold benchmark must use benchmark asset class." }
                require(edoTerms == null) { "Gold benchmark must not define EDO terms." }
            }

            else -> require(edoTerms == null) { "Only EDO instruments can carry EDO terms." }
        }
    }
}

data class EdoTerms(
    val purchaseDate: LocalDate,
    val firstPeriodRateBps: Int,
    val marginBps: Int,
    val principalUnits: Int,
    val maturityDate: LocalDate
) {
    init {
        require(firstPeriodRateBps >= 0) { "First period rate must not be negative." }
        require(marginBps >= 0) { "Margin must not be negative." }
        require(principalUnits > 0) { "EDO principal units must be positive." }
        require(maturityDate > purchaseDate) { "EDO maturity date must be after purchase date." }
    }
}

enum class InstrumentKind {
    ETF,
    STOCK,
    BOND_EDO,
    CASH,
    FX_RATE,
    BENCHMARK_GOLD
}

enum class AssetClass {
    EQUITIES,
    BONDS,
    CASH,
    FX,
    BENCHMARK
}

enum class ValuationSource {
    STOCK_ANALYST,
    EDO_CALCULATOR,
    MANUAL
}
