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
    val provenance: MarketDataProvenanceMetadata? = null,
    val failureCount: Int = 0,
    val lastFailureAt: String? = null,
    val lastFailureReason: String? = null
)

@Serializable
data class MarketDataProvenanceMetadata(
    val source: String,
    val retrievedAt: String,
    val marketTimestamp: String? = null,
    val marketDate: String? = null,
    val currency: String? = null,
    val unitScale: Double,
    val adjustment: String,
    val coverageFrom: String? = null,
    val coverageTo: String? = null,
    val status: String
)
