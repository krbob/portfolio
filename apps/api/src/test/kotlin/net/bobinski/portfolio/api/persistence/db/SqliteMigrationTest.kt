package net.bobinski.portfolio.api.persistence.db

import kotlin.io.path.createTempDirectory
import kotlin.io.path.deleteIfExists
import kotlin.io.path.div
import net.bobinski.portfolio.api.persistence.config.JournalMode
import net.bobinski.portfolio.api.persistence.config.PersistenceConfig
import net.bobinski.portfolio.api.persistence.config.SynchronousMode
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class SqliteMigrationTest {

    @Test
    fun `sqlite migrations create the expected schema`() {
        val directory = createTempDirectory("portfolio-sqlite-migration-test")
        val databasePath = directory.resolve("portfolio.db")

        try {
            PersistenceResources(sqlitePersistenceConfig(databasePath.toString())).use { resources ->
                resources.dataSource.connection.use { connection ->
                    assertEquals(4, appliedMigrationCount(connection))
                    assertTrue(tableExists(connection, "accounts"))
                    assertTrue(tableExists(connection, "instruments"))
                    assertTrue(tableExists(connection, "edo_terms"))
                    assertTrue(tableExists(connection, "transactions"))
                    assertTrue(tableExists(connection, "portfolio_targets"))
                    assertTrue(tableExists(connection, "daily_snapshots"))
                    assertTrue(tableExists(connection, "audit_events"))
                    assertTrue(tableExists(connection, "read_model_snapshots"))
                    assertTrue(tableExists(connection, "transaction_import_profiles"))
                }
            }
        } finally {
            (directory / "portfolio.db").deleteIfExists()
            (directory / "portfolio.db-shm").deleteIfExists()
            (directory / "portfolio.db-wal").deleteIfExists()
            directory.deleteIfExists()
        }
    }

    private fun appliedMigrationCount(connection: java.sql.Connection): Int =
        connection.prepareStatement("select count(*) from flyway_schema_history where success = 1").use { statement ->
            statement.executeQuery().use { resultSet ->
                resultSet.next()
                resultSet.getInt(1)
            }
        }

    private fun tableExists(connection: java.sql.Connection, tableName: String): Boolean =
        connection.prepareStatement(
            "select count(*) from sqlite_master where type = 'table' and name = ?"
        ).use { statement ->
            statement.setString(1, tableName)
            statement.executeQuery().use { resultSet ->
                resultSet.next()
                resultSet.getInt(1) == 1
            }
        }

    private fun sqlitePersistenceConfig(databasePath: String) = PersistenceConfig(
        databasePath = databasePath,
        journalMode = JournalMode.WAL,
        synchronousMode = SynchronousMode.FULL,
        busyTimeoutMs = 5_000
    )
}
