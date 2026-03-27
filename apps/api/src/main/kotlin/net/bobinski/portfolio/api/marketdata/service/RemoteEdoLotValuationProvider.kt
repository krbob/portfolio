package net.bobinski.portfolio.api.marketdata.service

import java.time.LocalDate
import net.bobinski.portfolio.api.domain.model.EdoLotTerms
import net.bobinski.portfolio.api.marketdata.client.EdoCalculatorClient
import net.bobinski.portfolio.api.marketdata.client.MarketDataClientException
import net.bobinski.portfolio.api.marketdata.config.MarketDataConfig

class RemoteEdoLotValuationProvider(
    private val config: MarketDataConfig,
    private val edoCalculatorClient: EdoCalculatorClient,
    private val marketDataFailureAuditService: MarketDataFailureAuditService
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
                    valuedAt = value.asOf,
                    currentRatePercent = value.currentRatePercent
                )
            )
        } catch (exception: MarketDataClientException) {
            marketDataFailureAuditService.recordFailure(
                upstream = "edo-calculator",
                operation = "value",
                reason = exception.message ?: "Market data request failed.",
                purchaseDate = lotTerms.purchaseDate,
                exception = exception
            )
            InstrumentValuationResult.Failure(
                type = InstrumentValuationFailureType.UNAVAILABLE,
                reason = exception.message ?: "Market data request failed."
            )
        } catch (exception: Exception) {
            marketDataFailureAuditService.recordFailure(
                upstream = "edo-calculator",
                operation = "value",
                reason = exception.message ?: "Unexpected market data error.",
                purchaseDate = lotTerms.purchaseDate,
                exception = exception
            )
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
            marketDataFailureAuditService.recordFailure(
                upstream = "edo-calculator",
                operation = "history",
                reason = exception.message ?: "Market data request failed.",
                purchaseDate = lotTerms.purchaseDate,
                from = start,
                to = to,
                exception = exception
            )
            HistoricalInstrumentValuationResult.Failure(
                type = InstrumentValuationFailureType.UNAVAILABLE,
                reason = exception.message ?: "Market data request failed."
            )
        } catch (exception: Exception) {
            marketDataFailureAuditService.recordFailure(
                upstream = "edo-calculator",
                operation = "history",
                reason = exception.message ?: "Unexpected market data error.",
                purchaseDate = lotTerms.purchaseDate,
                from = start,
                to = to,
                exception = exception
            )
            HistoricalInstrumentValuationResult.Failure(
                type = InstrumentValuationFailureType.UNAVAILABLE,
                reason = exception.message ?: "Unexpected market data error."
            )
        }
    }
}
