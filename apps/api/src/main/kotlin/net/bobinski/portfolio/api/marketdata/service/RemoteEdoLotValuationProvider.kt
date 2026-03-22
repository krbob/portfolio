package net.bobinski.portfolio.api.marketdata.service

import java.time.LocalDate
import net.bobinski.portfolio.api.domain.model.EdoLotTerms
import net.bobinski.portfolio.api.marketdata.client.EdoCalculatorClient
import net.bobinski.portfolio.api.marketdata.client.MarketDataClientException
import net.bobinski.portfolio.api.marketdata.config.MarketDataConfig

class RemoteEdoLotValuationProvider(
    private val config: MarketDataConfig,
    private val edoCalculatorClient: EdoCalculatorClient
) : EdoLotValuationProvider {
    override suspend fun value(lotTerms: EdoLotTerms): InstrumentValuationResult {
        if (!config.enabled) {
            return InstrumentValuationResult.Failure(
                type = InstrumentValuationFailureType.UNAVAILABLE,
                reason = "Market data integration is disabled."
            )
        }

        return try {
            val value = edoCalculatorClient.unitValueInPln(terms = lotTerms)
            InstrumentValuationResult.Success(
                InstrumentValuation(
                    pricePerUnitPln = value.totalValue,
                    valuedAt = value.asOf
                )
            )
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

    override suspend fun dailyPriceSeries(
        lotTerms: EdoLotTerms,
        from: LocalDate,
        to: LocalDate
    ): HistoricalInstrumentValuationResult {
        if (!config.enabled) {
            return HistoricalInstrumentValuationResult.Failure(
                type = InstrumentValuationFailureType.UNAVAILABLE,
                reason = "Market data integration is disabled."
            )
        }

        val start = maxOf(from, lotTerms.purchaseDate)
        if (to.isBefore(start)) {
            return HistoricalInstrumentValuationResult.Success(prices = emptyList())
        }

        return try {
            HistoricalInstrumentValuationResult.Success(
                prices = edoCalculatorClient.historyInPln(terms = lotTerms, from = start, to = to)
            )
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
}
