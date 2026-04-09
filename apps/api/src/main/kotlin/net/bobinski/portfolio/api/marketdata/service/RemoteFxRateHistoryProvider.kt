package net.bobinski.portfolio.api.marketdata.service

import net.bobinski.portfolio.api.marketdata.client.MarketDataClientException
import net.bobinski.portfolio.api.marketdata.client.StockAnalystClient
import net.bobinski.portfolio.api.marketdata.config.MarketDataConfig
import org.slf4j.LoggerFactory
import java.time.LocalDate

class RemoteFxRateHistoryProvider(
    private val config: MarketDataConfig,
    private val stockAnalystClient: StockAnalystClient,
    private val snapshotCacheService: MarketDataSnapshotCacheService
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
            val prices = stockAnalystClient.history(symbol = symbolFor(currency), from = from, to = to)
            snapshotCacheService.putSeries(identity = fxHistoryIdentity(currency), prices = prices)
            FxRateHistoryResult.Success(prices = prices)
        } catch (exception: MarketDataClientException) {
            snapshotCacheService.recordSeriesFailure(identity = fxHistoryIdentity(currency), reason = exception.message)
            logger.warn(
                "FX rate history request failed for {} in {}..{}: {}",
                currency, from, to, exception.message
            )
            cachedFxResult(currency, from, to)
                ?: FxRateHistoryResult.Failure(exception.message ?: "FX history request failed.")
        } catch (exception: Exception) {
            snapshotCacheService.recordSeriesFailure(identity = fxHistoryIdentity(currency), reason = exception.message)
            logger.warn(
                "Unexpected FX rate history error for {} in {}..{}",
                currency, from, to, exception
            )
            cachedFxResult(currency, from, to)
                ?: FxRateHistoryResult.Failure(exception.message ?: "Unexpected FX history error.")
        }
    }

    private suspend fun cachedFxResult(
        currency: String,
        from: LocalDate,
        to: LocalDate
    ): FxRateHistoryResult.Success? {
        val cached = snapshotCacheService.getSeries(identity = fxHistoryIdentity(currency), from = from, to = to)
            ?: return null
        return FxRateHistoryResult.Success(prices = cached, fromCache = true)
    }

    private fun fxHistoryIdentity(currency: String): String = "fx-history:$currency"

    private fun symbolFor(currency: String): String = when (currency) {
        "USD" -> config.usdPlnSymbol
        else -> "${currency}PLN=X"
    }

    private companion object {
        private val logger = LoggerFactory.getLogger(RemoteFxRateHistoryProvider::class.java)
    }
}
