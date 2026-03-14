package net.bobinski.portfolio.api.marketdata.model

import java.math.BigDecimal
import java.time.LocalDate

data class HistoricalPricePoint(
    val date: LocalDate,
    val closePricePln: BigDecimal
)
