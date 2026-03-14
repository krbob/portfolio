package net.bobinski.portfolio.api.persistence.jdbc

import java.sql.Connection
import java.sql.Timestamp
import java.sql.Types
import java.util.UUID
import javax.sql.DataSource
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import net.bobinski.portfolio.api.domain.model.AuditEvent
import net.bobinski.portfolio.api.domain.model.AuditEventCategory
import net.bobinski.portfolio.api.domain.model.AuditEventOutcome
import net.bobinski.portfolio.api.domain.model.AuditEventQuery
import net.bobinski.portfolio.api.domain.repository.AuditEventRepository

class JdbcAuditEventRepository(
    private val dataSource: DataSource,
    private val json: Json
) : AuditEventRepository {

    override suspend fun list(query: AuditEventQuery): List<AuditEvent> =
        dataSource.connection.use { connection ->
            val sql = buildString {
                append(
                    """
                    select
                        id, category, action, outcome, entity_type, entity_id, message, metadata_json, occurred_at
                    from audit_events
                    """.trimIndent()
                )
                if (query.category != null) {
                    append(" where category = ?")
                }
                append(" order by occurred_at desc limit ?")
            }

            connection.prepareStatement(sql).use { statement ->
                var parameterIndex = 1
                if (query.category != null) {
                    statement.setString(parameterIndex++, query.category.name)
                }
                statement.setInt(parameterIndex, query.limit)

                statement.executeQuery().use { resultSet ->
                    buildList {
                        while (resultSet.next()) {
                            add(
                                AuditEvent(
                                    id = resultSet.getObject("id", UUID::class.java),
                                    category = AuditEventCategory.valueOf(resultSet.getString("category")),
                                    action = resultSet.getString("action"),
                                    outcome = AuditEventOutcome.valueOf(resultSet.getString("outcome")),
                                    entityType = resultSet.getString("entity_type"),
                                    entityId = resultSet.getString("entity_id"),
                                    message = resultSet.getString("message"),
                                    metadata = json.decodeFromString(resultSet.getString("metadata_json")),
                                    occurredAt = resultSet.getTimestamp("occurred_at").toInstant()
                                )
                            )
                        }
                    }
                }
            }
        }

    override suspend fun append(event: AuditEvent): AuditEvent {
        dataSource.connection.use { connection ->
            connection.insertAuditEvent(event)
        }
        return event
    }

    override suspend fun deleteAll() {
        dataSource.connection.use { connection ->
            connection.prepareStatement("delete from audit_events").use { statement ->
                statement.executeUpdate()
            }
        }
    }

    private fun Connection.insertAuditEvent(event: AuditEvent) {
        prepareStatement(
            """
            insert into audit_events (
                id, category, action, outcome, entity_type, entity_id, message, metadata_json, occurred_at
            ) values (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """.trimIndent()
        ).use { statement ->
            statement.setObject(1, event.id)
            statement.setString(2, event.category.name)
            statement.setString(3, event.action)
            statement.setString(4, event.outcome.name)
            if (event.entityType == null) {
                statement.setNull(5, Types.VARCHAR)
            } else {
                statement.setString(5, event.entityType)
            }
            if (event.entityId == null) {
                statement.setNull(6, Types.VARCHAR)
            } else {
                statement.setString(6, event.entityId)
            }
            statement.setString(7, event.message)
            statement.setString(8, json.encodeToString(event.metadata))
            statement.setTimestamp(9, Timestamp.from(event.occurredAt))
            statement.executeUpdate()
        }
    }
}
