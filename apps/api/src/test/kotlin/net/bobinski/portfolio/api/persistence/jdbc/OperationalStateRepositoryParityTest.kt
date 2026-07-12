package net.bobinski.portfolio.api.persistence.jdbc

import java.time.Instant
import kotlin.io.path.createTempDirectory
import kotlin.io.path.deleteIfExists
import kotlin.io.path.div
import kotlinx.coroutines.runBlocking
import net.bobinski.portfolio.api.domain.model.OperationalStateEntry
import net.bobinski.portfolio.api.domain.repository.OperationalStateRepository
import net.bobinski.portfolio.api.persistence.config.JournalMode
import net.bobinski.portfolio.api.persistence.config.PersistenceConfig
import net.bobinski.portfolio.api.persistence.config.SynchronousMode
import net.bobinski.portfolio.api.persistence.db.PersistenceResources
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryOperationalStateRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

class OperationalStateRepositoryParityTest {
    @Test
    fun `sqlite matches in-memory operational state upsert and insert-if-absent semantics`() = runBlocking {
        val expected = exercise(InMemoryOperationalStateRepository())
        val directory = createTempDirectory("portfolio-operational-state-parity")
        val databasePath = directory.resolve("portfolio.db")

        val actual = try {
            PersistenceResources(persistenceConfig(databasePath.toString())).use { resources ->
                exercise(JdbcOperationalStateRepository(JdbcConnectionManager(resources.dataSource)))
            }
        } finally {
            (directory / "portfolio.db").deleteIfExists()
            (directory / "portfolio.db-shm").deleteIfExists()
            (directory / "portfolio.db-wal").deleteIfExists()
            directory.deleteIfExists()
        }

        assertEquals(expected, actual)
    }

    private suspend fun exercise(repository: OperationalStateRepository): RepositoryResult {
        val first = entry("portfolio.market-data.quote.first", "{\"value\":1}", "2026-03-27T10:00:00Z")
        val second = entry("portfolio.market-data.quote.second", "{\"value\":2}", "2026-03-27T10:05:00Z")
        repository.save(first)
        repository.save(second)
        val insertIfAbsent = repository.saveIfAbsent(
            entry(first.key, "{\"value\":0}", "2026-03-20T10:00:00Z")
        )
        val updated = entry(first.key, "{\"value\":3}", "2026-03-27T10:10:00Z")
        repository.save(updated)

        return RepositoryResult(
            insertIfAbsent = insertIfAbsent,
            current = repository.get(first.key),
            listed = repository.listByPrefix("portfolio.market-data.quote.")
        )
    }

    private fun entry(key: String, valueJson: String, updatedAt: String) = OperationalStateEntry(
        key = key,
        valueJson = valueJson,
        updatedAt = Instant.parse(updatedAt)
    )

    private fun persistenceConfig(databasePath: String) = PersistenceConfig(
        databasePath = databasePath,
        journalMode = JournalMode.WAL,
        synchronousMode = SynchronousMode.FULL,
        busyTimeoutMs = 5_000
    )

    private data class RepositoryResult(
        val insertIfAbsent: OperationalStateEntry,
        val current: OperationalStateEntry?,
        val listed: List<OperationalStateEntry>
    )
}
