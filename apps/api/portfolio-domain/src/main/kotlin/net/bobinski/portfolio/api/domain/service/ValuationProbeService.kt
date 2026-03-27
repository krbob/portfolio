package net.bobinski.portfolio.api.domain.service

interface ValuationProbeService {
    suspend fun verifyStockAnalystSymbol(symbol: String)
}
