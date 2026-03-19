package net.bobinski.portfolio.api.marketdata.service

import net.bobinski.portfolio.api.marketdata.model.HistoricalPricePoint
import java.time.LocalDate

interface ReferenceSeriesProvider {
    suspend fun usdPln(from: LocalDate, to: LocalDate): ReferenceSeriesResult
    suspend fun goldPln(from: LocalDate, to: LocalDate): ReferenceSeriesResult
    suspend fun equityBenchmarkPln(from: LocalDate, to: LocalDate): ReferenceSeriesResult
    suspend fun bondBenchmarkPln(from: LocalDate, to: LocalDate): ReferenceSeriesResult
    suspend fun benchmarkPln(symbol: String, from: LocalDate, to: LocalDate): ReferenceSeriesResult
}

sealed interface ReferenceSeriesResult {
    data class Success(
        val prices: List<HistoricalPricePoint>
    ) : ReferenceSeriesResult

    data class Failure(
        val reason: String
    ) : ReferenceSeriesResult
}
