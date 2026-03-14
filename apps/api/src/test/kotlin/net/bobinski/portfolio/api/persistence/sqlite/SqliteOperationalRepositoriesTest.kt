package net.bobinski.portfolio.api.persistence.sqlite

import java.time.Instant
import java.time.LocalDate
import java.util.UUID
import kotlin.io.path.createTempDirectory
import kotlin.io.path.deleteIfExists
import kotlin.io.path.div
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import net.bobinski.portfolio.api.domain.model.AuditEvent
import net.bobinski.portfolio.api.domain.model.AuditEventCategory
import net.bobinski.portfolio.api.domain.model.AuditEventOutcome
import net.bobinski.portfolio.api.domain.service.ReadModelCacheInvalidationReason
import net.bobinski.portfolio.api.domain.service.ReadModelCacheSnapshot
import net.bobinski.portfolio.api.persistence.config.PersistenceConfig
import net.bobinski.portfolio.api.persistence.config.PersistenceMode
import net.bobinski.portfolio.api.persistence.config.SqliteConfig
import net.bobinski.portfolio.api.persistence.config.SqliteJournalMode
import net.bobinski.portfolio.api.persistence.config.SqliteSynchronousMode
import net.bobinski.portfolio.api.persistence.db.PersistenceResources
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Test

class SqliteOperationalRepositoriesTest {

    @Test
    fun `sqlite operational repositories persist audit events and read model snapshots`() = runBlocking {
        sqliteDatabase { dataSource ->
            val auditRepository = SqliteAuditEventRepository(dataSource, Json.Default)
            val cacheRepository = SqliteReadModelCacheRepository(dataSource)

            val auditEvent = AuditEvent(
                id = UUID.fromString("60000000-0000-0000-0000-000000000001"),
                category = AuditEventCategory.SYSTEM,
                action = "SQLITE_SMOKE",
                outcome = AuditEventOutcome.SUCCESS,
                entityType = "test",
                entityId = "sqlite",
                message = "SQLite audit repository works.",
                metadata = mapOf("engine" to "sqlite"),
                occurredAt = Instant.parse("2026-03-01T12:15:00Z")
            )
            val snapshot = ReadModelCacheSnapshot(
                cacheKey = "history:max",
                modelName = "portfolio-history",
                modelVersion = 1,
                inputsFrom = LocalDate.parse("2025-01-01"),
                inputsTo = LocalDate.parse("2026-03-01"),
                sourceUpdatedAt = Instant.parse("2026-03-01T12:15:00Z"),
                generatedAt = Instant.parse("2026-03-01T12:16:00Z"),
                invalidationReason = ReadModelCacheInvalidationReason.CACHE_MISS,
                payloadJson = """{"points":[]}""",
                payloadSizeBytes = 13
            )

            auditRepository.append(auditEvent)
            cacheRepository.save(snapshot)

            val auditEvents = auditRepository.list()
            val cachedSnapshot = cacheRepository.get(snapshot.cacheKey)
            val snapshotList = cacheRepository.list()

            assertEquals(listOf(auditEvent), auditEvents)
            assertNotNull(cachedSnapshot)
            assertEquals(snapshot, cachedSnapshot)
            assertEquals(listOf(snapshot), snapshotList)
        }
    }

    private fun sqliteDatabase(block: suspend (javax.sql.DataSource) -> Unit) {
        val directory = createTempDirectory("portfolio-sqlite-operational-repositories-test")
        val databasePath = directory.resolve("portfolio.db")

        try {
            PersistenceResources(sqlitePersistenceConfig(databasePath.toString())).use { resources ->
                runBlocking {
                    block(resources.dataSource)
                }
            }
        } finally {
            (directory / "portfolio.db").deleteIfExists()
            (directory / "portfolio.db-shm").deleteIfExists()
            (directory / "portfolio.db-wal").deleteIfExists()
            directory.deleteIfExists()
        }
    }

    private fun sqlitePersistenceConfig(databasePath: String) = PersistenceConfig(
        mode = PersistenceMode.SQLITE,
        jdbcUrl = "jdbc:postgresql://127.0.0.1:15432/portfolio",
        username = "portfolio",
        password = "portfolio",
        sqlite = SqliteConfig(
            databasePath = databasePath,
            journalMode = SqliteJournalMode.WAL,
            synchronousMode = SqliteSynchronousMode.FULL,
            busyTimeoutMs = 5_000
        )
    )
}
