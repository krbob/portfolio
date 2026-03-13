package net.bobinski.portfolio.api.marketdata.service

import net.bobinski.portfolio.api.marketdata.client.MarketDataClientException
import net.bobinski.portfolio.api.marketdata.client.StockAnalystClient
import net.bobinski.portfolio.api.marketdata.config.MarketDataConfig
import java.time.LocalDate

class RemoteFxRateHistoryProvider(
    private val config: MarketDataConfig,
    private val stockAnalystClient: StockAnalystClient
) : FxRateHistoryProvider {
    override suspend fun dailyRateToPln(
        currency: String,
        from: LocalDate,
        to: LocalDate
    ): FxRateHistoryResult {
        if (!config.enabled) {
            return FxRateHistoryResult.Failure("Market data integration is disabled.")
        }

        if (currency == "PLN") {
            return FxRateHistoryResult.Success(prices = emptyList())
        }

        return try {
            FxRateHistoryResult.Success(
                prices = stockAnalystClient.history(symbol = symbolFor(currency))
                    .filter { it.date >= from && it.date <= to }
            )
        } catch (exception: MarketDataClientException) {
            FxRateHistoryResult.Failure(exception.message ?: "FX history request failed.")
        } catch (exception: Exception) {
            FxRateHistoryResult.Failure(exception.message ?: "Unexpected FX history error.")
        }
    }

    private fun symbolFor(currency: String): String = when (currency) {
        "USD" -> config.usdPlnSymbol
        else -> "${currency}PLN=X"
    }
}
