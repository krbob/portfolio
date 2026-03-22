package net.bobinski.portfolio.api.marketdata.service

import net.bobinski.portfolio.api.domain.model.Instrument
import net.bobinski.portfolio.api.domain.model.ValuationSource
import net.bobinski.portfolio.api.marketdata.client.MarketDataClientException
import net.bobinski.portfolio.api.marketdata.client.StockAnalystClient
import net.bobinski.portfolio.api.marketdata.config.MarketDataConfig
import java.math.RoundingMode

class RemoteCurrentInstrumentValuationProvider(
    private val config: MarketDataConfig,
    private val stockAnalystClient: StockAnalystClient
) : CurrentInstrumentValuationProvider {
    override suspend fun value(instrument: Instrument): InstrumentValuationResult {
        if (!config.enabled) {
            return InstrumentValuationResult.Failure(
                type = InstrumentValuationFailureType.UNAVAILABLE,
                reason = "Market data integration is disabled."
            )
        }

        return try {
            when (instrument.valuationSource) {
                ValuationSource.STOCK_ANALYST -> valueFromStockAnalyst(instrument)
                ValuationSource.EDO_CALCULATOR -> InstrumentValuationResult.Failure(
                    type = InstrumentValuationFailureType.UNSUPPORTED,
                    reason = "EDO series valuation must be derived from purchase lots."
                )
                ValuationSource.MANUAL -> InstrumentValuationResult.Failure(
                    type = InstrumentValuationFailureType.UNSUPPORTED,
                    reason = "Manual valuation is not implemented."
                )
            }
        } catch (exception: MarketDataClientException) {
            InstrumentValuationResult.Failure(
                type = InstrumentValuationFailureType.UNAVAILABLE,
                reason = exception.message ?: "Market data request failed."
            )
        } catch (exception: Exception) {
            InstrumentValuationResult.Failure(
                type = InstrumentValuationFailureType.UNAVAILABLE,
                reason = exception.message ?: "Unexpected market data error."
            )
        }
    }

    private suspend fun valueFromStockAnalyst(instrument: Instrument): InstrumentValuationResult {
        val symbol = instrument.symbol
            ?: return InstrumentValuationResult.Failure(
                type = InstrumentValuationFailureType.UNSUPPORTED,
                reason = "Instrument does not define a market symbol."
            )
        val quote = stockAnalystClient.quoteInPln(symbol)
        return InstrumentValuationResult.Success(
            InstrumentValuation(
                pricePerUnitPln = quote.lastPrice.toBigDecimal().setScale(2, RoundingMode.HALF_UP),
                valuedAt = quote.date
            )
        )
    }

}
