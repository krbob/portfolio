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

    suspend fun forStock(symbol: String): Analysis {
        val backendData = getLock(symbol).withLock {
            val info = Backend.getInfo(symbol)
            if (info.name == null) throw IllegalArgumentException("Unknown symbol: $symbol")

            var lacking = false
            var history = Backend.getHistory(symbol, Backend.Period._5y)
            if (history.size <= 1) history = Backend.getHistory(symbol, Backend.Period._2y)
            if (history.size <= 1) history = Backend.getHistory(symbol, Backend.Period._1y)
            if (history.size <= 1) {
                lacking = true
                history = Backend.getHistory(symbol, Backend.Period._1d)
            }
            if (history.isEmpty()) throw IllegalArgumentException("Missing history for $symbol")

            BackendData(info, history, lacking)
        }
        val info = backendData.info
        val history = backendData.history
        val lacking = backendData.lacking

        return Analysis(
            symbol = symbol,
            name = checkNotNull(info.name),
            date = LocalDate.now(Clock.systemUTC()).toKotlinLocalDate(),
            lastPrice = CalculateLastPrice(history),
            gain = Analysis.Gain(
                daily = Double.NaN,
                weekly = Double.NaN,
                monthly = Double.NaN,
                quarterly = Double.NaN,
                yearly = Double.NaN
            ).takeIf { lacking } ?: Analysis.Gain(
                daily = CalculateGain.daily(history),
                weekly = CalculateGain.weekly(history),
                monthly = CalculateGain.monthly(history),
                quarterly = CalculateGain.quarterly(history),
                yearly = CalculateGain.yearly(history)
            ),
            rsi = Analysis.Rsi(daily = Double.NaN, weekly = Double.NaN, monthly = Double.NaN)
                .takeIf { lacking }
                ?: Analysis.Rsi(
                    daily = CalculateRsi.daily(history),
                    weekly = CalculateRsi.weeklyWithManualSplit(history),
                    monthly = CalculateRsi.monthlyWithManualSplit(history)
                ),
            dividendYield = Double.NaN.takeIf { lacking }
                ?: CalculateYield.yearly(history),
            peRatio = info.peRatio,
            pbRatio = info.pbRatio,
            eps = info.eps,
            roe = info.roe,
            marketCap = info.marketCap
        )
    }

    private fun getLock(key: String): Mutex {
        return locks.getOrPut(key) { Mutex() }
    }

    @JvmInline
    private value class BackendData(private val value: Triple<BasicInfo, Collection<HistoricalPrice>, Boolean>) {
        constructor(info: BasicInfo, history: Collection<HistoricalPrice>, lacking: Boolean = false)
                : this(Triple(info, history, lacking))

        val info: BasicInfo
            get() = value.first
        val history: Collection<HistoricalPrice>
            get() = value.second
        val lacking: Boolean
            get() = value.third
    }
}