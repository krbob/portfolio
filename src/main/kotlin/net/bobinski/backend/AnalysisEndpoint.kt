package net.bobinski.backend

import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.datetime.toKotlinLocalDate
import net.bobinski.data.Analysis
import net.bobinski.data.BasicInfo
import net.bobinski.data.HistoricalPrice
import net.bobinski.logic.CalculateGain
import net.bobinski.logic.CalculateLastPrice
import net.bobinski.logic.CalculateRsi
import net.bobinski.logic.CalculateYield
import net.bobinski.source.Backend
import java.time.Clock
import java.time.LocalDate

object AnalysisEndpoint {

    private val locks = mutableMapOf<String, Mutex>()

    suspend fun forStock(symbol: String, currencyConversionSymbol: String? = null): Analysis {
        val backendData = getLock(symbol).withLock {
            val info = Backend.getInfo(symbol)
            if (info?.name == null) throw IllegalArgumentException("Unknown symbol: $symbol")

            var lacking = false
            var period = Backend.Period._5y
            var history = Backend.getHistory(symbol, period)
            if (history.size <= 1) {
                period = Backend.Period._2y
                history = Backend.getHistory(symbol, period)
            }
            if (history.size <= 1) {
                period = Backend.Period._1y
                history = Backend.getHistory(symbol, period)
            }
            if (history.size <= 1) {
                lacking = true
                history = Backend.getHistory(symbol, Backend.Period._1d)
            }
            if (history.isEmpty()) throw IllegalArgumentException("Missing history for $symbol")

            val conversion = currencyConversionSymbol?.let { conversion ->
                Backend.getHistory(conversion, period).also {
                    if (it.size < history.size) {
                        throw IllegalArgumentException("Not enough conversion history for $conversion")
                    }
                }
            }

            BackendData(
                info = info,
                history = history,
                conversion = conversion,
                lacking = lacking
            )
        }
        val info = backendData.info
        val history = backendData.history
        val conversion = backendData.conversion
        val lacking = backendData.lacking

        return Analysis(
            symbol = symbol,
            name = checkNotNull(info.name),
            date = LocalDate.now(Clock.systemUTC()).toKotlinLocalDate(),
            lastPrice = CalculateLastPrice(history, conversion),
            gain = Analysis.Gain(
                daily = Double.NaN,
                weekly = Double.NaN,
                monthly = Double.NaN,
                quarterly = Double.NaN,
                yearly = Double.NaN
            ).takeIf { lacking } ?: Analysis.Gain(
                daily = CalculateGain.daily(history, conversion),
                weekly = CalculateGain.weekly(history, conversion),
                monthly = CalculateGain.monthly(history, conversion),
                quarterly = CalculateGain.quarterly(history, conversion),
                yearly = CalculateGain.yearly(history, conversion)
            ),
            rsi = Analysis.Rsi(daily = Double.NaN, weekly = Double.NaN, monthly = Double.NaN)
                .takeIf { lacking }
                ?: Analysis.Rsi(
                    daily = CalculateRsi.daily(history, conversion),
                    weekly = CalculateRsi.weekly(history, conversion),
                    monthly = CalculateRsi.monthly(history, conversion)
                ),
            dividendYield = Double.NaN.takeIf { lacking }
                ?: CalculateYield.yearly(history, conversion),
            peRatio = info.peRatio,
            pbRatio = info.pbRatio,
            eps = info.eps,
            roe = info.roe,
            marketCap = info.marketCap
        ).roundValues()
    }

    private fun getLock(key: String): Mutex {
        return locks.getOrPut(key) { Mutex() }
    }

    data class BackendData(
        val info: BasicInfo,
        val history: Collection<HistoricalPrice>,
        val conversion: Collection<HistoricalPrice>?,
        val lacking: Boolean
    )
}