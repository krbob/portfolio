package net.bobinski.portfolio.api.domain.service

import java.nio.file.Files
import java.time.Clock
import java.time.Instant
import java.time.ZoneId
import java.time.ZoneOffset
import java.util.concurrent.atomic.AtomicInteger
import kotlin.io.path.exists
import kotlinx.coroutines.runBlocking
import net.bobinski.portfolio.api.backup.config.BackupConfig
import net.bobinski.portfolio.api.config.AppJsonFactory
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryAccountRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryAppPreferenceRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryAuditEventRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryBackupChangeStateRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryInstrumentRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryPortfolioTargetRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryTransactionImportProfileRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryTransactionRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class PortfolioBackupServiceTest {
    @Test
    fun `post-change backup waits for debounce and then checkpoints durable state`() = runBlocking {
        val fixture = fixture()
        try {
            fixture.changeStateRepository.recordChange(fixture.clock.current)

            val pending = fixture.service.status()
            assertTrue(pending.hasUnprotectedChanges)
            assertEquals(fixture.clock.current, pending.pendingSince)
            assertEquals(fixture.clock.current.plusSeconds(120), pending.nextPostChangeBackupAt)
            assertNull(fixture.service.runPostChangeBackupCheck())

            fixture.clock.current = fixture.clock.current.plusSeconds(119)
            assertNull(fixture.service.runPostChangeBackupCheck())

            fixture.clock.current = fixture.clock.current.plusSeconds(1)
            val backup = fixture.service.runPostChangeBackupCheck()
            assertNotNull(backup)
            assertEquals(BackupTrigger.POST_CHANGE, backup?.trigger)
            assertEquals(BackupRetentionClass.POST_CHANGE, backup?.retentionClass)
            assertFalse(fixture.service.status().hasUnprotectedChanges)
            assertEquals(1, fixture.changeStateRepository.get().checkpointRevision)
            assertTrue(
                requireNotNull(fixture.changeStateRepository.get().checkpointFileSha256)
                    .matches(Regex("[0-9a-f]{64}"))
            )
        } finally {
            fixture.close()
        }
    }

    @Test
    fun `continuous writes cannot postpone a post-change backup beyond maximum delay`() = runBlocking {
        val fixture = fixture()
        try {
            val firstChangeAt = fixture.clock.current
            fixture.changeStateRepository.recordChange(firstChangeAt)
            repeat(5) {
                fixture.clock.current = fixture.clock.current.plusSeconds(100)
                fixture.changeStateRepository.recordChange(fixture.clock.current)
                assertNull(fixture.service.runPostChangeBackupCheck())
            }

            fixture.clock.current = firstChangeAt.plusSeconds(599)
            assertNull(fixture.service.runPostChangeBackupCheck())
            fixture.clock.current = firstChangeAt.plusSeconds(600)
            assertNotNull(fixture.service.runPostChangeBackupCheck())
        } finally {
            fixture.close()
        }
    }

    @Test
    fun `retention keeps readable periodic backups and never prunes unmanaged json files`() = runBlocking {
        val fixture = fixture(retentionCount = 2)
        try {
            val first = fixture.service.createBackup()
            val firstPath = fixture.directory.resolve(first.fileName)
            val unmanagedPath = fixture.directory.resolve("external-export.json")
            Files.copy(firstPath, unmanagedPath)

            fixture.clock.current = fixture.clock.current.plusMillis(1)
            fixture.service.createBackup()
            fixture.clock.current = fixture.clock.current.plusMillis(1)
            fixture.service.createBackup()

            val status = fixture.service.status()
            assertFalse(firstPath.exists())
            assertTrue(unmanagedPath.exists())
            assertEquals(
                2,
                status.backups.count { backup ->
                    backup.retentionClass == BackupRetentionClass.PERIODIC && backup.isReadable
                }
            )
            assertEquals(
                BackupRetentionClass.UNMANAGED,
                status.backups.single { backup -> backup.fileName == "external-export.json" }.retentionClass
            )
        } finally {
            fixture.close()
        }
    }

    @Test
    fun `upgrade reconciliation adopts an equivalent existing backup once`() = runBlocking {
        val fixture = fixture()
        try {
            val existing = fixture.service.createBackup()
            val migrationTime = fixture.clock.current.plusSeconds(30)
            val reconcilingRepository = InMemoryBackupChangeStateRepository(
                BackupChangeState(
                    currentRevision = 1,
                    checkpointRevision = null,
                    dirtySince = migrationTime,
                    lastChangedAt = migrationTime,
                    checkpointedAt = null,
                    checkpointFileName = null,
                    checkpointFileSha256 = null,
                    reconciliationRequired = true
                )
            )
            val reconciledService = fixture.newService(reconcilingRepository)

            val status = reconciledService.status()
            assertFalse(status.hasUnprotectedChanges)
            assertEquals(existing.fileName, reconcilingRepository.get().checkpointFileName)
            assertEquals(1, reconcilingRepository.get().checkpointRevision)
            assertTrue(
                requireNotNull(reconcilingRepository.get().checkpointFileSha256)
                    .matches(Regex("[0-9a-f]{64}"))
            )
            assertFalse(reconcilingRepository.get().reconciliationRequired)
        } finally {
            fixture.close()
        }
    }

    @Test
    fun `status invalidates checkpoint when the protected file is replaced with valid json`() = runBlocking {
        val fixture = fixture()
        try {
            fixture.changeStateRepository.recordChange(fixture.clock.current)
            val backup = fixture.service.createBackup()
            replaceExportedAtWithValidJson(fixture.directory.resolve(backup.fileName))

            val status = fixture.service.status()

            assertTrue(status.hasUnprotectedChanges)
            assertNull(fixture.changeStateRepository.get().checkpointRevision)
            assertNull(fixture.changeStateRepository.get().checkpointFileSha256)
        } finally {
            fixture.close()
        }
    }

    @Test
    fun `background poll verifies only the durable checkpoint after restart`() = runBlocking {
        val inspectedFiles = AtomicInteger()
        val fixture = fixture(onBackupFileInspected = inspectedFiles::incrementAndGet)
        try {
            fixture.changeStateRepository.recordChange(fixture.clock.current)
            val backup = fixture.service.createBackup()
            Files.writeString(fixture.directory.resolve("unrelated-valid-name.json"), "not-json")
            replaceExportedAtWithValidJson(fixture.directory.resolve(backup.fileName))
            val restartedService = fixture.newService(fixture.changeStateRepository)
            inspectedFiles.set(0)

            assertNull(restartedService.runPostChangeBackupCheck())

            assertEquals(0, inspectedFiles.get())
            val state = fixture.changeStateRepository.get()
            assertTrue(state.hasUnprotectedChanges)
            assertNull(state.checkpointRevision)
            assertNull(state.checkpointFileSha256)
        } finally {
            fixture.close()
        }
    }

    private fun replaceExportedAtWithValidJson(path: java.nio.file.Path) {
        val original = Files.readString(path)
        val replacement = original.replace(
            "2026-09-01T08:00:00Z",
            "2026-09-01T08:00:01Z"
        )
        check(replacement != original)
        Files.writeString(path, replacement)
    }

    private fun fixture(
        retentionCount: Int = 3,
        onBackupFileInspected: () -> Unit = {}
    ): Fixture {
        val clock = MutableClock(Instant.parse("2026-09-01T08:00:00Z"))
        val directory = Files.createTempDirectory("portfolio-backup-service")
        val changeStateRepository = InMemoryBackupChangeStateRepository()
        val transactionRunner = NoopPersistenceTransactionRunner
        val auditLogService = AuditLogService(InMemoryAuditEventRepository(), clock)
        val transferService = PortfolioTransferService(
            accountRepository = InMemoryAccountRepository(),
            appPreferenceRepository = InMemoryAppPreferenceRepository(),
            instrumentRepository = InMemoryInstrumentRepository(),
            portfolioTargetRepository = InMemoryPortfolioTargetRepository(),
            transactionRepository = InMemoryTransactionRepository(),
            transactionImportProfileRepository = InMemoryTransactionImportProfileRepository(),
            transactionRunner = transactionRunner,
            auditLogService = auditLogService,
            clock = clock
        )
        val config = BackupConfig(
            enabled = true,
            directory = directory.toString(),
            intervalMinutes = 1_440,
            retentionCount = retentionCount,
            postChangeDebounceSeconds = 120,
            postChangeMaxDelaySeconds = 600,
            postChangeRetentionCount = 2,
            safetyRetentionDays = 30
        )
        val json = AppJsonFactory.create()
        val serviceFactory = { repository: BackupChangeStateRepository ->
            PortfolioBackupService(
                config = config,
                transferService = transferService,
                transactionRunner = transactionRunner,
                changeStateRepository = repository,
                auditLogService = auditLogService,
                json = json,
                clock = clock,
                backupFileInspectionObserver = { onBackupFileInspected() }
            )
        }
        return Fixture(
            directory = directory,
            clock = clock,
            changeStateRepository = changeStateRepository,
            service = serviceFactory(changeStateRepository),
            serviceFactory = serviceFactory
        )
    }

    private data class Fixture(
        val directory: java.nio.file.Path,
        val clock: MutableClock,
        val changeStateRepository: InMemoryBackupChangeStateRepository,
        val service: PortfolioBackupService,
        val serviceFactory: (BackupChangeStateRepository) -> PortfolioBackupService
    ) {
        fun newService(repository: BackupChangeStateRepository): PortfolioBackupService = serviceFactory(repository)

        fun close() {
            directory.toFile().deleteRecursively()
        }
    }

    private class MutableClock(var current: Instant) : Clock() {
        override fun getZone(): ZoneId = ZoneOffset.UTC

        override fun withZone(zone: ZoneId): Clock = this

        override fun instant(): Instant = current
    }

    private object NoopPersistenceTransactionRunner : PersistenceTransactionRunner {
        override suspend fun <T> inTransaction(block: suspend () -> T): T = block()
    }
}
