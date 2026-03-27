package net.bobinski.portfolio.api.marketdata.service

import net.bobinski.portfolio.api.domain.model.Instrument
import net.bobinski.portfolio.api.marketdata.model.HistoricalPricePoint
import java.time.LocalDate

interface HistoricalInstrumentValuationProvider {
    suspend fun dailyPriceSeries(
        instrument: Instrument,
        from: LocalDate,
        to: LocalDate
    ): HistoricalInstrumentValuationResult
}

sealed interface HistoricalInstrumentValuationResult {
    data class Success(
        val prices: List<HistoricalPricePoint>,
        val fromCache: Boolean = false
    ) : HistoricalInstrumentValuationResult

    data class Failure(
        val type: InstrumentValuationFailureType,
        val reason: String
    ) : HistoricalInstrumentValuationResult
}
