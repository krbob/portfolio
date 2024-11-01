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
}