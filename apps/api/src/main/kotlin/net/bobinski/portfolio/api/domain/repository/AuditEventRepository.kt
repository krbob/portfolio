package net.bobinski.portfolio.api.domain.repository

import net.bobinski.portfolio.api.domain.model.AuditEvent
import net.bobinski.portfolio.api.domain.model.AuditEventQuery

interface AuditEventRepository {
    suspend fun list(query: AuditEventQuery = AuditEventQuery()): List<AuditEvent>
    suspend fun append(event: AuditEvent): AuditEvent
    suspend fun deleteAll()
}
