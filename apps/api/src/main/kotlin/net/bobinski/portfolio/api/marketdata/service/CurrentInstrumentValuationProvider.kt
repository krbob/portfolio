package net.bobinski.portfolio.api.marketdata.service

import net.bobinski.portfolio.api.domain.model.Instrument

interface CurrentInstrumentValuationProvider {
    suspend fun value(instrument: Instrument): InstrumentValuationResult
}

data class InstrumentValuation(
    val pricePerUnitPln: String,
    val valuedAt: String
)

sealed interface InstrumentValuationResult {
    data class Success(val valuation: InstrumentValuation) : InstrumentValuationResult
    data class Failure(val reason: String) : InstrumentValuationResult
}
