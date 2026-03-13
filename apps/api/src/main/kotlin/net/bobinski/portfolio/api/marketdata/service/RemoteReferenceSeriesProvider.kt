package net.bobinski.portfolio.api.marketdata.service

import net.bobinski.portfolio.api.marketdata.client.MarketDataClientException
import net.bobinski.portfolio.api.marketdata.client.StockAnalystClient
import net.bobinski.portfolio.api.marketdata.config.MarketDataConfig
import java.time.LocalDate

class RemoteReferenceSeriesProvider(
    private val config: MarketDataConfig,
    private val stockAnalystClient: StockAnalystClient
) : ReferenceSeriesProvider {
    override suspend fun usdPln(from: LocalDate, to: LocalDate): ReferenceSeriesResult =
        loadSeries(
            symbol = config.usdPlnSymbol,
            currency = null,
            from = from,
            to = to
        )

    override suspend fun goldPln(from: LocalDate, to: LocalDate): ReferenceSeriesResult =
        loadSeries(
            symbol = config.goldBenchmarkSymbol,
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
}
