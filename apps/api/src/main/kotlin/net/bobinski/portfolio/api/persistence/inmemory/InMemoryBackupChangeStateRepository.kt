package net.bobinski.portfolio.api.persistence.inmemory

import java.time.Instant
import java.util.concurrent.atomic.AtomicReference
import net.bobinski.portfolio.api.domain.service.BackupChangeState
import net.bobinski.portfolio.api.domain.service.BackupChangeStateRepository

class InMemoryBackupChangeStateRepository(
    initialState: BackupChangeState = cleanState()
) : BackupChangeStateRepository {
    private val state = AtomicReference(initialState)

    companion object {
        private val SHA_256_PATTERN = Regex("[0-9a-f]{64}")

        private fun cleanState(): BackupChangeState = BackupChangeState(
            currentRevision = 0,
            checkpointRevision = 0,
            dirtySince = null,
            lastChangedAt = null,
            checkpointedAt = null,
            checkpointFileName = null,
            checkpointFileSha256 = null,
            reconciliationRequired = false
        )
    }

    override suspend fun get(): BackupChangeState = state.get()

    override suspend fun checkpoint(
        revision: Long,
        fileName: String,
        fileSha256: String,
        checkpointedAt: Instant
    ): BackupChangeState = state.updateAndGet { current ->
        require(revision <= current.currentRevision) {
            "Cannot checkpoint backup revision $revision."
        }
        require(SHA_256_PATTERN.matches(fileSha256)) {
            "Backup checkpoint SHA-256 is not valid."
        }
        current.copy(
            checkpointRevision = revision,
            dirtySince = current.dirtySince.takeIf { current.currentRevision > revision },
            checkpointedAt = checkpointedAt,
            checkpointFileName = fileName,
            checkpointFileSha256 = fileSha256,
            reconciliationRequired = false
        )
    }

    override suspend fun markUnprotected(reconciledAt: Instant): BackupChangeState =
        state.updateAndGet { current ->
            current.copy(
                checkpointRevision = null,
                dirtySince = if (current.currentRevision > 0) current.dirtySince ?: reconciledAt else null,
                lastChangedAt = current.lastChangedAt ?: reconciledAt.takeIf { current.currentRevision > 0 },
                checkpointedAt = null,
                checkpointFileName = null,
                checkpointFileSha256 = null,
                reconciliationRequired = false
            )
        }

    internal fun recordChange(changedAt: Instant): BackupChangeState = state.updateAndGet { current ->
        current.copy(
            currentRevision = current.currentRevision + 1,
            dirtySince = current.dirtySince ?: changedAt,
            lastChangedAt = changedAt
        )
    }
}
