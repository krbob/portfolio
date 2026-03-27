package net.bobinski.portfolio.api.marketdata.service

import net.bobinski.portfolio.api.domain.model.Instrument
import net.bobinski.portfolio.api.domain.model.ValuationSource
import net.bobinski.portfolio.api.marketdata.client.MarketDataClientException
import net.bobinski.portfolio.api.marketdata.client.StockAnalystClient
import net.bobinski.portfolio.api.marketdata.config.MarketDataConfig
import java.math.RoundingMode

class RemoteCurrentInstrumentValuationProvider(
    private val config: MarketDataConfig,
    private val stockAnalystClient: StockAnalystClient,
    private val marketDataFailureAuditService: MarketDataFailureAuditService,
    private val snapshotCacheService: MarketDataSnapshotCacheService
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
            marketDataFailureAuditService.recordFailure(
                upstream = "stock-analyst",
                operation = "quote",
                reason = exception.message ?: "Market data request failed.",
                symbol = instrument.symbol,
                instrumentId = instrument.id.toString(),
                instrumentName = instrument.name,
                valuationSource = instrument.valuationSource.name,
                exception = exception
            )
            cachedQuoteResult(instrument)?.let { return it }
            InstrumentValuationResult.Failure(
                type = InstrumentValuationFailureType.UNAVAILABLE,
                reason = exception.message ?: "Market data request failed."
            )
        } catch (exception: Exception) {
            marketDataFailureAuditService.recordFailure(
                upstream = "stock-analyst",
                operation = "quote",
                reason = exception.message ?: "Unexpected market data error.",
                symbol = instrument.symbol,
                instrumentId = instrument.id.toString(),
                instrumentName = instrument.name,
                valuationSource = instrument.valuationSource.name,
                exception = exception
            )
            cachedQuoteResult(instrument)?.let { return it }
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
        val nativeQuote = stockAnalystClient.quote(symbol)
        val nativeCurrency = nativeQuote.currency?.uppercase() ?: instrument.currency.uppercase()
        val plnQuote = if (nativeCurrency == "PLN") nativeQuote else stockAnalystClient.quoteInPln(symbol)
        val valuation = InstrumentValuation(
            pricePerUnitPln = plnQuote.lastPrice.toBigDecimal().setScale(2, RoundingMode.HALF_UP),
            pricePerUnitNative = nativeQuote.lastPrice.toBigDecimal().setScale(4, RoundingMode.HALF_UP),
            valuedAt = plnQuote.date
        )
        snapshotCacheService.putQuote(identity = stockQuoteIdentity(symbol), valuation = valuation)
        return InstrumentValuationResult.Success(valuation = valuation)
    }

    private suspend fun cachedQuoteResult(instrument: Instrument): InstrumentValuationResult.Success? {
        val symbol = instrument.symbol ?: return null
        val cached = snapshotCacheService.getQuote(stockQuoteIdentity(symbol)) ?: return null
        return InstrumentValuationResult.Success(valuation = cached, fromCache = true)
    }

    private fun stockQuoteIdentity(symbol: String): String = "stock-quote:$symbol"

}
