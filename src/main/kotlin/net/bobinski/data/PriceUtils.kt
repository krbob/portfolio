package net.bobinski.data

import kotlinx.datetime.LocalDate

fun Collection<HistoricalPrice>.latestPrice(): Double = maxBy { it.date }.close

fun Collection<HistoricalPrice>.priceFor(date: LocalDate): Double =
    filter { it.date <= date }.latestPrice()

fun Double.applyConversion(conversion: Double?): Double = conversion?.let { this * it } ?: this