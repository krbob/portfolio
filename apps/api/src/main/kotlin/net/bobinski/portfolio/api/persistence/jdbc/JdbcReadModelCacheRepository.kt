package net.bobinski.portfolio.api.persistence.jdbc

import java.sql.Types
import java.time.LocalDate
import javax.sql.DataSource
import net.bobinski.portfolio.api.domain.repository.ReadModelCacheRepository
import net.bobinski.portfolio.api.domain.service.ReadModelCacheInvalidationReason
import net.bobinski.portfolio.api.domain.service.ReadModelCacheSnapshot

class JdbcReadModelCacheRepository(
    private val dataSource: DataSource
) : ReadModelCacheRepository {

    override suspend fun get(cacheKey: String): ReadModelCacheSnapshot? =
        dataSource.connection.use { connection ->
            connection.prepareStatement(
                """
                select cache_key, model_name, model_version, inputs_from, inputs_to, source_updated_at,
                       generated_at, invalidation_reason, payload_json::text, payload_size_bytes
                from read_model_snapshots
                where cache_key = ?
                """.trimIndent()
            ).use { statement ->
                statement.setString(1, cacheKey)
                statement.executeQuery().use { resultSet ->
                    if (resultSet.next()) resultSet.toReadModelCacheSnapshot() else null
                }
            }
        }

    override suspend fun list(): List<ReadModelCacheSnapshot> =
        dataSource.connection.use { connection ->
            connection.prepareStatement(
                """
                select cache_key, model_name, model_version, inputs_from, inputs_to, source_updated_at,
                       generated_at, invalidation_reason, payload_json::text, payload_size_bytes
                from read_model_snapshots
                order by generated_at desc, cache_key asc
                """.trimIndent()
            ).use { statement ->
                statement.executeQuery().use { resultSet ->
                    buildList {
                        while (resultSet.next()) {
                            add(resultSet.toReadModelCacheSnapshot())
                        }
                    }
                }
            }
        }

    override suspend fun save(snapshot: ReadModelCacheSnapshot) {
        dataSource.connection.use { connection ->
            connection.prepareStatement(
                """
                insert into read_model_snapshots (
                    cache_key, model_name, model_version, inputs_from, inputs_to, source_updated_at,
                    generated_at, invalidation_reason, payload_json, payload_size_bytes
                ) values (?, ?, ?, ?, ?, ?, ?, ?, cast(? as jsonb), ?)
                on conflict (cache_key) do update set
                    model_name = excluded.model_name,
                    model_version = excluded.model_version,
                    inputs_from = excluded.inputs_from,
                    inputs_to = excluded.inputs_to,
                    source_updated_at = excluded.source_updated_at,
                    generated_at = excluded.generated_at,
                    invalidation_reason = excluded.invalidation_reason,
                    payload_json = excluded.payload_json,
                    payload_size_bytes = excluded.payload_size_bytes
                """.trimIndent()
            ).use { statement ->
                statement.setString(1, snapshot.cacheKey)
                statement.setString(2, snapshot.modelName)
                statement.setInt(3, snapshot.modelVersion)
                statement.setLocalDateOrNull(4, snapshot.inputsFrom)
                statement.setLocalDateOrNull(5, snapshot.inputsTo)
                statement.setTimestampOrNull(6, snapshot.sourceUpdatedAt)
                statement.setTimestamp(7, snapshot.generatedAt.toSqlTimestamp())
                statement.setString(8, snapshot.invalidationReason.name)
                statement.setString(9, snapshot.payloadJson)
                statement.setInt(10, snapshot.payloadSizeBytes)
                statement.executeUpdate()
            }
        }
    }

    private fun java.sql.ResultSet.toReadModelCacheSnapshot(): ReadModelCacheSnapshot = ReadModelCacheSnapshot(
        cacheKey = getString("cache_key"),
        modelName = getString("model_name"),
        modelVersion = getInt("model_version"),
        inputsFrom = localDateOrNull("inputs_from"),
        inputsTo = localDateOrNull("inputs_to"),
        sourceUpdatedAt = instantOrNull("source_updated_at"),
        generatedAt = instant("generated_at"),
        invalidationReason = ReadModelCacheInvalidationReason.valueOf(getString("invalidation_reason")),
        payloadJson = getString("payload_json"),
        payloadSizeBytes = getInt("payload_size_bytes")
    )

    private fun java.sql.PreparedStatement.setLocalDateOrNull(index: Int, value: LocalDate?) {
        if (value == null) {
            setNull(index, Types.DATE)
        } else {
            setDate(index, java.sql.Date.valueOf(value))
        }
    }
}
