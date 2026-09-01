package net.bobinski.portfolio.api.domain.service

import java.time.Instant

data class BackupChangeState(
    val currentRevision: Long,
    val checkpointRevision: Long?,
    val dirtySince: Instant?,
    val lastChangedAt: Instant?,
    val checkpointedAt: Instant?,
    val checkpointFileName: String?,
    val checkpointFileSha256: String?,
    val reconciliationRequired: Boolean
) {
    val hasUnprotectedChanges: Boolean
        get() = currentRevision > (checkpointRevision ?: 0L)
}

interface BackupChangeStateRepository {
    suspend fun get(): BackupChangeState

    suspend fun checkpoint(
        revision: Long,
        fileName: String,
        fileSha256: String,
        checkpointedAt: Instant
    ): BackupChangeState

    suspend fun markUnprotected(reconciledAt: Instant): BackupChangeState
}
