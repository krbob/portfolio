package net.bobinski.logic

import net.bobinski.data.HistoricalPrice
import net.bobinski.data.applyConversion
import net.bobinski.data.latestPrice

object CalculateLastPrice {

    operator fun invoke(
        data: Collection<HistoricalPrice>,
        conversion: Collection<HistoricalPrice>?
    ) = data.latestPrice().applyConversion(conversion?.latestPrice())
}