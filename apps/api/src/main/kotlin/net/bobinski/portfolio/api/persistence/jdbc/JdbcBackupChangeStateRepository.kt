package net.bobinski.portfolio.api.persistence.jdbc

import java.sql.ResultSet
import java.time.Instant
import net.bobinski.portfolio.api.domain.service.BackupChangeState
import net.bobinski.portfolio.api.domain.service.BackupChangeStateRepository

class JdbcBackupChangeStateRepository(
    private val connectionManager: JdbcConnectionManager
) : BackupChangeStateRepository {
    override suspend fun get(): BackupChangeState = connectionManager.withConnection { connection ->
        connection.prepareStatement(
            """
            select current_revision, checkpoint_revision, dirty_since, last_changed_at,
                   checkpointed_at, checkpoint_file_name, checkpoint_file_sha256,
                   reconciliation_required
            from backup_change_state
            where singleton_id = 1
            """.trimIndent()
        ).use { statement ->
            statement.executeQuery().use { resultSet ->
                check(resultSet.next()) { "Backup change state has not been initialized." }
                resultSet.toBackupChangeState()
            }
        }
    }

    override suspend fun checkpoint(
        revision: Long,
        fileName: String,
        fileSha256: String,
        checkpointedAt: Instant
    ): BackupChangeState {
        connectionManager.withConnection { connection ->
            connection.prepareStatement(
                """
                update backup_change_state
                set checkpoint_revision = ?,
                    checkpointed_at = ?,
                    checkpoint_file_name = ?,
                    checkpoint_file_sha256 = ?,
                    dirty_since = case
                        when current_revision = ? then null
                        else coalesce(dirty_since, ?)
                    end,
                    reconciliation_required = 0
                where singleton_id = 1
                  and current_revision >= ?
                """.trimIndent()
            ).use { statement ->
                statement.setLong(1, revision)
                statement.setInstant(2, checkpointedAt)
                statement.setString(3, fileName)
                statement.setString(4, fileSha256)
                statement.setLong(5, revision)
                statement.setInstant(6, checkpointedAt)
                statement.setLong(7, revision)
                check(statement.executeUpdate() == 1) {
                    "Cannot checkpoint backup revision $revision."
                }
            }
        }
        return get()
    }

    override suspend fun markUnprotected(reconciledAt: Instant): BackupChangeState {
        connectionManager.withConnection { connection ->
            connection.prepareStatement(
                """
                update backup_change_state
                set checkpoint_revision = null,
                    checkpointed_at = null,
                    checkpoint_file_name = null,
                    checkpoint_file_sha256 = null,
                    dirty_since = case
                        when current_revision > 0 then coalesce(dirty_since, ?)
                        else null
                    end,
                    last_changed_at = case
                        when current_revision > 0 then coalesce(last_changed_at, ?)
                        else null
                    end,
                    reconciliation_required = 0
                where singleton_id = 1
                """.trimIndent()
            ).use { statement ->
                statement.setInstant(1, reconciledAt)
                statement.setInstant(2, reconciledAt)
                check(statement.executeUpdate() == 1) {
                    "Cannot mark the portfolio backup state as unprotected."
                }
            }
        }
        return get()
    }

    private fun ResultSet.toBackupChangeState(): BackupChangeState = BackupChangeState(
        currentRevision = getLong("current_revision"),
        checkpointRevision = getLongOrNull("checkpoint_revision"),
        dirtySince = instantOrNull("dirty_since"),
        lastChangedAt = instantOrNull("last_changed_at"),
        checkpointedAt = instantOrNull("checkpointed_at"),
        checkpointFileName = getString("checkpoint_file_name"),
        checkpointFileSha256 = getString("checkpoint_file_sha256"),
        reconciliationRequired = booleanFromInteger("reconciliation_required")
    )

    private fun ResultSet.getLongOrNull(column: String): Long? =
        getLong(column).takeUnless { wasNull() }
}
