package net.bobinski.data

import kotlinx.datetime.LocalDate
import kotlinx.serialization.Serializable

@Serializable
data class Analysis(
    val symbol: String,
    val generationTimeMs: Long,
    val date: LocalDate,
    val lastPrice: Double,
    val gain: Gain,
    val rsi: Rsi,
    val dividendYield: Double,
) {

    @Serializable
    data class Gain(
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