package net.bobinski.portfolio.api.marketdata.service

import net.bobinski.portfolio.api.domain.model.EdoLotTerms
import java.time.LocalDate

interface EdoLotValuationProvider {
    suspend fun value(lotTerms: EdoLotTerms): InstrumentValuationResult

    suspend fun dailyPriceSeries(
        lotTerms: EdoLotTerms,
        from: LocalDate,
        to: LocalDate
    ): HistoricalInstrumentValuationResult
}
