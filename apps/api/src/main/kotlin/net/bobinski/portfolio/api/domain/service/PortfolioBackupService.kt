package net.bobinski.portfolio.api.domain.service

import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.StandardOpenOption.CREATE_NEW
import java.nio.file.StandardOpenOption.WRITE
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import net.bobinski.portfolio.api.backup.config.BackupConfig
import net.bobinski.portfolio.api.domain.error.ResourceNotFoundException

class PortfolioBackupService(
    private val config: BackupConfig,
    private val transferService: PortfolioTransferService,
    private val json: Json,
    private val clock: Clock
) {
    private val operationMutex = Mutex()

    @Volatile
    private var running = false

    @Volatile
    private var lastRunAt: Instant? = null

    @Volatile
    private var lastSuccessAt: Instant? = null

    @Volatile
    private var lastFailureAt: Instant? = null

    @Volatile
    private var lastFailureMessage: String? = null

    suspend fun status(): PortfolioBackupStatus = operationMutex.withLock {
        PortfolioBackupStatus(
            schedulerEnabled = config.enabled,
            directory = backupDirectory().toString(),
            intervalMinutes = config.intervalMinutes,
            retentionCount = config.retentionCount,
            running = running,
            lastRunAt = lastRunAt,
            lastSuccessAt = lastSuccessAt,
            lastFailureAt = lastFailureAt,
            lastFailureMessage = lastFailureMessage,
            backups = listBackupsUnlocked()
        )
    }

    suspend fun createBackup(trigger: BackupTrigger = BackupTrigger.MANUAL): PortfolioBackupRecord =
        operationMutex.withLock {
            running = true
            val startedAt = Instant.now(clock)
            lastRunAt = startedAt

            try {
                runCatching {
                    val snapshot = transferService.exportState().toStored()
                    val file = backupDirectory().resolve(fileNameFor(snapshot.exportedAt))

                    Files.writeString(
                        file,
                        json.encodeToString(StoredPortfolioSnapshot.serializer(), snapshot),
                        CREATE_NEW,
                        WRITE
                    )

                    pruneOldBackups()
                    inspectBackupFile(file)
                }.onSuccess {
                    lastSuccessAt = startedAt
                    lastFailureAt = null
                    lastFailureMessage = null
                }.onFailure { exception ->
                    lastFailureAt = startedAt
                    lastFailureMessage = exception.message ?: "${trigger.name} backup failed."
                }.getOrThrow()
            } finally {
                running = false
            }
        }

    suspend fun restoreBackup(request: PortfolioBackupRestoreRequest): PortfolioBackupRestoreResult =
        operationMutex.withLock {
            val record = inspectBackupFile(resolveBackupFile(request.fileName))
            require(record.isReadable) {
                "Backup ${request.fileName} is not readable and cannot be restored."
            }

            val snapshot = readBackupSnapshot(request.fileName).toDomain()
            val result = transferService.importState(
                PortfolioImportRequest(
                    mode = request.mode,
                    snapshot = snapshot
                )
            )

            PortfolioBackupRestoreResult(
                fileName = request.fileName,
                mode = result.mode,
                accountCount = result.accountCount,
                instrumentCount = result.instrumentCount,
                transactionCount = result.transactionCount
            )
        }

    suspend fun runScheduledBackup(): PortfolioBackupRecord = createBackup(trigger = BackupTrigger.SCHEDULED)

    private fun listBackupsUnlocked(): List<PortfolioBackupRecord> {
        val directory = backupDirectory()
        if (!Files.exists(directory)) {
            return emptyList()
        }

        return Files.list(directory).use { stream ->
            stream
                .filter { path -> Files.isRegularFile(path) && path.fileName.toString().endsWith(".json") }
                .sorted { left, right ->
                    Files.getLastModifiedTime(right).compareTo(Files.getLastModifiedTime(left))
                }
                .map(::inspectBackupFile)
                .toList()
        }
    }

    private fun pruneOldBackups() {
        val directory = backupDirectory()
        if (!Files.exists(directory)) {
            return
        }

        Files.list(directory).use { stream ->
            stream
                .filter { path -> Files.isRegularFile(path) && path.fileName.toString().endsWith(".json") }
                .sorted { left, right ->
                    Files.getLastModifiedTime(right).compareTo(Files.getLastModifiedTime(left))
                }
                .skip(config.retentionCount.toLong())
                .forEach(Files::deleteIfExists)
        }
    }

    private fun inspectBackupFile(path: Path): PortfolioBackupRecord {
        val sizeBytes = Files.size(path)
        val createdAt = runCatching {
            Instant.ofEpochMilli(Files.getLastModifiedTime(path).toMillis())
        }.getOrElse {
            Instant.now(clock)
        }

        return runCatching {
            val snapshot = readBackupSnapshot(path.fileName.toString())
            PortfolioBackupRecord(
                fileName = path.fileName.toString(),
                createdAt = createdAt,
                exportedAt = Instant.parse(snapshot.exportedAt),
                sizeBytes = sizeBytes,
                schemaVersion = snapshot.schemaVersion,
                accountCount = snapshot.accounts.size,
                instrumentCount = snapshot.instruments.size,
                transactionCount = snapshot.transactions.size,
                isReadable = true,
                errorMessage = null
            )
        }.getOrElse { exception ->
            PortfolioBackupRecord(
                fileName = path.fileName.toString(),
                createdAt = createdAt,
                exportedAt = null,
                sizeBytes = sizeBytes,
                schemaVersion = null,
                accountCount = null,
                instrumentCount = null,
                transactionCount = null,
                isReadable = false,
                errorMessage = exception.message ?: "Failed to read backup."
            )
        }
    }

    private fun readBackupSnapshot(fileName: String): StoredPortfolioSnapshot {
        val file = resolveBackupFile(fileName)
        return json.decodeFromString(StoredPortfolioSnapshot.serializer(), Files.readString(file))
    }

    private fun resolveBackupFile(fileName: String): Path {
        require(BACKUP_FILE_NAME_PATTERN.matches(fileName)) { "Backup file name is not valid." }

        val resolved = backupDirectory().resolve(fileName).normalize()
        if (!resolved.startsWith(backupDirectory())) {
            throw IllegalArgumentException("Backup file name is not valid.")
        }
        if (!Files.exists(resolved) || !Files.isRegularFile(resolved)) {
            throw ResourceNotFoundException("Backup $fileName was not found.")
        }

        return resolved
    }

    private fun backupDirectory(): Path = Path.of(config.directory)
        .toAbsolutePath()
        .normalize()
        .also { path -> Files.createDirectories(path) }

    private fun fileNameFor(exportedAt: String): String = "portfolio-backup-${
        BACKUP_FILE_NAME_FORMAT.format(Instant.parse(exportedAt))
    }.json"

    private companion object {
        val BACKUP_FILE_NAME_FORMAT: DateTimeFormatter =
            DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmssSSS'Z'").withZone(ZoneOffset.UTC)
        val BACKUP_FILE_NAME_PATTERN = Regex("[A-Za-z0-9._-]+")
    }
}

