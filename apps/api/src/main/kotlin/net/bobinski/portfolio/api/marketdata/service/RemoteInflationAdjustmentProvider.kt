package net.bobinski.portfolio.api.marketdata.service

import net.bobinski.portfolio.api.marketdata.client.EdoCalculatorClient
import net.bobinski.portfolio.api.marketdata.client.MarketDataClientException
import net.bobinski.portfolio.api.marketdata.config.MarketDataConfig
import java.time.YearMonth

class RemoteInflationAdjustmentProvider(
    private val config: MarketDataConfig,
    private val edoCalculatorClient: EdoCalculatorClient,
    private val snapshotCacheService: MarketDataSnapshotCacheService
) : InflationAdjustmentProvider {
    override suspend fun cumulativeSince(from: YearMonth): InflationAdjustmentResult {
        if (!config.enabled) {
            return InflationAdjustmentResult.Failure("Market data integration is disabled.")
        }

        return try {
            val window = edoCalculatorClient.inflationSince(from)
            val success = InflationAdjustmentResult.Success(
                from = window.from,
                until = window.until,
                multiplier = window.multiplier
            )
            snapshotCacheService.putCumulativeInflation(success)
            success
        } catch (exception: MarketDataClientException) {
            snapshotCacheService.getCumulativeInflation(from)?.let { return it }
            InflationAdjustmentResult.Failure(exception.message ?: "Inflation request failed.")
        } catch (exception: Exception) {
            snapshotCacheService.getCumulativeInflation(from)?.let { return it }
            InflationAdjustmentResult.Failure(exception.message ?: "Unexpected inflation request error.")
        }
    }

    override suspend fun monthlySeries(from: YearMonth, untilExclusive: YearMonth): InflationSeriesResult {
        if (!config.enabled) {
            return InflationSeriesResult.Failure("Market data integration is disabled.")
        }

        return try {
            val series = edoCalculatorClient.monthlyInflation(from = from, untilExclusive = untilExclusive)
            val success = InflationSeriesResult.Success(
                from = series.from,
                until = series.until,
                points = series.points.map { point ->
                    net.bobinski.portfolio.api.marketdata.service.MonthlyInflationPoint(
                        month = point.month,
                        multiplier = point.multiplier
                    )
                }
            )
            snapshotCacheService.putMonthlyInflation(success.points)
            success
        } catch (exception: MarketDataClientException) {
            snapshotCacheService.getMonthlyInflation(from = from, untilExclusive = untilExclusive)?.let { return it }
            InflationSeriesResult.Failure(exception.message ?: "Monthly inflation request failed.")
        } catch (exception: Exception) {
            snapshotCacheService.getMonthlyInflation(from = from, untilExclusive = untilExclusive)?.let { return it }
            InflationSeriesResult.Failure(exception.message ?: "Unexpected monthly inflation request error.")
        }
    }
}
