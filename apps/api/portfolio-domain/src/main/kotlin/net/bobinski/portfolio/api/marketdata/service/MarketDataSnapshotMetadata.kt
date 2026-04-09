package net.bobinski.portfolio.api.marketdata.service

import kotlinx.serialization.Serializable

@Serializable
data class MarketDataSnapshotMetadata(
    val snapshotType: String,
    val identity: String,
    val status: String,
    val lastCheckedAt: String,
    val lastSuccessfulCheckAt: String? = null,
    val canonicalUpdatedAt: String? = null,
    val sourceFrom: String? = null,
    val sourceTo: String? = null,
    val sourceAsOf: String? = null,
    val pointCount: Int? = null,
    val failureCount: Int = 0,
    val lastFailureAt: String? = null,
    val lastFailureReason: String? = null
)
