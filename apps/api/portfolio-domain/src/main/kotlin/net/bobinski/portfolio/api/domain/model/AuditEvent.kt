package net.bobinski.portfolio.api.domain.model

import java.time.Instant
import java.util.UUID

data class AuditEvent(
    val id: UUID,
    val category: AuditEventCategory,
    val action: String,
    val outcome: AuditEventOutcome,
    val entityType: String?,
    val entityId: String?,
    val message: String,
    val metadata: Map<String, String>,
    val occurredAt: Instant
)

enum class AuditEventCategory {
    ACCOUNTS,
    INSTRUMENTS,
    TRANSACTIONS,
    TARGETS,
    IMPORTS,
    BACKUPS,
    SYSTEM
}

enum class AuditEventOutcome {
    SUCCESS,
    FAILURE
}

data class AuditEventQuery(
    val category: AuditEventCategory? = null,
    val limit: Int = 20
)
