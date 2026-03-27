package net.bobinski.portfolio.api.marketdata.service

import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.withTimeout
import net.bobinski.portfolio.api.domain.service.ValuationProbeService
import net.bobinski.portfolio.api.marketdata.client.MarketDataClientException
import net.bobinski.portfolio.api.marketdata.client.StockAnalystClient
import net.bobinski.portfolio.api.marketdata.config.MarketDataConfig

class RemoteValuationProbeService(
    private val marketDataConfig: MarketDataConfig,
    private val stockAnalystClient: StockAnalystClient
) : ValuationProbeService {

    override suspend fun verifyStockAnalystSymbol(symbol: String) {
        if (!marketDataConfig.enabled) return

        try {
            withTimeout(5_000) {
                stockAnalystClient.quoteInPln(symbol)
            }
        } catch (e: MarketDataClientException) {
            throw IllegalArgumentException(
                "Symbol '$symbol' could not be verified against stock-analyst. " +
                    "Check that the symbol is correct or use MANUAL valuation source."
            )
        } catch (e: TimeoutCancellationException) {
            throw IllegalArgumentException(
                "Valuation source did not respond in time while verifying symbol '$symbol'. " +
                    "Try again or use MANUAL valuation source."
            )
        } catch (e: Exception) {
            throw IllegalArgumentException(
                "Could not reach stock-analyst to verify symbol '$symbol'. " +
                    "Try again or use MANUAL valuation source."
            )
        }
    }
}
