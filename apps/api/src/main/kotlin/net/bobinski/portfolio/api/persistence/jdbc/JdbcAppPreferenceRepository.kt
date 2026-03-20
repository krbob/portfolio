package net.bobinski.portfolio.api.persistence.jdbc

import javax.sql.DataSource
import net.bobinski.portfolio.api.domain.model.AppPreference
import net.bobinski.portfolio.api.domain.repository.AppPreferenceRepository

class JdbcAppPreferenceRepository(
    private val dataSource: DataSource
) : AppPreferenceRepository {

    override suspend fun get(key: String): AppPreference? =
        dataSource.connection.use { connection ->
            connection.prepareStatement(
                """
                select preference_key, value_json, updated_at
                from app_preferences
                where preference_key = ?
                """.trimIndent()
            ).use { statement ->
                statement.setString(1, key)
                statement.executeQuery().use { resultSet ->
                    if (resultSet.next()) {
                        resultSet.toPreference()
                    } else {
                        null
                    }
                }
            }
        }

    override suspend fun list(): List<AppPreference> =
        dataSource.connection.use { connection ->
            connection.prepareStatement(
                """
                select preference_key, value_json, updated_at
                from app_preferences
                order by preference_key asc
                """.trimIndent()
            ).use { statement ->
                statement.executeQuery().use { resultSet ->
                    buildList {
                        while (resultSet.next()) {
                            add(resultSet.toPreference())
                        }
                    }
                }
            }
        }

    override suspend fun save(preference: AppPreference): AppPreference {
        dataSource.connection.use { connection ->
            connection.prepareStatement(
                """
                insert into app_preferences (
                    preference_key, value_json, updated_at
                ) values (?, ?, ?)
                on conflict(preference_key) do update set
                    value_json = excluded.value_json,
                    updated_at = excluded.updated_at
                """.trimIndent()
            ).use { statement ->
                statement.setString(1, preference.key)
                statement.setString(2, preference.valueJson)
                statement.setInstant(3, preference.updatedAt)
                statement.executeUpdate()
            }
        }
        return preference
    }

    override suspend fun delete(key: String): Boolean =
        dataSource.connection.use { connection ->
            connection.prepareStatement(
                """
                delete from app_preferences
                where preference_key = ?
                """.trimIndent()
            ).use { statement ->
                statement.setString(1, key)
                statement.executeUpdate() > 0
            }
        }

    override suspend fun deleteAll() {
        dataSource.connection.use { connection ->
            connection.prepareStatement("delete from app_preferences").use { statement ->
                statement.executeUpdate()
            }
        }
    }

    private fun java.sql.ResultSet.toPreference(): AppPreference = AppPreference(
        key = getString("preference_key"),
        valueJson = getString("value_json"),
        updatedAt = instant("updated_at")
    )
}
