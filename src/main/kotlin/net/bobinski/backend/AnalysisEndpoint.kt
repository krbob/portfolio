package net.bobinski.backend

import kotlinx.datetime.toKotlinLocalDate
import net.bobinski.data.Analysis
import net.bobinski.data.monthlyBars
import net.bobinski.data.weeklyBars
import net.bobinski.logic.CalculateGain
import net.bobinski.logic.CalculateRsi
import net.bobinski.logic.CalculateYield
import net.bobinski.source.Yfinance
import java.time.Clock
import java.time.LocalDate
import kotlin.system.measureTimeMillis

object AnalysisEndpoint {

    fun forStock(symbol: String): Analysis {
        var analysis: Analysis? = null
        val generationTime = measureTimeMillis {
            val data = Yfinance.get(
                symbol,
                Yfinance.Period._5y
            )//.filterNot { it.date == LocalDate.now(Clock.systemUTC()).toKotlinLocalDate() }
            if (data.isEmpty()) throw IllegalArgumentException("No data for $symbol")

            analysis = Analysis(
                symbol = symbol,
                date = LocalDate.now(Clock.systemUTC()).toKotlinLocalDate(),
                generationTimeMs = 0,
                gain = Analysis.Gain(
                    monthly = CalculateGain.monthly(data),
                    quarterly = CalculateGain.quarterly(data),
                    yearly = CalculateGain.yearly(data)
                ),
                rsi = Analysis.Rsi(
                    daily = CalculateRsi.daily(data),
                    //weekly = CalculateRsi.weekly(data),
                    //monthly = CalculateRsi.monthly(data),
                    weekly = CalculateRsi.weeklyWithManualSplit(data),
                    monthly = CalculateRsi.monthlyWithManualSplit(data),
                    //weekly = CalculateRsi.forBars(data.weeklyBars()),
                    //monthly = CalculateRsi.forBars(data.monthlyBars())
                ),
                dividendYield = CalculateYield.yearly(data)
            )
        }
        return analysis!!.copy(generationTimeMs = generationTime)
    }
}