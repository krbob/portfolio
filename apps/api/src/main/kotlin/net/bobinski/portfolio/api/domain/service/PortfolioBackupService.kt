package net.bobinski.portfolio.api.domain.service

import java.nio.file.Files
import java.nio.file.Path
import java.security.MessageDigest
import java.time.Clock
import java.time.Duration
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
    private val transactionRunner: PersistenceTransactionRunner,
    private val changeStateRepository: BackupChangeStateRepository,
    private val auditLogService: AuditLogService,
    private val json: Json,
    private val clock: Clock,
    private val backupFileInspectionObserver: (Path) -> Unit = {}
) {
    private val operationMutex = Mutex()
    private val backupFileWriter = AtomicBackupFileWriter()

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
        val backups = listBackupsUnlocked()
        val changeState = reconcileChangeState(backupsForReconciliation = backups)
        PortfolioBackupStatus(
            schedulerEnabled = config.enabled,
            directory = backupDirectory().toString(),
            intervalMinutes = config.intervalMinutes,
            retentionCount = config.retentionCount,
            postChangeEnabled = config.enabled && config.postChangeEnabled,
            postChangeDebounceSeconds = config.postChangeDebounceSeconds,
            postChangeMaxDelaySeconds = config.postChangeMaxDelaySeconds,
            postChangeRetentionCount = config.postChangeRetentionCount,
            safetyRetentionDays = config.safetyRetentionDays,
            hasUnprotectedChanges = changeState.hasUnprotectedChanges,
            pendingSince = changeState.dirtySince.takeIf { changeState.hasUnprotectedChanges },
            nextPostChangeBackupAt = pendingBackupDueAt(changeState)
                .takeIf { config.enabled && config.postChangeEnabled },
            running = running,
            lastRunAt = lastRunAt,
            lastSuccessAt = lastSuccessAt ?: changeState.checkpointedAt,
            lastFailureAt = lastFailureAt,
            lastFailureMessage = lastFailureMessage,
            backups = backups
        )
    }

    suspend fun createBackup(trigger: BackupTrigger = BackupTrigger.MANUAL): PortfolioBackupRecord =
        operationMutex.withLock {
            createBackupUnlocked(trigger)
        }

    private suspend fun createBackupUnlocked(
        trigger: BackupTrigger,
        capturedBackup: CapturedBackup? = null,
        protectedFileNames: Set<String> = emptySet()
    ): PortfolioBackupRecord {
        running = true
        val startedAt = Instant.now(clock)
        lastRunAt = startedAt

        try {
            val captured = capturedBackup ?: captureBackup()
            val file = backupDirectory().resolve(fileNameFor(captured.snapshot.exportedAt, trigger))

            backupFileWriter.write(
                target = file,
                content = json.encodeToString(StoredPortfolioSnapshot.serializer(), captured.snapshot)
            )

            val backup = inspectBackupFile(file)
            check(backup.isReadable) {
                "Created backup ${backup.fileName} cannot be read: ${backup.errorMessage ?: "unknown error"}"
            }
            val checkpoint = changeStateRepository.checkpoint(
                revision = captured.revision,
                fileName = backup.fileName,
                fileSha256 = fileSha256(file),
                checkpointedAt = startedAt
            )
            val prunedBackups = pruneOldBackups(
                protectedFileNames + backup.fileName + listOfNotNull(checkpoint.checkpointFileName)
            )
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
                    "retentionClass" to backup.retentionClass.name,
                    "revision" to captured.revision.toString(),
                    "appPreferenceCount" to (backup.appPreferenceCount?.toString() ?: "n/a"),
                    "importProfileCount" to (backup.importProfileCount?.toString() ?: "n/a"),
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
                        "scheduledRetentionCount" to config.retentionCount.toString(),
                        "postChangeRetentionCount" to config.postChangeRetentionCount.toString(),
                        "safetyRetentionDays" to config.safetyRetentionDays.toString()
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
                createBackupUnlocked(
                    trigger = BackupTrigger.PRE_RESTORE_REPLACE,
                    protectedFileNames = setOf(request.fileName)
                )
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
                appPreferenceCount = result.appPreferenceCount,
                instrumentCount = result.instrumentCount,
                targetCount = result.targetCount,
                transactionCount = result.transactionCount,
                importProfileCount = result.importProfileCount,
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
                    "appPreferenceCount" to restoreResult.appPreferenceCount.toString(),
                    "instrumentCount" to restoreResult.instrumentCount.toString(),
                    "targetCount" to restoreResult.targetCount.toString(),
                    "transactionCount" to restoreResult.transactionCount.toString(),
                    "importProfileCount" to restoreResult.importProfileCount.toString(),
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

    suspend fun runScheduledBackup(): PortfolioBackupRecord? = operationMutex.withLock {
        val backups = listBackupsUnlocked()
        reconcileChangeState(backupsForReconciliation = backups)
        val latestBackup = backups.firstOrNull { backup ->
            backup.isReadable &&
                backup.retentionClass == BackupRetentionClass.PERIODIC &&
                (backup.trigger == BackupTrigger.SCHEDULED || backup.trigger == null)
        }
        if (latestBackup != null) {
            val age = Duration.between(latestBackup.createdAt, clock.instant())
            if (age < Duration.ofMinutes(config.intervalMinutes)) {
                return@withLock null
            }
        }
        createBackupUnlocked(BackupTrigger.SCHEDULED)
    }

    suspend fun runPostChangeBackupCheck(): PortfolioBackupRecord? = operationMutex.withLock {
        if (!config.enabled || !config.postChangeEnabled) {
            return@withLock null
        }

        val changeState = reconcileChangeState()
        if (!changeState.hasUnprotectedChanges) {
            return@withLock null
        }

        val dueAt = pendingBackupDueAt(changeState) ?: return@withLock null
        if (Instant.now(clock).isBefore(dueAt)) {
            return@withLock null
        }

        createBackupUnlocked(trigger = BackupTrigger.POST_CHANGE)
    }

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

    private fun pruneOldBackups(protectedFileNames: Set<String>): List<String> {
        val directory = backupDirectory()
        if (!Files.exists(directory)) {
            return emptyList()
        }

        val files = backupPathsNewestFirst().map { path -> BackupFile(path, inspectBackupFile(path)) }
        val candidates = buildSet {
            addAll(retentionOverflow(files, BackupRetentionClass.PERIODIC, config.retentionCount))
            addAll(retentionOverflow(files, BackupRetentionClass.POST_CHANGE, config.postChangeRetentionCount))
            addAll(files.filter { file ->
                file.record.retentionClass == BackupRetentionClass.SAFETY &&
                    safetyRetentionExpired(file.record)
            })
        }

        return candidates
            .filterNot { file -> file.record.fileName in protectedFileNames }
            .mapNotNull { file ->
                file.record.fileName.takeIf { Files.deleteIfExists(file.path) }
            }
    }

    private fun inspectBackupFile(path: Path): PortfolioBackupRecord {
        backupFileInspectionObserver(path)
        val fileName = path.fileName.toString()
        val trigger = BackupTrigger.fromFileName(fileName)
        val retentionClass = BackupRetentionClass.fromFileName(fileName, trigger)
        val sizeBytes = Files.size(path)
        val createdAt = runCatching {
            Instant.ofEpochMilli(Files.getLastModifiedTime(path).toMillis())
        }.getOrElse {
            Instant.now(clock)
        }

        return runCatching {
            val snapshot = readBackupSnapshot(path.fileName.toString())
            PortfolioBackupRecord(
                fileName = fileName,
                trigger = trigger,
                retentionClass = retentionClass,
                createdAt = createdAt,
                exportedAt = Instant.parse(snapshot.exportedAt),
                sizeBytes = sizeBytes,
                schemaVersion = snapshot.schemaVersion,
                accountCount = snapshot.accounts.size,
                appPreferenceCount = snapshot.appPreferences.count { preference ->
                    !OperationalStateKeys.isLegacyPreference(preference.key)
                },
                instrumentCount = snapshot.instruments.size,
                targetCount = snapshot.targetSchedule
                    ?.sumOf { phase -> phase.targets.size }
                    ?: snapshot.targets.orEmpty().size,
                transactionCount = snapshot.transactions.size,
                importProfileCount = snapshot.importProfiles.size,
                isReadable = true,
                errorMessage = null
            )
        }.getOrElse { exception ->
            PortfolioBackupRecord(
                fileName = fileName,
                trigger = trigger,
                retentionClass = retentionClass,
                createdAt = createdAt,
                exportedAt = null,
                sizeBytes = sizeBytes,
                schemaVersion = null,
                accountCount = null,
                appPreferenceCount = null,
                instrumentCount = null,
                targetCount = null,
                transactionCount = null,
                importProfileCount = null,
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
        require(resolved.startsWith(backupDirectory())) { "Backup file name is not valid." }
        if (!Files.exists(resolved) || !Files.isRegularFile(resolved)) {
            throw ResourceNotFoundException("Backup $fileName was not found.")
        }

        return resolved
    }

    private fun backupDirectory(): Path = Path.of(config.directory)
        .toAbsolutePath()
        .normalize()
        .also { path -> Files.createDirectories(path) }

    private fun fileNameFor(exportedAt: String, trigger: BackupTrigger): String =
        "portfolio-backup-${trigger.fileToken}-${BACKUP_FILE_NAME_FORMAT.format(Instant.parse(exportedAt))}.json"

    private fun backupPathsNewestFirst(): List<Path> {
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
                .toList()
        }
    }

    private suspend fun captureBackup(): CapturedBackup = transactionRunner.inTransaction {
        val revision = changeStateRepository.get().currentRevision
        CapturedBackup(
            revision = revision,
            snapshot = transferService.exportState().toStored()
        )
    }

    private suspend fun reconcileChangeState(
        backupsForReconciliation: List<PortfolioBackupRecord>? = null
    ): BackupChangeState {
        val state = changeStateRepository.get()
        if (state.reconciliationRequired) {
            return reconcileExistingBackups(backupsForReconciliation ?: listBackupsUnlocked())
        }
        if (state.hasUnprotectedChanges) {
            return state
        }
        if (!checkpointFileIsIntact(state)) {
            return changeStateRepository.markUnprotected(Instant.now(clock))
        }
        return state
    }

    private suspend fun reconcileExistingBackups(
        backups: List<PortfolioBackupRecord>
    ): BackupChangeState {
        val captured = captureBackup()
        val latestReadable = backups.firstOrNull(PortfolioBackupRecord::isReadable)
        val existingBackup = latestReadable?.let { backup ->
            runCatching { readHashedBackupSnapshot(backup.fileName) }.getOrNull()
        }
        val matchesLatest = existingBackup?.snapshot?.let { snapshot ->
            captured.snapshot.canonicalFingerprint() == snapshot.canonicalFingerprint()
        } ?: false

        return if (matchesLatest) {
            changeStateRepository.checkpoint(
                revision = captured.revision,
                fileName = requireNotNull(latestReadable).fileName,
                fileSha256 = requireNotNull(existingBackup).sha256,
                checkpointedAt = latestReadable.exportedAt ?: latestReadable.createdAt
            )
        } else {
            changeStateRepository.markUnprotected(Instant.now(clock))
        }
    }

    private fun checkpointFileIsIntact(state: BackupChangeState): Boolean {
        if (state.checkpointRevision == null) {
            return true
        }
        if (
            state.checkpointRevision == 0L &&
            state.checkpointFileName == null &&
            state.checkpointFileSha256 == null
        ) {
            return true
        }
        val fileName = state.checkpointFileName ?: return false
        val expectedSha256 = state.checkpointFileSha256 ?: return false
        return runCatching {
            fileSha256(resolveBackupFile(fileName)) == expectedSha256
        }.getOrDefault(false)
    }

    private fun readHashedBackupSnapshot(fileName: String): HashedBackupSnapshot {
        val bytes = Files.readAllBytes(resolveBackupFile(fileName))
        return HashedBackupSnapshot(
            snapshot = json.decodeFromString(
                StoredPortfolioSnapshot.serializer(),
                bytes.toString(Charsets.UTF_8)
            ),
            sha256 = sha256(bytes)
        )
    }

    private fun fileSha256(path: Path): String {
        val digest = MessageDigest.getInstance("SHA-256")
        Files.newInputStream(path).use { input ->
            val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
            while (true) {
                val bytesRead = input.read(buffer)
                if (bytesRead < 0) {
                    break
                }
                digest.update(buffer, 0, bytesRead)
            }
        }
        return digest.digest().toHexString()
    }

    private fun StoredPortfolioSnapshot.canonicalFingerprint(): String {
        val canonicalJson = json.encodeToString(
            StoredPortfolioSnapshot.serializer(),
            copy(exportedAt = FINGERPRINT_EXPORTED_AT)
        )
        return sha256(canonicalJson.toByteArray(Charsets.UTF_8))
    }

    private fun sha256(bytes: ByteArray): String = MessageDigest.getInstance("SHA-256")
        .digest(bytes)
        .toHexString()

    private fun ByteArray.toHexString(): String = joinToString(separator = "") { byte ->
        (byte.toInt() and 0xff).toString(16).padStart(length = 2, padChar = '0')
    }

    private fun pendingBackupDueAt(state: BackupChangeState): Instant? {
        if (!state.hasUnprotectedChanges) {
            return null
        }
        val firstSeenAt = state.dirtySince ?: state.lastChangedAt ?: return Instant.now(clock)
        val lastChangedAt = state.lastChangedAt ?: firstSeenAt
        val debounceAt = lastChangedAt.plusSeconds(config.postChangeDebounceSeconds)
        val maximumDelayAt = firstSeenAt.plusSeconds(config.postChangeMaxDelaySeconds)
        return minOf(debounceAt, maximumDelayAt)
    }

    private fun retentionOverflow(
        files: List<BackupFile>,
        retentionClass: BackupRetentionClass,
        retentionCount: Int
    ): List<BackupFile> {
        val lane = files.filter { file -> file.record.retentionClass == retentionClass }
        return lane.filter { file -> file.record.isReadable }.drop(retentionCount) +
            lane.filterNot { file -> file.record.isReadable }.drop(retentionCount)
    }

    private fun safetyRetentionExpired(record: PortfolioBackupRecord): Boolean =
        Duration.between(record.createdAt, Instant.now(clock)) >= Duration.ofDays(config.safetyRetentionDays)

    private companion object {
        val BACKUP_FILE_NAME_FORMAT: DateTimeFormatter =
            DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmssSSS'Z'").withZone(ZoneOffset.UTC)
        val BACKUP_FILE_NAME_PATTERN = Regex("[A-Za-z0-9._-]+")
        const val FINGERPRINT_EXPORTED_AT = "1970-01-01T00:00:00Z"
    }
}

private data class BackupFile(
    val path: Path,
    val record: PortfolioBackupRecord
)

private data class CapturedBackup(
    val revision: Long,
    val snapshot: StoredPortfolioSnapshot
)

private data class HashedBackupSnapshot(
    val snapshot: StoredPortfolioSnapshot,
    val sha256: String
)

data class PortfolioBackupStatus(
    val schedulerEnabled: Boolean,
    val directory: String,
    val intervalMinutes: Long,
    val retentionCount: Int,
    val postChangeEnabled: Boolean,
    val postChangeDebounceSeconds: Long,
    val postChangeMaxDelaySeconds: Long,
    val postChangeRetentionCount: Int,
    val safetyRetentionDays: Long,
    val hasUnprotectedChanges: Boolean,
    val pendingSince: Instant?,
    val nextPostChangeBackupAt: Instant?,
    val running: Boolean,
    val lastRunAt: Instant?,
    val lastSuccessAt: Instant?,
    val lastFailureAt: Instant?,
    val lastFailureMessage: String?,
    val backups: List<PortfolioBackupRecord>
)

data class PortfolioBackupRecord(
    val fileName: String,
    val trigger: BackupTrigger?,
    val retentionClass: BackupRetentionClass,
    val createdAt: Instant,
    val exportedAt: Instant?,
    val sizeBytes: Long,
    val schemaVersion: Int?,
    val accountCount: Int?,
    val appPreferenceCount: Int?,
    val instrumentCount: Int?,
    val targetCount: Int?,
    val transactionCount: Int?,
    val importProfileCount: Int?,
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
    val appPreferenceCount: Int,
    val instrumentCount: Int,
    val targetCount: Int,
    val transactionCount: Int,
    val importProfileCount: Int,
    val safetyBackupFileName: String? = null
)

data class PortfolioBackupDownload(
    val fileName: String,
    val content: String
)

enum class BackupTrigger {
    MANUAL,
    SCHEDULED,
    POST_CHANGE,
    PRE_RESTORE_REPLACE,
    PRE_IMPORT_REPLACE;

    val fileToken: String
        get() = name.lowercase().replace('_', '-')

    val isSafety: Boolean
        get() = this == PRE_RESTORE_REPLACE || this == PRE_IMPORT_REPLACE

    companion object {
        fun fromFileName(fileName: String): BackupTrigger? = entries.firstOrNull { trigger ->
            Regex(
                "^portfolio-backup-${Regex.escape(trigger.fileToken)}-$BACKUP_TIMESTAMP_PATTERN\\.json$"
            ).matches(fileName)
        }
    }
}

enum class BackupRetentionClass {
    PERIODIC,
    POST_CHANGE,
    SAFETY,
    UNMANAGED;

    companion object {
        fun fromFileName(fileName: String, trigger: BackupTrigger?): BackupRetentionClass = when {
            trigger == BackupTrigger.POST_CHANGE -> POST_CHANGE
            trigger?.isSafety == true -> SAFETY
            trigger == BackupTrigger.MANUAL || trigger == BackupTrigger.SCHEDULED -> PERIODIC
            LEGACY_BACKUP_FILE_PATTERN.matches(fileName) -> PERIODIC
            else -> UNMANAGED
        }
    }
}

private const val BACKUP_TIMESTAMP_PATTERN = "\\d{8}T\\d{9}Z"
private val LEGACY_BACKUP_FILE_PATTERN = Regex("^portfolio-backup-$BACKUP_TIMESTAMP_PATTERN\\.json$")

@Serializable
private data class StoredPortfolioSnapshot(
    val schemaVersion: Int,
    val exportedAt: String,
    val accounts: List<AccountSnapshot>,
    val appPreferences: List<AppPreferenceSnapshot> = emptyList(),
    val instruments: List<InstrumentSnapshot>,
    val targets: List<PortfolioTargetSnapshot>? = null,
    val targetSchedule: List<PortfolioTargetPhaseSnapshot>? = null,
    val importProfiles: List<TransactionImportProfileSnapshot> = emptyList(),
    val transactions: List<TransactionSnapshot>
)

private fun PortfolioSnapshot.toStored(): StoredPortfolioSnapshot = StoredPortfolioSnapshot(
    schemaVersion = schemaVersion,
    exportedAt = exportedAt.toString(),
    accounts = accounts,
    appPreferences = appPreferences.filterNot { preference ->
        OperationalStateKeys.isLegacyPreference(preference.key)
    },
    instruments = instruments,
    targets = targets,
    targetSchedule = targetSchedule,
    importProfiles = importProfiles,
    transactions = transactions
)

private fun StoredPortfolioSnapshot.toDomain(): PortfolioSnapshot = PortfolioSnapshot(
    schemaVersion = schemaVersion,
    exportedAt = Instant.parse(exportedAt),
    accounts = accounts,
    appPreferences = appPreferences.filterNot { preference ->
        OperationalStateKeys.isLegacyPreference(preference.key)
    },
    instruments = instruments,
    targets = targets.orEmpty(),
    targetsSectionPresent = targets != null,
    targetSchedule = targetSchedule.orEmpty(),
    targetScheduleSectionPresent = targetSchedule != null,
    importProfiles = importProfiles,
    transactions = transactions
)
