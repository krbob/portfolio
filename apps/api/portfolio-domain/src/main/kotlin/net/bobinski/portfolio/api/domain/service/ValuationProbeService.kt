package net.bobinski.portfolio.api.domain.service

import java.time.LocalDate

interface ValuationProbeService {
    suspend fun verifyStockAnalystSymbol(symbol: String)

    suspend fun verifyStockAnalystBenchmarkPhase(symbol: String, effectiveFrom: LocalDate?) {
        verifyStockAnalystSymbol(symbol)
    }
}
