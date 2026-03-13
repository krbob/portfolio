package net.bobinski.portfolio.api.marketdata.service

import net.bobinski.portfolio.api.domain.model.Instrument
import net.bobinski.portfolio.api.domain.model.ValuationSource
import net.bobinski.portfolio.api.marketdata.client.EdoCalculatorClient
import net.bobinski.portfolio.api.marketdata.client.MarketDataClientException
import net.bobinski.portfolio.api.marketdata.client.StockAnalystClient
import net.bobinski.portfolio.api.marketdata.config.MarketDataConfig
import java.math.RoundingMode

class RemoteCurrentInstrumentValuationProvider(
    private val config: MarketDataConfig,
    private val stockAnalystClient: StockAnalystClient,
    private val edoCalculatorClient: EdoCalculatorClient
) : CurrentInstrumentValuationProvider {
    override suspend fun value(instrument: Instrument): InstrumentValuationResult {
        if (!config.enabled) {
            return InstrumentValuationResult.Failure("Market data integration is disabled.")
        }

        return try {
            when (instrument.valuationSource) {
                ValuationSource.STOCK_ANALYST -> valueFromStockAnalyst(instrument)
                ValuationSource.EDO_CALCULATOR -> valueFromEdoCalculator(instrument)
                ValuationSource.MANUAL -> InstrumentValuationResult.Failure("Manual valuation is not implemented.")
            }
        } catch (exception: MarketDataClientException) {
            InstrumentValuationResult.Failure(exception.message ?: "Market data request failed.")
        } catch (exception: Exception) {
            InstrumentValuationResult.Failure(exception.message ?: "Unexpected market data error.")
        }
    }

    private suspend fun valueFromStockAnalyst(instrument: Instrument): InstrumentValuationResult {
        val symbol = instrument.symbol
            ?: return InstrumentValuationResult.Failure("Instrument does not define a market symbol.")
        val quote = stockAnalystClient.quoteInPln(symbol)
        return InstrumentValuationResult.Success(
            InstrumentValuation(
                pricePerUnitPln = quote.lastPrice.toBigDecimal().setScale(2, RoundingMode.HALF_UP).toPlainString(),
                valuedAt = quote.date.toString()
            )
        )
    }

    private suspend fun valueFromEdoCalculator(instrument: Instrument): InstrumentValuationResult {
        val terms = instrument.edoTerms
            ?: return InstrumentValuationResult.Failure("EDO instrument does not define terms.")
        val value = edoCalculatorClient.unitValueInPln(terms = terms)
        return InstrumentValuationResult.Success(
            InstrumentValuation(
                pricePerUnitPln = value.totalValue.setScale(2, RoundingMode.HALF_UP).toPlainString(),
                valuedAt = value.asOf.toString()
            )
        )
    }
}
