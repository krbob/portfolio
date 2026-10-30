package net.bobinski.portfolio.api.domain.repository

import java.time.Instant
import net.bobinski.portfolio.api.domain.model.OperationalStateEntry

interface OperationalStateRepository {
    suspend fun get(key: String): OperationalStateEntry?
    suspend fun listByPrefix(prefix: String): List<OperationalStateEntry>
    /** Lists revisions without loading potentially large JSON payloads. */
    suspend fun listRevisionsByPrefix(prefix: String): Map<String, Instant>
    suspend fun save(entry: OperationalStateEntry): OperationalStateEntry
    suspend fun saveIfAbsent(entry: OperationalStateEntry): OperationalStateEntry
    suspend fun saveIfNewer(entry: OperationalStateEntry): OperationalStateEntry
}
