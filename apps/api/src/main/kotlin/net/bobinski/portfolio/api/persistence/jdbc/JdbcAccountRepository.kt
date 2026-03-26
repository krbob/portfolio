package net.bobinski.portfolio.api.persistence.jdbc

import java.sql.Connection
import javax.sql.DataSource
import net.bobinski.portfolio.api.domain.model.Account
import net.bobinski.portfolio.api.domain.model.AccountType
import net.bobinski.portfolio.api.domain.repository.AccountRepository
import java.util.UUID

class JdbcAccountRepository(
    private val dataSource: DataSource
) : AccountRepository {

    override suspend fun list(): List<Account> =
        dataSource.connection.use { connection ->
            connection.prepareStatement(
                """
                select id, name, institution, type, base_currency, display_order, is_active, created_at, updated_at
                from accounts
                order by display_order asc, created_at asc, name asc
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
        dataSource.connection.use { connection ->
            connection.prepareStatement(
                """
                select id, name, institution, type, base_currency, display_order, is_active, created_at, updated_at
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
        dataSource.connection.use { connection ->
            connection.upsertAccount(account)
        }
        return account
    }

    override suspend fun saveAll(accounts: List<Account>) {
        if (accounts.isEmpty()) {
            return
        }

        dataSource.connection.use { connection ->
            val previousAutoCommit = connection.autoCommit
            connection.autoCommit = false
            try {
                accounts.forEach { account ->
                    connection.upsertAccount(account)
                }
                connection.commit()
            } catch (exception: Exception) {
                connection.rollback()
                throw exception
            } finally {
                connection.autoCommit = previousAutoCommit
            }
        }
    }

    override suspend fun deleteAll() {
        dataSource.connection.use { connection ->
            connection.prepareStatement("delete from accounts").use { statement ->
                statement.executeUpdate()
            }
        }
    }

    private fun Connection.upsertAccount(account: Account) {
        prepareStatement(
            """
            insert into accounts (
                id, name, institution, type, base_currency, display_order, is_active, created_at, updated_at
            ) values (?, ?, ?, ?, ?, ?, ?, ?, ?)
            on conflict(id) do update set
                name = excluded.name,
                institution = excluded.institution,
                type = excluded.type,
                base_currency = excluded.base_currency,
                display_order = excluded.display_order,
                is_active = excluded.is_active,
                updated_at = excluded.updated_at
            """.trimIndent()
        ).use { statement ->
            statement.setUuid(1, account.id)
            statement.setString(2, account.name)
            statement.setString(3, account.institution)
            statement.setString(4, account.type.name)
            statement.setString(5, account.baseCurrency)
            statement.setInt(6, account.displayOrder)
            statement.setBooleanAsInteger(7, account.isActive)
            statement.setInstant(8, account.createdAt)
            statement.setInstant(9, account.updatedAt)
            statement.executeUpdate()
        }
    }

    private fun java.sql.ResultSet.toAccount(): Account = Account(
        id = uuid("id"),
        name = getString("name"),
        institution = getString("institution"),
        type = AccountType.valueOf(getString("type")),
        baseCurrency = getString("base_currency"),
        displayOrder = getInt("display_order"),
        isActive = booleanFromInteger("is_active"),
        createdAt = instant("created_at"),
        updatedAt = instant("updated_at")
    )
}
