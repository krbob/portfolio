package net.bobinski.portfolio.api.marketdata.service

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.withTimeoutOrNull
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

        val responded = try {
            withTimeoutOrNull(PROBE_TIMEOUT_MS) {
                stockAnalystClient.quoteInPln(symbol)
                true
            }
        } catch (e: MarketDataClientException) {
            throw IllegalArgumentException(
                "Symbol '$symbol' could not be verified against stock-analyst. " +
                    "Check that the symbol is correct."
            )
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            throw IllegalArgumentException(
                "Could not reach stock-analyst to verify symbol '$symbol'. " +
                    "Try again when stock-analyst is available."
            )
        }

        if (responded == null) {
            throw IllegalArgumentException(
                "Valuation source did not respond in time while verifying symbol '$symbol'. " +
                    "Try again when stock-analyst is available."
            )
        }
    }

    private companion object {
        const val PROBE_TIMEOUT_MS = 5_000L
    }
}
