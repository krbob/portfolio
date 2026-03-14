package net.bobinski.portfolio.api.domain.service

import java.time.Clock
import java.time.Instant
import java.util.UUID
import net.bobinski.portfolio.api.domain.model.AuditEvent
import net.bobinski.portfolio.api.domain.model.AuditEventCategory
import net.bobinski.portfolio.api.domain.model.AuditEventOutcome
import net.bobinski.portfolio.api.domain.model.AuditEventQuery
import net.bobinski.portfolio.api.domain.repository.AuditEventRepository

class AuditLogService(
    private val auditEventRepository: AuditEventRepository,
    private val clock: Clock
) {
    suspend fun list(limit: Int = 20, category: AuditEventCategory? = null): List<AuditEvent> =
        auditEventRepository.list(
            AuditEventQuery(
                category = category,
                limit = limit.coerceIn(1, 200)
            )
        )

    suspend fun record(
        category: AuditEventCategory,
        action: String,
        message: String,
        outcome: AuditEventOutcome = AuditEventOutcome.SUCCESS,
        entityType: String? = null,
        entityId: String? = null,
        metadata: Map<String, String> = emptyMap()
    ): AuditEvent =
        auditEventRepository.append(
            AuditEvent(
                id = UUID.randomUUID(),
                category = category,
                action = action,
                outcome = outcome,
                entityType = entityType?.trim()?.takeIf { it.isNotEmpty() },
                entityId = entityId?.trim()?.takeIf { it.isNotEmpty() },
                message = message.trim(),
                metadata = metadata
                    .mapValues { (_, value) -> value.trim() }
                    .filterValues { value -> value.isNotEmpty() },
                occurredAt = Instant.now(clock)
            )
        )
}
