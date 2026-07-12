package net.bobinski.portfolio.api.domain.model

import java.time.Instant

data class OperationalStateEntry(
    val key: String,
    val valueJson: String,
    val updatedAt: Instant
)
