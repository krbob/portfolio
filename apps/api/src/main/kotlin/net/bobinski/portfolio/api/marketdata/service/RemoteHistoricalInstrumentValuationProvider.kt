package net.bobinski.portfolio.api.marketdata.service

import net.bobinski.portfolio.api.domain.model.Instrument
import net.bobinski.portfolio.api.domain.model.ValuationSource
import net.bobinski.portfolio.api.marketdata.client.MarketDataClientException
import net.bobinski.portfolio.api.marketdata.client.StockAnalystClient
import net.bobinski.portfolio.api.marketdata.config.MarketDataConfig
import net.bobinski.portfolio.api.marketdata.model.HistoricalPricePoint
import org.slf4j.LoggerFactory
import java.time.LocalDate

class RemoteHistoricalInstrumentValuationProvider(
    private val config: MarketDataConfig,
    private val stockAnalystClient: StockAnalystClient,
    private val marketDataFailureAuditService: MarketDataFailureAuditService
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
                ValuationSource.EDO_CALCULATOR -> HistoricalInstrumentValuationResult.Failure(
                    type = InstrumentValuationFailureType.UNSUPPORTED,
                    reason = "EDO series history must be derived from purchase lots."
                )
                ValuationSource.MANUAL -> HistoricalInstrumentValuationResult.Failure(
                    type = InstrumentValuationFailureType.UNSUPPORTED,
                    reason = "Manual valuation history is not implemented."
                )
            }
        } catch (exception: MarketDataClientException) {
            logger.warn(
                "Historical valuation failed for instrument {} ({}, source={}, symbol={}) in {}..{}: {}",
                instrument.name,
                instrument.id,
                instrument.valuationSource,
                instrument.symbol,
                from,
                to,
                exception.message
            )
            marketDataFailureAuditService.recordFailure(
                upstream = "stock-analyst",
                operation = "history",
                reason = exception.message ?: "Market data request failed.",
                symbol = instrument.symbol,
                instrumentId = instrument.id.toString(),
                instrumentName = instrument.name,
                valuationSource = instrument.valuationSource.name,
                from = from,
                to = to,
                exception = exception
            )
            HistoricalInstrumentValuationResult.Failure(
                type = InstrumentValuationFailureType.UNAVAILABLE,
                reason = exception.message ?: "Market data request failed."
            )
        } catch (exception: Exception) {
            logger.warn(
                "Unexpected historical valuation error for instrument {} ({}, source={}, symbol={}) in {}..{}",
                instrument.name,
                instrument.id,
                instrument.valuationSource,
                instrument.symbol,
                from,
                to,
                exception
            )
            marketDataFailureAuditService.recordFailure(
                upstream = "stock-analyst",
                operation = "history",
                reason = exception.message ?: "Unexpected market data error.",
                symbol = instrument.symbol,
                instrumentId = instrument.id.toString(),
                instrumentName = instrument.name,
                valuationSource = instrument.valuationSource.name,
                from = from,
                to = to,
                exception = exception
            )
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

    private companion object {
        private val logger = LoggerFactory.getLogger(RemoteHistoricalInstrumentValuationProvider::class.java)
    }
}
