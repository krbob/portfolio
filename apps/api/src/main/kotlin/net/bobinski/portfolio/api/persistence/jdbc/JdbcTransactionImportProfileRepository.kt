package net.bobinski.portfolio.api.persistence.jdbc

import java.sql.Connection
import javax.sql.DataSource
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import net.bobinski.portfolio.api.domain.model.CsvDateFormat
import net.bobinski.portfolio.api.domain.model.CsvDecimalSeparator
import net.bobinski.portfolio.api.domain.model.CsvDelimiter
import net.bobinski.portfolio.api.domain.model.TransactionImportDefaults
import net.bobinski.portfolio.api.domain.model.TransactionImportHeaderMappings
import net.bobinski.portfolio.api.domain.model.TransactionImportProfile
import net.bobinski.portfolio.api.domain.repository.TransactionImportProfileRepository
import java.util.UUID

class JdbcTransactionImportProfileRepository(
    private val connectionManager: JdbcConnectionManager,
    private val json: Json
) : TransactionImportProfileRepository {
    constructor(dataSource: DataSource, json: Json) : this(JdbcConnectionManager(dataSource), json)

    override suspend fun list(): List<TransactionImportProfile> =
        connectionManager.withConnection { connection ->
            connection.prepareStatement(
                """
                select
                    id, name, description, delimiter, date_format, decimal_separator,
                    skip_duplicates_by_default, header_mappings_json, defaults_json, created_at, updated_at
                from transaction_import_profiles
                order by name asc
                """.trimIndent()
            ).use { statement ->
                statement.executeQuery().use { resultSet ->
                    buildList {
                        while (resultSet.next()) {
                            add(resultSet.toImportProfile())
                        }
                    }
                }
            }
        }

    override suspend fun get(id: UUID): TransactionImportProfile? =
        connectionManager.withConnection { connection ->
            connection.prepareStatement(
                """
                select
                    id, name, description, delimiter, date_format, decimal_separator,
                    skip_duplicates_by_default, header_mappings_json, defaults_json, created_at, updated_at
                from transaction_import_profiles
                where id = ?
                """.trimIndent()
            ).use { statement ->
                statement.setUuid(1, id)
                statement.executeQuery().use { resultSet ->
                    if (resultSet.next()) resultSet.toImportProfile() else null
                }
            }
        }

    override suspend fun save(profile: TransactionImportProfile): TransactionImportProfile {
        connectionManager.withConnection { connection ->
            connection.upsertImportProfile(profile)
        }
        return profile
    }

    override suspend fun delete(id: UUID): Boolean =
        connectionManager.withConnection { connection ->
            connection.prepareStatement(
                """
                delete from transaction_import_profiles
                where id = ?
                """.trimIndent()
            ).use { statement ->
                statement.setUuid(1, id)
                statement.executeUpdate() > 0
            }
        }

    override suspend fun deleteAll() {
        connectionManager.withConnection { connection ->
            connection.prepareStatement("delete from transaction_import_profiles").use { statement ->
                statement.executeUpdate()
            }
        }
    }

    private fun Connection.upsertImportProfile(profile: TransactionImportProfile) {
        prepareStatement(
            """
            insert into transaction_import_profiles (
                id, name, description, delimiter, date_format, decimal_separator,
                skip_duplicates_by_default, header_mappings_json, defaults_json, created_at, updated_at
            ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            on conflict(id) do update set
                name = excluded.name,
                description = excluded.description,
                delimiter = excluded.delimiter,
                date_format = excluded.date_format,
                decimal_separator = excluded.decimal_separator,
                skip_duplicates_by_default = excluded.skip_duplicates_by_default,
                header_mappings_json = excluded.header_mappings_json,
                defaults_json = excluded.defaults_json,
                updated_at = excluded.updated_at
            """.trimIndent()
        ).use { statement ->
            statement.setUuid(1, profile.id)
            statement.setString(2, profile.name)
            statement.setString(3, profile.description)
            statement.setString(4, profile.delimiter.name)
            statement.setString(5, profile.dateFormat.name)
            statement.setString(6, profile.decimalSeparator.name)
            statement.setBooleanAsInteger(7, profile.skipDuplicatesByDefault)
            statement.setString(8, json.encodeToString(profile.headerMappings))
            statement.setString(9, json.encodeToString(profile.defaults))
            statement.setInstant(10, profile.createdAt)
            statement.setInstant(11, profile.updatedAt)
            statement.executeUpdate()
        }
    }

    private fun java.sql.ResultSet.toImportProfile(): TransactionImportProfile = TransactionImportProfile(
        id = uuid("id"),
        name = getString("name"),
        description = getString("description"),
        delimiter = CsvDelimiter.valueOf(getString("delimiter")),
        dateFormat = CsvDateFormat.valueOf(getString("date_format")),
        decimalSeparator = CsvDecimalSeparator.valueOf(getString("decimal_separator")),
        skipDuplicatesByDefault = booleanFromInteger("skip_duplicates_by_default"),
        headerMappings = json.decodeFromString<TransactionImportHeaderMappings>(getString("header_mappings_json")),
        defaults = json.decodeFromString<TransactionImportDefaults>(getString("defaults_json")),
        createdAt = instant("created_at"),
        updatedAt = instant("updated_at")
    )
}
