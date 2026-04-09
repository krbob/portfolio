package net.bobinski.portfolio.api.marketdata.service

import java.time.LocalDate
import net.bobinski.portfolio.api.domain.model.EdoLotTerms
import net.bobinski.portfolio.api.marketdata.client.EdoCalculatorClient
import net.bobinski.portfolio.api.marketdata.client.MarketDataClientException
import net.bobinski.portfolio.api.marketdata.config.MarketDataConfig

class RemoteEdoLotValuationProvider(
    private val config: MarketDataConfig,
    private val edoCalculatorClient: EdoCalculatorClient,
    private val marketDataFailureAuditService: MarketDataFailureAuditService,
    private val snapshotCacheService: MarketDataSnapshotCacheService
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
            val yesterday = LocalDate.now().minusDays(1)
            val previousCloseValue = if (!yesterday.isBefore(lotTerms.purchaseDate)) {
                runCatching { edoCalculatorClient.unitValueInPln(terms = lotTerms, asOf = yesterday) }.getOrNull()
            } else null
            val valuation = InstrumentValuation(
                pricePerUnitPln = value.totalValue,
                pricePerUnitNative = value.totalValue,
                valuedAt = value.asOf,
                currentRatePercent = value.currentRatePercent,
                previousClosePln = previousCloseValue?.totalValue
            )
            snapshotCacheService.putQuote(identity = edoQuoteIdentity(lotTerms), valuation = valuation)
            InstrumentValuationResult.Success(valuation = valuation)
        } catch (exception: MarketDataClientException) {
            snapshotCacheService.recordQuoteFailure(
                identity = edoQuoteIdentity(lotTerms),
                reason = exception.message
            )
            marketDataFailureAuditService.recordFailure(
                upstream = "edo-calculator",
                operation = "value",
                reason = exception.message ?: "Market data request failed.",
                purchaseDate = lotTerms.purchaseDate,
                exception = exception
            )
            cachedQuoteResult(lotTerms)?.let { return it }
            InstrumentValuationResult.Failure(
                type = InstrumentValuationFailureType.UNAVAILABLE,
                reason = exception.message ?: "Market data request failed."
            )
        } catch (exception: Exception) {
            snapshotCacheService.recordQuoteFailure(
                identity = edoQuoteIdentity(lotTerms),
                reason = exception.message
            )
            marketDataFailureAuditService.recordFailure(
                upstream = "edo-calculator",
                operation = "value",
                reason = exception.message ?: "Unexpected market data error.",
                purchaseDate = lotTerms.purchaseDate,
                exception = exception
            )
            cachedQuoteResult(lotTerms)?.let { return it }
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
            val history = edoCalculatorClient.historyInPln(terms = lotTerms, from = start, to = to)
            snapshotCacheService.putSeries(identity = edoHistoryIdentity(lotTerms), prices = history)
            HistoricalInstrumentValuationResult.Success(prices = history)
        } catch (exception: MarketDataClientException) {
            snapshotCacheService.recordSeriesFailure(
                identity = edoHistoryIdentity(lotTerms),
                reason = exception.message
            )
            marketDataFailureAuditService.recordFailure(
                upstream = "edo-calculator",
                operation = "history",
                reason = exception.message ?: "Market data request failed.",
                purchaseDate = lotTerms.purchaseDate,
                from = start,
                to = to,
                exception = exception
            )
            cachedHistoryResult(lotTerms = lotTerms, from = start, to = to)?.let { return it }
            HistoricalInstrumentValuationResult.Failure(
                type = InstrumentValuationFailureType.UNAVAILABLE,
                reason = exception.message ?: "Market data request failed."
            )
        } catch (exception: Exception) {
            snapshotCacheService.recordSeriesFailure(
                identity = edoHistoryIdentity(lotTerms),
                reason = exception.message
            )
            marketDataFailureAuditService.recordFailure(
                upstream = "edo-calculator",
                operation = "history",
                reason = exception.message ?: "Unexpected market data error.",
                purchaseDate = lotTerms.purchaseDate,
                from = start,
                to = to,
                exception = exception
            )
            cachedHistoryResult(lotTerms = lotTerms, from = start, to = to)?.let { return it }
            HistoricalInstrumentValuationResult.Failure(
                type = InstrumentValuationFailureType.UNAVAILABLE,
                reason = exception.message ?: "Unexpected market data error."
            )
        }
    }

    private suspend fun cachedQuoteResult(lotTerms: EdoLotTerms): InstrumentValuationResult.Success? {
        val cached = snapshotCacheService.getQuote(identity = edoQuoteIdentity(lotTerms)) ?: return null
        return InstrumentValuationResult.Success(valuation = cached, fromCache = true)
    }

    private suspend fun cachedHistoryResult(
        lotTerms: EdoLotTerms,
        from: LocalDate,
        to: LocalDate
    ): HistoricalInstrumentValuationResult.Success? {
        val cached = snapshotCacheService.getSeries(identity = edoHistoryIdentity(lotTerms), from = from, to = to)
            ?: return null
        return HistoricalInstrumentValuationResult.Success(prices = cached, fromCache = true)
    }

    private fun edoQuoteIdentity(lotTerms: EdoLotTerms): String =
        "edo-quote:${lotTerms.purchaseDate}|${lotTerms.firstPeriodRateBps}|${lotTerms.marginBps}"

    private fun edoHistoryIdentity(lotTerms: EdoLotTerms): String =
        "edo-history:${lotTerms.purchaseDate}|${lotTerms.firstPeriodRateBps}|${lotTerms.marginBps}"
}
