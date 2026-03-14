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
import net.bobinski.portfolio.api.domain.model.CsvDateFormat
import net.bobinski.portfolio.api.domain.model.CsvDecimalSeparator
import net.bobinski.portfolio.api.domain.model.CsvDelimiter
import net.bobinski.portfolio.api.domain.model.TransactionImportDefaults
import net.bobinski.portfolio.api.domain.model.TransactionImportHeaderMappings
import net.bobinski.portfolio.api.domain.model.TransactionImportProfile
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
    fun `sqlite operational repositories persist audit events read model snapshots and import profiles`() = runBlocking {
        sqliteDatabase { dataSource ->
            val auditRepository = SqliteAuditEventRepository(dataSource, Json.Default)
            val cacheRepository = SqliteReadModelCacheRepository(dataSource)
            val profileRepository = SqliteTransactionImportProfileRepository(dataSource, Json.Default)

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
            val profile = TransactionImportProfile(
                id = UUID.fromString("70000000-0000-0000-0000-000000000001"),
                name = "IBKR activity",
                description = "Interactive Brokers CSV export",
                delimiter = CsvDelimiter.COMMA,
                dateFormat = CsvDateFormat.ISO_LOCAL_DATE,
                decimalSeparator = CsvDecimalSeparator.DOT,
                skipDuplicatesByDefault = true,
                headerMappings = TransactionImportHeaderMappings(),
                defaults = TransactionImportDefaults(currency = "USD"),
                createdAt = Instant.parse("2026-03-01T12:17:00Z"),
                updatedAt = Instant.parse("2026-03-01T12:17:00Z")
            )

            auditRepository.append(auditEvent)
            cacheRepository.save(snapshot)
            profileRepository.save(profile)

            val auditEvents = auditRepository.list()
            val cachedSnapshot = cacheRepository.get(snapshot.cacheKey)
            val snapshotList = cacheRepository.list()
            val profiles = profileRepository.list()
            val persistedProfile = profileRepository.get(profile.id)

            assertEquals(listOf(auditEvent), auditEvents)
            assertNotNull(cachedSnapshot)
            assertEquals(snapshot, cachedSnapshot)
            assertEquals(listOf(snapshot), snapshotList)
            assertEquals(listOf(profile), profiles)
            assertEquals(profile, persistedProfile)
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
        sqlite = SqliteConfig(
            databasePath = databasePath,
            journalMode = SqliteJournalMode.WAL,
            synchronousMode = SqliteSynchronousMode.FULL,
            busyTimeoutMs = 5_000
        )
    )
}
