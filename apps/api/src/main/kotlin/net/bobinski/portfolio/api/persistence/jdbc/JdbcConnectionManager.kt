package net.bobinski.portfolio.api.persistence.jdbc

import java.sql.Connection
import javax.sql.DataSource
import kotlinx.coroutines.asContextElement
import kotlinx.coroutines.withContext
import net.bobinski.portfolio.api.domain.service.PersistenceTransactionRunner

class JdbcConnectionManager(
    private val dataSource: DataSource
) : PersistenceTransactionRunner {
    private val currentConnection = ThreadLocal<Connection?>()

    fun <T> withConnection(block: (Connection) -> T): T {
        val connection = currentConnection.get()
        if (connection != null) {
            return block(connection)
        }

        dataSource.connection.use { freshConnection ->
            return block(freshConnection)
        }
    }

    override suspend fun <T> inTransaction(block: suspend () -> T): T {
        currentConnection.get()?.let {
            return block()
        }

        dataSource.connection.use { connection ->
            val previousAutoCommit = connection.autoCommit
            connection.autoCommit = false
            return try {
                withContext(currentConnection.asContextElement(connection)) {
                    block().also {
                        connection.commit()
                    }
                }
            } catch (error: Throwable) {
                connection.rollback()
                throw error
            } finally {
                connection.autoCommit = previousAutoCommit
            }
        }
    }
}
