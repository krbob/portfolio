package net.bobinski.portfolio.api.persistence.jdbc

import java.time.Instant
import kotlin.io.path.createTempDirectory
import kotlin.io.path.deleteIfExists
import kotlin.io.path.div
import kotlinx.coroutines.runBlocking
import net.bobinski.portfolio.api.persistence.config.JournalMode
import net.bobinski.portfolio.api.persistence.config.PersistenceConfig
import net.bobinski.portfolio.api.persistence.config.SynchronousMode
import net.bobinski.portfolio.api.persistence.db.PersistenceResources
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class JdbcBackupChangeStateRepositoryTest {
    @Test
    fun `checkpoint only protects the captured revision and canonical writes are rollback safe`() = runBlocking {
        val directory = createTempDirectory("portfolio-backup-change-state")
        val databasePath = directory.resolve("portfolio.db")

        try {
            PersistenceResources(persistenceConfig(databasePath.toString())).use { resources ->
                val connectionManager = JdbcConnectionManager(resources.dataSource)
                val repository = JdbcBackupChangeStateRepository(connectionManager)

                val initial = repository.get()
                assertEquals(0, initial.currentRevision)
                assertEquals(0, initial.checkpointRevision)
                assertFalse(initial.hasUnprotectedChanges)

                insertAccount(connectionManager, "10000000-0000-0000-0000-000000000001")
                val firstChange = repository.get()
                assertEquals(1, firstChange.currentRevision)
                assertTrue(firstChange.hasUnprotectedChanges)
                assertNotNull(firstChange.dirtySince)

                val firstCheckpointAt = Instant.parse("2026-09-01T08:00:00Z")
                val protected = repository.checkpoint(
                    revision = 1,
                    fileName = "portfolio-backup-manual-first.json",
                    fileSha256 = "a".repeat(64),
                    checkpointedAt = firstCheckpointAt
                )
                assertEquals(1, protected.checkpointRevision)
                assertEquals("a".repeat(64), protected.checkpointFileSha256)
                assertFalse(protected.hasUnprotectedChanges)
                assertNull(protected.dirtySince)

                insertAccount(connectionManager, "10000000-0000-0000-0000-000000000002")
                val staleCheckpoint = repository.checkpoint(
                    revision = 1,
                    fileName = "portfolio-backup-manual-stale.json",
                    fileSha256 = "b".repeat(64),
                    checkpointedAt = firstCheckpointAt.plusSeconds(60)
                )
                assertEquals(2, staleCheckpoint.currentRevision)
                assertEquals(1, staleCheckpoint.checkpointRevision)
                assertTrue(staleCheckpoint.hasUnprotectedChanges)
                assertNotNull(staleCheckpoint.dirtySince)

                val rolledBack = runCatching {
                    connectionManager.inTransaction {
                        insertAccount(connectionManager, "10000000-0000-0000-0000-000000000003")
                        assertEquals(3, repository.get().currentRevision)
                        error("rollback")
                    }
                }
                assertTrue(rolledBack.isFailure)
                assertEquals(2, repository.get().currentRevision)

                val latest = repository.checkpoint(
                    revision = 2,
                    fileName = "portfolio-backup-post-change-latest.json",
                    fileSha256 = "c".repeat(64),
                    checkpointedAt = firstCheckpointAt.plusSeconds(120)
                )
                assertFalse(latest.hasUnprotectedChanges)
                assertNull(latest.dirtySince)

                val invalidated = repository.markUnprotected(firstCheckpointAt.plusSeconds(180))
                assertNull(invalidated.checkpointRevision)
                assertNull(invalidated.checkpointFileSha256)
                assertTrue(invalidated.hasUnprotectedChanges)
                assertNotNull(invalidated.dirtySince)
            }
        } finally {
            (directory / "portfolio.db").deleteIfExists()
            (directory / "portfolio.db-shm").deleteIfExists()
            (directory / "portfolio.db-wal").deleteIfExists()
            directory.deleteIfExists()
        }
    }

    private fun insertAccount(connectionManager: JdbcConnectionManager, id: String) {
        connectionManager.withConnection { connection ->
            connection.prepareStatement(
                """
                insert into accounts (
                    id, name, institution, type, base_currency, is_active, created_at, updated_at
                ) values (?, 'Brokerage', 'Broker', 'BROKERAGE', 'PLN', 1, ?, ?)
                """.trimIndent()
            ).use { statement ->
                statement.setString(1, id)
                statement.setString(2, "2026-09-01T08:00:00Z")
                statement.setString(3, "2026-09-01T08:00:00Z")
                statement.executeUpdate()
            }
        }
    }

    private fun persistenceConfig(databasePath: String) = PersistenceConfig(
        databasePath = databasePath,
        journalMode = JournalMode.WAL,
        synchronousMode = SynchronousMode.FULL,
        busyTimeoutMs = 5_000
    )
}