data class PortfolioBackupStatus(
    val schedulerEnabled: Boolean,
    val directory: String,
    val intervalMinutes: Long,
    val retentionCount: Int,
    val running: Boolean,
    val lastRunAt: Instant?,
    val lastSuccessAt: Instant?,
    val lastFailureAt: Instant?,
    val lastFailureMessage: String?,
    val backups: List<PortfolioBackupRecord>
)

data class PortfolioBackupRecord(
    val fileName: String,
    val createdAt: Instant,
    val exportedAt: Instant?,
    val sizeBytes: Long,
    val schemaVersion: Int?,
    val accountCount: Int?,
    val instrumentCount: Int?,
    val transactionCount: Int?,
    val isReadable: Boolean,
    val errorMessage: String?
)

data class PortfolioBackupRestoreRequest(
    val fileName: String,
    val mode: ImportMode
)

data class PortfolioBackupRestoreResult(
    val fileName: String,
    val mode: ImportMode,
    val accountCount: Int,
    val instrumentCount: Int,
    val transactionCount: Int
)

enum class BackupTrigger {
    MANUAL,
    SCHEDULED
}

@Serializable
private data class StoredPortfolioSnapshot(
    val schemaVersion: Int,
    val exportedAt: String,
    val accounts: List<AccountSnapshot>,
    val instruments: List<InstrumentSnapshot>,
    val transactions: List<TransactionSnapshot>
)

private fun PortfolioSnapshot.toStored(): StoredPortfolioSnapshot = StoredPortfolioSnapshot(
    schemaVersion = schemaVersion,
    exportedAt = exportedAt.toString(),
    accounts = accounts,
    instruments = instruments,
    transactions = transactions
)

private fun StoredPortfolioSnapshot.toDomain(): PortfolioSnapshot = PortfolioSnapshot(
    schemaVersion = schemaVersion,
    exportedAt = Instant.parse(exportedAt),
    accounts = accounts,
    instruments = instruments,
    transactions = transactions
)
