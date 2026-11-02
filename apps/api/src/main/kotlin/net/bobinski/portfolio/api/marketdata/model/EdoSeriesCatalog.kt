package net.bobinski.portfolio.api.marketdata.model

import kotlinx.serialization.Serializable

@Serializable
data class EdoSeriesCatalogResponse(
    val updatedAt: String,
    val series: List<EdoSeriesResponse>,
    val stale: Boolean = false
)

@Serializable
data class EdoSeriesResponse(
    val code: String,
    val seriesMonth: String,
    val saleStart: String,
    val saleEnd: String,
    val firstPeriodRateBps: Int,
    val marginBps: Int,
    val sourceUrl: String,
    val verifiedAt: String
)
