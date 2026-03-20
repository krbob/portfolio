package net.bobinski.portfolio.api.marketdata.service

import net.bobinski.portfolio.api.domain.model.Instrument
import net.bobinski.portfolio.api.domain.model.ValuationSource
import net.bobinski.portfolio.api.marketdata.client.EdoCalculatorClient
import net.bobinski.portfolio.api.marketdata.client.MarketDataClientException
import net.bobinski.portfolio.api.marketdata.client.StockAnalystClient
import net.bobinski.portfolio.api.marketdata.config.MarketDataConfig
import net.bobinski.portfolio.api.marketdata.model.HistoricalPricePoint
import java.time.LocalDate

class RemoteHistoricalInstrumentValuationProvider(
    private val config: MarketDataConfig,
    private val stockAnalystClient: StockAnalystClient,
    private val edoCalculatorClient: EdoCalculatorClient
) : HistoricalInstrumentValuationProvider {
    override suspend fun dailyPriceSeries(
        instrument: Instrument,
        from: LocalDate,
        to: LocalDate
    ): HistoricalInstrumentValuationResult {
        if (!config.enabled) {
            return HistoricalInstrumentValuationResult.Failure(
                type = InstrumentValuationFailureType.UNAVAILABLE,
                reason = "Market data integration is disabled."
            )
        }

        return try {
            when (instrument.valuationSource) {
                ValuationSource.STOCK_ANALYST -> stockHistory(instrument, from, to)
                ValuationSource.EDO_CALCULATOR -> edoHistory(instrument, from, to)
                ValuationSource.MANUAL -> HistoricalInstrumentValuationResult.Failure(
                    type = InstrumentValuationFailureType.UNSUPPORTED,
                    reason = "Manual valuation history is not implemented."
                )
            }
        } catch (exception: MarketDataClientException) {
            HistoricalInstrumentValuationResult.Failure(
                type = InstrumentValuationFailureType.UNAVAILABLE,
                reason = exception.message ?: "Market data request failed."
            )
        } catch (exception: Exception) {
            HistoricalInstrumentValuationResult.Failure(
                type = InstrumentValuationFailureType.UNAVAILABLE,
                reason = exception.message ?: "Unexpected market data error."
            )
        }
    }

    private suspend fun stockHistory(
        instrument: Instrument,
        from: LocalDate,
        to: LocalDate
    ): HistoricalInstrumentValuationResult {
        val symbol = instrument.symbol
            ?: return HistoricalInstrumentValuationResult.Failure(
                type = InstrumentValuationFailureType.UNSUPPORTED,
                reason = "Instrument does not define a market symbol."
            )
        val history = stockAnalystClient.historyInPln(symbol, from = from, to = to)
            .map { HistoricalPricePoint(date = it.date, closePricePln = it.closePricePln) }

        return HistoricalInstrumentValuationResult.Success(prices = history)
    }

    private suspend fun edoHistory(
        instrument: Instrument,
        from: LocalDate,
        to: LocalDate
    ): HistoricalInstrumentValuationResult {
        val terms = instrument.edoTerms
            ?: return HistoricalInstrumentValuationResult.Failure(
                type = InstrumentValuationFailureType.UNSUPPORTED,
                reason = "EDO instrument does not define terms."
            )
        val start = maxOf(from, terms.purchaseDate)
        if (to.isBefore(start)) {
            return HistoricalInstrumentValuationResult.Success(prices = emptyList())
        }

        return HistoricalInstrumentValuationResult.Success(
            prices = edoCalculatorClient.historyInPln(terms = terms, from = start, to = to)
        )
    }
}
