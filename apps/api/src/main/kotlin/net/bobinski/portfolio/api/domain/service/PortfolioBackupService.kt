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
import net.bobinski.portfolio.api.domain.model.AuditEventCategory
import net.bobinski.portfolio.api.domain.model.AuditEventOutcome

class PortfolioBackupService(
    private val config: BackupConfig,
    private val transferService: PortfolioTransferService,
    private val auditLogService: AuditLogService,
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
            createBackupUnlocked(trigger)
        }

    private suspend fun createBackupUnlocked(trigger: BackupTrigger): PortfolioBackupRecord {
        running = true
        val startedAt = Instant.now(clock)
        lastRunAt = startedAt

        try {
            val snapshot = transferService.exportState().toStored()
            val file = backupDirectory().resolve(fileNameFor(snapshot.exportedAt))

            Files.writeString(
                file,
                json.encodeToString(StoredPortfolioSnapshot.serializer(), snapshot),
                CREATE_NEW,
                WRITE
            )

            val prunedBackups = pruneOldBackups()
            val backup = inspectBackupFile(file)
            lastSuccessAt = startedAt
            lastFailureAt = null
            lastFailureMessage = null
            auditLogService.record(
                category = AuditEventCategory.BACKUPS,
                action = "BACKUP_CREATED",
                entityType = "BACKUP",
                entityId = backup.fileName,
                message = "Created ${trigger.name.lowercase()} backup ${backup.fileName}.",
                metadata = mapOf(
                    "trigger" to trigger.name,
                    "targetCount" to (backup.targetCount?.toString() ?: "n/a"),
                    "transactionCount" to (backup.transactionCount?.toString() ?: "n/a"),
                    "sizeBytes" to backup.sizeBytes.toString()
                )
            )
            prunedBackups.forEach { prunedFileName ->
                auditLogService.record(
                    category = AuditEventCategory.BACKUPS,
                    action = "BACKUP_PRUNED",
                    entityType = "BACKUP",
                    entityId = prunedFileName,
                    message = "Pruned backup $prunedFileName due to retention policy.",
                    metadata = mapOf(
                        "trigger" to trigger.name,
                        "retentionCount" to config.retentionCount.toString()
                    )
                )
            }
            return backup
        } catch (exception: Exception) {
            lastFailureAt = startedAt
            lastFailureMessage = exception.message ?: "${trigger.name} backup failed."
            auditLogService.record(
                category = AuditEventCategory.BACKUPS,
                action = "BACKUP_CREATE_FAILED",
                outcome = AuditEventOutcome.FAILURE,
                entityType = "BACKUP",
                message = "Failed to create ${trigger.name.lowercase()} backup.",
                metadata = mapOf(
                    "trigger" to trigger.name,
                    "error" to (exception.message ?: "unknown")
                )
            )
            throw exception
        } finally {
            running = false
        }
    }

    suspend fun restoreBackup(request: PortfolioBackupRestoreRequest): PortfolioBackupRestoreResult =
        operationMutex.withLock {
            val safetyBackup = if (request.mode == ImportMode.REPLACE) {
                createBackupUnlocked(BackupTrigger.PRE_RESTORE_REPLACE)
            } else {
                null
            }
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

            val restoreResult = PortfolioBackupRestoreResult(
                fileName = request.fileName,
                mode = result.mode,
                accountCount = result.accountCount,
                instrumentCount = result.instrumentCount,
                targetCount = result.targetCount,
                transactionCount = result.transactionCount,
                safetyBackupFileName = safetyBackup?.fileName
            )
            auditLogService.record(
                category = AuditEventCategory.BACKUPS,
                action = "BACKUP_RESTORED",
                entityType = "BACKUP",
                entityId = request.fileName,
                message = "Restored backup ${request.fileName} in ${request.mode.name} mode.",
                metadata = mapOf(
                    "mode" to restoreResult.mode.name,
                    "accountCount" to restoreResult.accountCount.toString(),
                    "instrumentCount" to restoreResult.instrumentCount.toString(),
                    "targetCount" to restoreResult.targetCount.toString(),
                    "transactionCount" to restoreResult.transactionCount.toString(),
                    "safetyBackupFileName" to (restoreResult.safetyBackupFileName ?: "none")
                )
            )
            restoreResult
        }

    suspend fun downloadBackup(fileName: String): PortfolioBackupDownload = operationMutex.withLock {
        val file = resolveBackupFile(fileName)
        PortfolioBackupDownload(
            fileName = file.fileName.toString(),
            content = Files.readString(file)
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

    private fun pruneOldBackups(): List<String> {
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
                .skip(config.retentionCount.toLong())
                .map { path ->
                    path.fileName.toString().also { Files.deleteIfExists(path) }
                }
                .toList()
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
                targetCount = snapshot.targets.size,
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
                targetCount = null,
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
    val targetCount: Int?,
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
    val targetCount: Int,
    val transactionCount: Int,
    val safetyBackupFileName: String? = null
)

data class PortfolioBackupDownload(
    val fileName: String,
    val content: String
)

enum class BackupTrigger {
    MANUAL,
    SCHEDULED,
    PRE_RESTORE_REPLACE,
    PRE_IMPORT_REPLACE
}

@Serializable
private data class StoredPortfolioSnapshot(
    val schemaVersion: Int,
    val exportedAt: String,
    val accounts: List<AccountSnapshot>,
    val instruments: List<InstrumentSnapshot>,
    val targets: List<PortfolioTargetSnapshot> = emptyList(),
    val transactions: List<TransactionSnapshot>
)

private fun PortfolioSnapshot.toStored(): StoredPortfolioSnapshot = StoredPortfolioSnapshot(
    schemaVersion = schemaVersion,
    exportedAt = exportedAt.toString(),
    accounts = accounts,
    instruments = instruments,
    targets = targets,
    transactions = transactions
)

private fun StoredPortfolioSnapshot.toDomain(): PortfolioSnapshot = PortfolioSnapshot(
    schemaVersion = schemaVersion,
    exportedAt = Instant.parse(exportedAt),
    accounts = accounts,
    instruments = instruments,
    targets = targets,
    transactions = transactions
)
