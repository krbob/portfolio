package net.bobinski.portfolio.api.marketdata.service

import net.bobinski.portfolio.api.marketdata.client.MarketDataClientException
import net.bobinski.portfolio.api.marketdata.client.GoldApiClient
import net.bobinski.portfolio.api.marketdata.client.StockAnalystClient
import net.bobinski.portfolio.api.marketdata.config.MarketDataConfig
import net.bobinski.portfolio.api.marketdata.model.HistoricalPricePoint
import java.time.LocalDate
import java.math.RoundingMode
import java.util.TreeMap

class RemoteReferenceSeriesProvider(
    private val config: MarketDataConfig,
    private val stockAnalystClient: StockAnalystClient,
    private val goldApiClient: GoldApiClient
) : ReferenceSeriesProvider {
    override suspend fun usdPln(from: LocalDate, to: LocalDate): ReferenceSeriesResult =
        loadSeries(
            symbol = config.usdPlnSymbol,
            currency = null,
            from = from,
            to = to
        )

    override suspend fun goldPln(from: LocalDate, to: LocalDate): ReferenceSeriesResult =
        if (!config.goldApiKey.isNullOrBlank()) {
            loadGoldSpotSeriesInPln(from = from, to = to)
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
            symbol = symbol,
            currency = "PLN",
            from = from,
            to = to
        )

    private suspend fun loadSeries(
        symbol: String,
        currency: String?,
        from: LocalDate,
        to: LocalDate
    ): ReferenceSeriesResult = try {
        ReferenceSeriesResult.Success(
            prices = stockAnalystClient.history(symbol = symbol, currency = currency)
                .filter { it.date >= from && it.date <= to }
        )
    } catch (exception: MarketDataClientException) {
        ReferenceSeriesResult.Failure(exception.message ?: "Reference market data request failed.")
    } catch (exception: Exception) {
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
            currency = null
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
            ReferenceSeriesResult.Failure("gold-api returned no usable gold history in PLN.")
        } else {
            ReferenceSeriesResult.Success(prices = prices)
        }
    } catch (exception: MarketDataClientException) {
        ReferenceSeriesResult.Failure(exception.message ?: "Gold spot history request failed.")
    } catch (exception: Exception) {
        ReferenceSeriesResult.Failure(exception.message ?: "Unexpected gold spot history error.")
    }
}
