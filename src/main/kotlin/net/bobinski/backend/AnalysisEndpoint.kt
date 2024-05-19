package net.bobinski.backend

import kotlinx.datetime.toKotlinLocalDate
import net.bobinski.data.Analysis
import net.bobinski.logic.CalculateGain
import net.bobinski.logic.CalculateLastPrice
import net.bobinski.logic.CalculateRsi
import net.bobinski.logic.CalculateYield
import net.bobinski.source.Backend
import java.time.Clock
import java.time.LocalDate
import kotlin.system.measureTimeMillis

object AnalysisEndpoint {

    suspend fun forStock(symbol: String): Analysis {
        var analysis: Analysis? = null
        val generationTime = measureTimeMillis {
            val info = Backend.getInfo(symbol)
            val history = Backend.getHistory(
                symbol,
                Backend.Period._5y
            )//.filterNot { it.date == LocalDate.now(Clock.systemUTC()).toKotlinLocalDate() }
            if (info.name == null || history.isEmpty()) throw IllegalArgumentException("No data for $symbol")

            analysis = Analysis(
                symbol = symbol,
                name = info.name,
                date = LocalDate.now(Clock.systemUTC()).toKotlinLocalDate(),
                lastPrice = CalculateLastPrice(history),
                gain = Analysis.Gain(
                    monthly = CalculateGain.monthly(history),
                    quarterly = CalculateGain.quarterly(history),
                    yearly = CalculateGain.yearly(history)
                ),
                rsi = Analysis.Rsi(
                    daily = CalculateRsi.daily(history),
                    //weekly = CalculateRsi.weekly(data),
                    //monthly = CalculateRsi.monthly(data),
                    weekly = CalculateRsi.weeklyWithManualSplit(history),
                    monthly = CalculateRsi.monthlyWithManualSplit(history),
                    //weekly = CalculateRsi.forBars(data.weeklyBars()),
                    //monthly = CalculateRsi.forBars(data.monthlyBars())
                ),
                dividendYield = CalculateYield.yearly(history),
                peRatio = info.peRatio,
                pbRatio = info.pbRatio,
                eps = info.eps,
                roe = info.roe,
                marketCap = info.marketCap,
                generationTimeMs = 0
            )
        }
        return analysis!!.copy(generationTimeMs = generationTime)
    }
}