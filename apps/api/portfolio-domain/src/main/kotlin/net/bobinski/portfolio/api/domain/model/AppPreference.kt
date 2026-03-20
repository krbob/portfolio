package net.bobinski.portfolio.api.domain.model

import java.time.Instant

data class AppPreference(
    val key: String,
    val valueJson: String,
    val updatedAt: Instant
)
