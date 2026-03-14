package net.bobinski.portfolio.api.persistence.inmemory

import java.util.Collections
import net.bobinski.portfolio.api.domain.model.AuditEvent
import net.bobinski.portfolio.api.domain.model.AuditEventQuery
import net.bobinski.portfolio.api.domain.repository.AuditEventRepository

class InMemoryAuditEventRepository : AuditEventRepository {
    private val events = Collections.synchronizedList(mutableListOf<AuditEvent>())

    override suspend fun list(query: AuditEventQuery): List<AuditEvent> = synchronized(events) {
        events.asSequence()
            .filter { event -> query.category == null || event.category == query.category }
            .sortedByDescending(AuditEvent::occurredAt)
            .take(query.limit)
            .toList()
    }

    override suspend fun append(event: AuditEvent): AuditEvent {
        events += event
        return event
    }

    override suspend fun deleteAll() {
        events.clear()
    }
}
