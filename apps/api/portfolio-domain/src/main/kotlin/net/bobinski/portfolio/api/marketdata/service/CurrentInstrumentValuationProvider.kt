package net.bobinski.portfolio.api.marketdata.service

import net.bobinski.portfolio.api.domain.model.Instrument
import java.math.BigDecimal
import java.time.LocalDate

interface CurrentInstrumentValuationProvider {
    suspend fun value(instrument: Instrument): InstrumentValuationResult
}

data class InstrumentValuation(
    val pricePerUnitPln: BigDecimal,
    val pricePerUnitNative: BigDecimal? = null,
    val valuedAt: LocalDate,
    val currentRatePercent: BigDecimal? = null,
    val previousClosePln: BigDecimal? = null
)

sealed interface InstrumentValuationResult {
    data class Success(
        val valuation: InstrumentValuation,
        val fromCache: Boolean = false
    ) : InstrumentValuationResult
    data class Failure(
        val type: InstrumentValuationFailureType,
        val reason: String
    ) : InstrumentValuationResult
}

enum class InstrumentValuationFailureType {
    UNAVAILABLE,
    UNSUPPORTED
}
