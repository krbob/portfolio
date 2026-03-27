package net.bobinski.portfolio.api.persistence.db

import java.nio.file.Path
import kotlin.io.path.createTempDirectory
import kotlin.io.path.deleteIfExists
import kotlin.io.path.div
import net.bobinski.portfolio.api.persistence.config.JournalMode
import net.bobinski.portfolio.api.persistence.config.PersistenceConfig
import net.bobinski.portfolio.api.persistence.config.SynchronousMode
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

class DataSourceFactoryTest {

    @Test
    fun `sqlite datasource applies expected pragmas`() {
        val directory = createTempDirectory("portfolio-sqlite-datasource-test")
        val databasePath = directory.resolve("portfolio.db")
        val dataSource = DataSourceFactory.create(sqlitePersistenceConfig(databasePath))

        try {
            dataSource.connection.use { connection ->
                assertPragma(connection, "foreign_keys", 1)
                assertPragma(connection, "journal_mode", "wal")
                assertPragma(connection, "synchronous", 2)
                assertPragma(connection, "busy_timeout", 5_000)
            }
        } finally {
            (dataSource as AutoCloseable).close()
            (directory / "portfolio.db").deleteIfExists()
            (directory / "portfolio.db-shm").deleteIfExists()
            (directory / "portfolio.db-wal").deleteIfExists()
            directory.deleteIfExists()
        }
    }

    private fun assertPragma(connection: java.sql.Connection, pragma: String, expected: Int) {
        connection.createStatement().use { statement ->
            statement.executeQuery("pragma $pragma").use { resultSet ->
                resultSet.next()
                assertEquals(expected, resultSet.getInt(1))
            }
        }
    }

    private fun assertPragma(connection: java.sql.Connection, pragma: String, expected: String) {
        connection.createStatement().use { statement ->
            statement.executeQuery("pragma $pragma").use { resultSet ->
                resultSet.next()
                assertEquals(expected, resultSet.getString(1).lowercase())
            }
        }
    }

    private fun sqlitePersistenceConfig(databasePath: Path) = PersistenceConfig(
        databasePath = databasePath.toString(),
        journalMode = JournalMode.WAL,
        synchronousMode = SynchronousMode.FULL,
        busyTimeoutMs = 5_000
    )
}
