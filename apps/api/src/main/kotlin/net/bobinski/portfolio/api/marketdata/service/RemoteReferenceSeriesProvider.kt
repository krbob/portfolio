package net.bobinski.portfolio.api.marketdata.service

import net.bobinski.portfolio.api.marketdata.client.MarketDataClientException
import net.bobinski.portfolio.api.marketdata.client.GoldApiClient
import net.bobinski.portfolio.api.marketdata.client.StockAnalystClient
import net.bobinski.portfolio.api.marketdata.config.MarketDataConfig
import net.bobinski.portfolio.api.marketdata.model.HistoricalPricePoint
import org.slf4j.LoggerFactory
import java.time.LocalDate
import java.math.RoundingMode
import java.util.TreeMap

class RemoteReferenceSeriesProvider(
    private val config: MarketDataConfig,
    private val stockAnalystClient: StockAnalystClient,
    private val goldApiClient: GoldApiClient,
    private val marketDataFailureAuditService: MarketDataFailureAuditService,
    private val snapshotCacheService: MarketDataSnapshotCacheService
) : ReferenceSeriesProvider {
    override suspend fun usdPln(from: LocalDate, to: LocalDate): ReferenceSeriesResult =
        loadSeries(
            identity = "reference:usd-pln",
            symbol = config.usdPlnSymbol,
            currency = null,
            from = from,
            to = to
        )

    override suspend fun goldPln(from: LocalDate, to: LocalDate): ReferenceSeriesResult =
        if (!config.goldApiKey.isNullOrBlank()) {
            loadGoldSpotSeriesInPlnWithFallback(from = from, to = to)
        } else {
            benchmarkPln(
                symbol = config.goldBenchmarkSymbol,
                from = from,
                to = to
            )
        }

    override suspend fun equityBenchmarkPln(from: LocalDate, to: LocalDate): ReferenceSeriesResult =
        benchmarkPln(
            symbol = config.equityBenchmarkSymbol,
            from = from,
            to = to
        )

    override suspend fun bondBenchmarkPln(from: LocalDate, to: LocalDate): ReferenceSeriesResult =
        benchmarkPln(
            symbol = config.bondBenchmarkSymbol,
            from = from,
            to = to
        )

    override suspend fun benchmarkPln(symbol: String, from: LocalDate, to: LocalDate): ReferenceSeriesResult =
        loadSeries(
            identity = benchmarkIdentity(symbol, "PLN"),
            symbol = symbol,
            currency = "PLN",
            from = from,
            to = to
        )

    private suspend fun loadSeries(
        identity: String,
        symbol: String,
        currency: String?,
        from: LocalDate,
        to: LocalDate
    ): ReferenceSeriesResult = try {
        val prices = stockAnalystClient.history(symbol = symbol, currency = currency, from = from, to = to)
        snapshotCacheService.putSeries(identity = identity, prices = prices)
        ReferenceSeriesResult.Success(prices = prices)
    } catch (exception: MarketDataClientException) {
        snapshotCacheService.recordSeriesFailure(identity = identity, reason = exception.message)
        logger.warn(
            "Reference series failed for symbol {} (currency={}) in {}..{}: {}",
            symbol,
            currency,
            from,
            to,
            exception.message
        )
        marketDataFailureAuditService.recordFailure(
            upstream = "stock-analyst",
            operation = "reference-history",
            reason = exception.message ?: "Reference market data request failed.",
            symbol = symbol,
            from = from,
            to = to,
            exception = exception
        )
        cachedSeries(identity = identity, from = from, to = to)?.let { return it }
        ReferenceSeriesResult.Failure(exception.message ?: "Reference market data request failed.")
    } catch (exception: Exception) {
        snapshotCacheService.recordSeriesFailure(identity = identity, reason = exception.message)
        logger.warn(
            "Unexpected reference series error for symbol {} (currency={}) in {}..{}",
            symbol,
            currency,
            from,
            to,
            exception
        )
        marketDataFailureAuditService.recordFailure(
            upstream = "stock-analyst",
            operation = "reference-history",
            reason = exception.message ?: "Unexpected reference market data error.",
            symbol = symbol,
            from = from,
            to = to,
            exception = exception
        )
        cachedSeries(identity = identity, from = from, to = to)?.let { return it }
        ReferenceSeriesResult.Failure(exception.message ?: "Unexpected reference market data error.")
    }

    private suspend fun loadGoldSpotSeriesInPln(
        from: LocalDate,
        to: LocalDate
    ): ReferenceSeriesResult = try {
        val goldUsdHistory = goldApiClient.historyUsd(
            apiKey = requireNotNull(config.goldApiKey),
            from = from,
            to = to
        )
        val usdPlnLookup = stockAnalystClient.history(
            symbol = config.usdPlnSymbol,
            currency = null,
            from = from,
            to = to
        ).associateTo(TreeMap()) { it.date to it.closePricePln }

        val prices = goldUsdHistory.mapNotNull { point ->
            val usdPln = usdPlnLookup.floorEntry(point.date)?.value ?: usdPlnLookup.ceilingEntry(point.date)?.value
            usdPln?.let {
                HistoricalPricePoint(
                    date = point.date,
                    closePricePln = point.closePriceUsd
                        .multiply(it)
                        .setScale(8, RoundingMode.HALF_UP)
                )
            }
        }

        if (prices.isEmpty()) {
            logger.warn("Gold spot series returned no usable PLN points in {}..{}", from, to)
            ReferenceSeriesResult.Failure("gold-api returned no usable gold history in PLN.")
        } else {
            snapshotCacheService.putSeries(identity = "reference:gold-pln", prices = prices)
            ReferenceSeriesResult.Success(prices = prices)
        }
    } catch (exception: MarketDataClientException) {
        logger.warn("Gold spot series failed in {}..{}: {}", from, to, exception.message)
        marketDataFailureAuditService.recordFailure(
            upstream = "gold-api",
            operation = "history",
            reason = exception.message ?: "Gold spot history request failed.",
            symbol = "XAU",
            from = from,
            to = to,
            exception = exception
        )
        cachedSeries(identity = "reference:gold-pln", from = from, to = to)?.let { return it }
        ReferenceSeriesResult.Failure(exception.message ?: "Gold spot history request failed.")
    } catch (exception: Exception) {
        logger.warn("Unexpected gold spot series error in {}..{}", from, to, exception)
        marketDataFailureAuditService.recordFailure(
            upstream = "gold-api",
            operation = "history",
            reason = exception.message ?: "Unexpected gold spot history error.",
            symbol = "XAU",
            from = from,
            to = to,
            exception = exception
        )
        cachedSeries(identity = "reference:gold-pln", from = from, to = to)?.let { return it }
        ReferenceSeriesResult.Failure(exception.message ?: "Unexpected gold spot history error.")
    }

    private suspend fun loadGoldSpotSeriesInPlnWithFallback(
        from: LocalDate,
        to: LocalDate
    ): ReferenceSeriesResult {
        val spotResult = loadGoldSpotSeriesInPln(from = from, to = to)
        if (spotResult is ReferenceSeriesResult.Success) {
            snapshotCacheService.putSeries(identity = "reference:gold-pln", prices = spotResult.prices)
            return spotResult
        }

        val fallbackResult = benchmarkPln(
            symbol = config.goldBenchmarkSymbol,
            from = from,
            to = to
        )
        if (fallbackResult is ReferenceSeriesResult.Success) {
            snapshotCacheService.putSeries(identity = "reference:gold-pln", prices = fallbackResult.prices)
            return fallbackResult
        }

        cachedSeries(identity = "reference:gold-pln", from = from, to = to)?.let { return it }

        val spotFailureMessage = (spotResult as? ReferenceSeriesResult.Failure)?.reason
            ?: "Gold spot history unavailable."
        val fallbackFailureMessage = (fallbackResult as? ReferenceSeriesResult.Failure)?.reason
            ?: "Fallback gold benchmark unavailable."
        return ReferenceSeriesResult.Failure(
            "$spotFailureMessage Fallback benchmark ${config.goldBenchmarkSymbol} also failed: $fallbackFailureMessage"
        )
    }

    private companion object {
        private val logger = LoggerFactory.getLogger(RemoteReferenceSeriesProvider::class.java)
    }

    private suspend fun cachedSeries(
        identity: String,
        from: LocalDate,
        to: LocalDate
    ): ReferenceSeriesResult.Success? {
        val cached = snapshotCacheService.getSeries(identity = identity, from = from, to = to) ?: return null
        return ReferenceSeriesResult.Success(prices = cached, fromCache = true)
    }

    private fun benchmarkIdentity(symbol: String, currency: String?): String =
        "reference:$symbol:${currency ?: "BASE"}"
}
