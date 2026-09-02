package net.bobinski.portfolio.api.marketdata.service

import java.time.Clock
import java.time.LocalDate
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.withTimeoutOrNull
import net.bobinski.portfolio.api.domain.service.ValuationProbeService
import net.bobinski.portfolio.api.marketdata.client.MarketDataClientException
import net.bobinski.portfolio.api.marketdata.client.StockAnalystClient
import net.bobinski.portfolio.api.marketdata.config.MarketDataConfig

class RemoteValuationProbeService(
    private val marketDataConfig: MarketDataConfig,
    private val stockAnalystClient: StockAnalystClient,
    private val clock: Clock = Clock.systemUTC()
) : ValuationProbeService {

    override suspend fun verifyStockAnalystSymbol(symbol: String) = verify(symbol) {
        stockAnalystClient.quoteInPln(symbol)
    }

    override suspend fun verifyStockAnalystBenchmarkPhase(symbol: String, effectiveFrom: LocalDate?) {
        val today = LocalDate.now(clock)
        if (effectiveFrom == null || effectiveFrom.isAfter(today)) {
            verifyStockAnalystSymbol(symbol)
            return
        }
        verify(symbol) {
            val overlapUntil = effectiveFrom.minusDays(1)
            val probeUntil = minOf(today, effectiveFrom.plusDays(BENCHMARK_POST_SWITCH_LOOKAHEAD_DAYS))
            val history = stockAnalystClient.historyInPln(
                symbol = symbol,
                from = effectiveFrom.minusDays(BENCHMARK_OVERLAP_LOOKBACK_DAYS),
                to = probeUntil
            )
            require(history.prices.any { point -> !point.date.isAfter(overlapUntil) && point.closePricePln.signum() > 0 }) {
                "Symbol '$symbol' has no price before benchmark switch date $effectiveFrom. " +
                    "Choose a later date that has historical overlap."
            }
            require(history.prices.any { point -> !point.date.isBefore(effectiveFrom) && point.closePricePln.signum() > 0 }) {
                "Symbol '$symbol' has no price on or after benchmark switch date $effectiveFrom. " +
                    "Choose a date followed by an available trading observation."
            }
        }
    }

    private suspend fun verify(symbol: String, probe: suspend () -> Unit) {
        if (!marketDataConfig.enabled) return

        val responded = try {
            withTimeoutOrNull(PROBE_TIMEOUT_MS) {
                probe()
                true
            }
        } catch (e: MarketDataClientException) {
            rejectUnverifiedSymbol(symbol)
        } catch (e: CancellationException) {
            propagateCancellation(e)
        } catch (e: IllegalArgumentException) {
            propagateValidationFailure(e)
        } catch (e: Exception) {
            rejectUnreachableSource(symbol)
        }

        if (responded == null) {
            rejectTimedOutSource(symbol)
        }
    }

    private fun rejectUnverifiedSymbol(symbol: String): Nothing = throw IllegalArgumentException(
        "Symbol '$symbol' could not be verified against stock-analyst. Check that the symbol is correct."
    )

    private fun rejectUnreachableSource(symbol: String): Nothing = throw IllegalArgumentException(
        "Could not reach stock-analyst to verify symbol '$symbol'. Try again when stock-analyst is available."
    )

    private fun rejectTimedOutSource(symbol: String): Nothing = throw IllegalArgumentException(
        "Valuation source did not respond in time while verifying symbol '$symbol'. " +
            "Try again when stock-analyst is available."
    )

    private fun propagateCancellation(exception: CancellationException): Nothing = throw exception

    private fun propagateValidationFailure(exception: IllegalArgumentException): Nothing = throw exception

    private companion object {
        const val PROBE_TIMEOUT_MS = 5_000L
        const val BENCHMARK_OVERLAP_LOOKBACK_DAYS = 14L
        const val BENCHMARK_POST_SWITCH_LOOKAHEAD_DAYS = 14L
    }
}
