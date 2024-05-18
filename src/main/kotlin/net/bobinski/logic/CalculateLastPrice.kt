package net.bobinski.logic

import net.bobinski.data.HistoricalPrice

object CalculateLastPrice {

    operator fun invoke(data: Collection<HistoricalPrice>) = data.maxBy { it.date }.close
}