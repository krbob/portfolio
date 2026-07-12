package net.bobinski.portfolio.api.persistence.jdbc

import net.bobinski.portfolio.api.domain.model.OperationalStateEntry
import net.bobinski.portfolio.api.domain.repository.OperationalStateRepository

class JdbcOperationalStateRepository(
    private val connectionManager: JdbcConnectionManager
) : OperationalStateRepository {
    override suspend fun get(key: String): OperationalStateEntry? =
        connectionManager.withConnection { connection ->
            connection.prepareStatement(
                """
                select state_key, value_json, updated_at
                from operational_state
                where state_key = ?
                """.trimIndent()
            ).use { statement ->
                statement.setString(1, key)
                statement.executeQuery().use { resultSet ->
                    if (resultSet.next()) resultSet.toOperationalStateEntry() else null
                }
            }
        }

    override suspend fun listByPrefix(prefix: String): List<OperationalStateEntry> =
        connectionManager.withConnection { connection ->
            connection.prepareStatement(
                """
                select state_key, value_json, updated_at
                from operational_state
                where state_key like ?
                order by state_key asc
                """.trimIndent()
            ).use { statement ->
                statement.setString(1, "$prefix%")
                statement.executeQuery().use { resultSet ->
                    buildList {
                        while (resultSet.next()) {
                            add(resultSet.toOperationalStateEntry())
                        }
                    }
                }
            }
        }

    override suspend fun save(entry: OperationalStateEntry): OperationalStateEntry {
        connectionManager.withConnection { connection ->
            connection.prepareStatement(
                """
                insert into operational_state (state_key, value_json, updated_at)
                values (?, ?, ?)
                on conflict(state_key) do update set
                    value_json = excluded.value_json,
                    updated_at = excluded.updated_at
                """.trimIndent()
            ).use { statement ->
                statement.setString(1, entry.key)
                statement.setString(2, entry.valueJson)
                statement.setInstant(3, entry.updatedAt)
                statement.executeUpdate()
            }
        }
        return entry
    }

    override suspend fun saveIfAbsent(entry: OperationalStateEntry): OperationalStateEntry {
        connectionManager.withConnection { connection ->
            connection.prepareStatement(
                """
                insert into operational_state (state_key, value_json, updated_at)
                values (?, ?, ?)
                on conflict(state_key) do nothing
                """.trimIndent()
            ).use { statement ->
                statement.setString(1, entry.key)
                statement.setString(2, entry.valueJson)
                statement.setInstant(3, entry.updatedAt)
                statement.executeUpdate()
            }
        }
        return requireNotNull(get(entry.key)) { "Operational state ${entry.key} was not stored." }
    }

    override suspend fun saveIfNewer(entry: OperationalStateEntry): OperationalStateEntry {
        var current = saveIfAbsent(entry)
        while (entry.updatedAt > current.updatedAt) {
            if (replaceIfUnchanged(current = current, replacement = entry)) {
                return entry
            }
            current = requireNotNull(get(entry.key)) {
                "Operational state ${entry.key} disappeared during reconciliation."
            }
        }
        return current
    }

    private suspend fun replaceIfUnchanged(
        current: OperationalStateEntry,
        replacement: OperationalStateEntry
    ): Boolean = connectionManager.withConnection { connection ->
        connection.prepareStatement(
            """
            update operational_state
            set value_json = ?, updated_at = ?
            where state_key = ?
              and value_json = ?
              and updated_at = ?
            """.trimIndent()
        ).use { statement ->
            statement.setString(1, replacement.valueJson)
            statement.setInstant(2, replacement.updatedAt)
            statement.setString(3, current.key)
            statement.setString(4, current.valueJson)
            statement.setInstant(5, current.updatedAt)
            statement.executeUpdate() > 0
        }
    }

    private fun java.sql.ResultSet.toOperationalStateEntry(): OperationalStateEntry = OperationalStateEntry(
        key = getString("state_key"),
        valueJson = getString("value_json"),
        updatedAt = instant("updated_at")
    )
}
