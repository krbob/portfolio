package net.bobinski.data

import kotlinx.datetime.LocalDate
import kotlinx.serialization.Serializable

@Serializable
data class Analysis(
    val symbol: String,
    val name: String,
    val date: LocalDate,
    val lastPrice: Double,
    val gain: Gain,
    val rsi: Rsi,
    val dividendYield: Double,
    val peRatio: Float?,
    val pbRatio: Float?,
    val eps: Float?,
    val roe: Float?,
    val marketCap: Float?
) {

    @Serializable
    data class Gain(
        val daily: Double,
        val weekly: Double,
        val monthly: Double,
        val quarterly: Double,
        val yearly: Double
    )

    @Serializable
    data class Rsi(
        val daily: Double,
        val weekly: Double,
        val monthly: Double
    )

    fun roundValues() = copy(
        lastPrice = lastPrice.round(2),
        gain = Gain(
            daily = gain.daily.round(2),
            weekly = gain.weekly.round(2),
            monthly = gain.monthly.round(2),
            quarterly = gain.quarterly.round(2),
            yearly = gain.yearly.round(2)
        ),
        rsi = Rsi(
            daily = rsi.daily.round(2),
            weekly = rsi.weekly.round(2),
            monthly = rsi.monthly.round(2)
        ),
        dividendYield = dividendYield.round(3),
        peRatio = peRatio?.round(2),
        pbRatio = pbRatio?.round(2),
        eps = eps?.round(2),
        roe = roe?.round(2)
    )

    private fun Double.round(decimals: Int): Double {
        return "%.${decimals}f".format(this).toDouble()
    }

    private fun Float.round(decimals: Int): Float {
        return "%.${decimals}f".format(this).toFloat()
    }
}