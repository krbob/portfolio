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
                connection.createStatement().use { statement ->
                    statement.executeQuery("pragma foreign_keys").use { resultSet ->
                        resultSet.next()
                        assertEquals(1, resultSet.getInt(1))
                    }
                    statement.executeQuery("pragma journal_mode").use { resultSet ->
                        resultSet.next()
                        assertEquals("wal", resultSet.getString(1).lowercase())
                    }
                    statement.executeQuery("pragma synchronous").use { resultSet ->
                        resultSet.next()
                        assertEquals(2, resultSet.getInt(1))
                    }
                    statement.executeQuery("pragma busy_timeout").use { resultSet ->
                        resultSet.next()
                        assertEquals(5_000, resultSet.getInt(1))
                    }
                }
            }
        } finally {
            (dataSource as AutoCloseable).close()
            (directory / "portfolio.db").deleteIfExists()
            (directory / "portfolio.db-shm").deleteIfExists()
            (directory / "portfolio.db-wal").deleteIfExists()
            directory.deleteIfExists()
        }
    }

    private fun sqlitePersistenceConfig(databasePath: Path) = PersistenceConfig(
        databasePath = databasePath.toString(),
        journalMode = JournalMode.WAL,
        synchronousMode = SynchronousMode.FULL,
        busyTimeoutMs = 5_000
    )
}
