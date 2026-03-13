package net.bobinski.portfolio.api.marketdata.service

import net.bobinski.portfolio.api.marketdata.client.EdoCalculatorClient
import net.bobinski.portfolio.api.marketdata.client.MarketDataClientException
import net.bobinski.portfolio.api.marketdata.config.MarketDataConfig
import java.time.YearMonth

class RemoteInflationAdjustmentProvider(
    private val config: MarketDataConfig,
    private val edoCalculatorClient: EdoCalculatorClient
) : InflationAdjustmentProvider {
    override suspend fun cumulativeSince(from: YearMonth): InflationAdjustmentResult {
        if (!config.enabled) {
            return InflationAdjustmentResult.Failure("Market data integration is disabled.")
        }

        return try {
            val window = edoCalculatorClient.inflationSince(from)
            InflationAdjustmentResult.Success(
                from = window.from,
                until = window.until,
                multiplier = window.multiplier
            )
        } catch (exception: MarketDataClientException) {
            InflationAdjustmentResult.Failure(exception.message ?: "Inflation request failed.")
        } catch (exception: Exception) {
            InflationAdjustmentResult.Failure(exception.message ?: "Unexpected inflation request error.")
        }
    }
}
