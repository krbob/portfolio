package net.bobinski.portfolio.api.persistence.jdbc

import java.sql.Connection
import javax.sql.DataSource
import net.bobinski.portfolio.api.domain.model.Account
import net.bobinski.portfolio.api.domain.model.AccountType
import net.bobinski.portfolio.api.domain.repository.AccountRepository
import java.util.UUID

class JdbcAccountRepository(
    private val connectionManager: JdbcConnectionManager
) : AccountRepository {
    constructor(dataSource: DataSource) : this(JdbcConnectionManager(dataSource))

    override suspend fun list(): List<Account> =
        connectionManager.withConnection { connection ->
            connection.prepareStatement(
                """
                select id, name, institution, type, base_currency, is_active, created_at, updated_at
                from accounts
                order by created_at asc, name asc
                """.trimIndent()
            ).use { statement ->
                statement.executeQuery().use { resultSet ->
                    buildList {
                        while (resultSet.next()) {
                            add(resultSet.toAccount())
                        }
                    }
                }
            }
        }

    override suspend fun get(id: UUID): Account? =
        connectionManager.withConnection { connection ->
            connection.prepareStatement(
                """
                select id, name, institution, type, base_currency, is_active, created_at, updated_at
                from accounts
                where id = ?
                """.trimIndent()
            ).use { statement ->
                statement.setUuid(1, id)
                statement.executeQuery().use { resultSet ->
                    if (resultSet.next()) resultSet.toAccount() else null
                }
            }
        }

    override suspend fun save(account: Account): Account {
        connectionManager.withConnection { connection ->
            connection.upsertAccount(account)
        }
        return account
    }

    override suspend fun saveAll(accounts: List<Account>) {
        if (accounts.isEmpty()) {
            return
        }

        connectionManager.inTransaction {
            connectionManager.withConnection { connection ->
                accounts.forEach { account ->
                    connection.upsertAccount(account)
                }
            }
        }
    }

    override suspend fun deleteAll() {
        connectionManager.withConnection { connection ->
            connection.prepareStatement("delete from accounts").use { statement ->
                statement.executeUpdate()
            }
        }
    }

    private fun Connection.upsertAccount(account: Account) {
        prepareStatement(
            """
            insert into accounts (
                id, name, institution, type, base_currency, is_active, created_at, updated_at
            ) values (?, ?, ?, ?, ?, ?, ?, ?)
            on conflict(id) do update set
                name = excluded.name,
                institution = excluded.institution,
                type = excluded.type,
                base_currency = excluded.base_currency,
                is_active = excluded.is_active,
                updated_at = excluded.updated_at
            """.trimIndent()
        ).use { statement ->
            statement.setUuid(1, account.id)
            statement.setString(2, account.name)
            statement.setString(3, account.institution)
            statement.setString(4, account.type.name)
            statement.setString(5, account.baseCurrency)
            statement.setBooleanAsInteger(6, account.isActive)
            statement.setInstant(7, account.createdAt)
            statement.setInstant(8, account.updatedAt)
            statement.executeUpdate()
        }
    }

    private fun java.sql.ResultSet.toAccount(): Account = Account(
        id = uuid("id"),
        name = getString("name"),
        institution = getString("institution"),
        type = AccountType.valueOf(getString("type")),
        baseCurrency = getString("base_currency"),
        isActive = booleanFromInteger("is_active"),
        createdAt = instant("created_at"),
        updatedAt = instant("updated_at")
    )
}
