package net.bobinski.portfolio.api.domain.service

import java.time.Clock
import java.time.Instant
import kotlinx.serialization.KSerializer
import kotlinx.serialization.json.Json
import net.bobinski.portfolio.api.domain.model.AppPreference
import net.bobinski.portfolio.api.domain.model.OperationalStateEntry
import net.bobinski.portfolio.api.domain.repository.AppPreferenceRepository
import net.bobinski.portfolio.api.domain.repository.OperationalStateRepository

class OperationalStateService(
    private val repository: OperationalStateRepository,
    private val json: Json,
    private val clock: Clock,
    private val legacyPreferenceRepository: AppPreferenceRepository? = null
) {
    suspend fun <T> get(
        key: String,
        serializer: KSerializer<T>,
        defaultValue: () -> T
    ): T = getOrNull(key = key, serializer = serializer) ?: defaultValue()

    suspend fun <T> getOrNull(
        key: String,
        serializer: KSerializer<T>
    ): T? = stateEntry(key)?.let { entry -> decodeOrNull(entry, serializer) }

    suspend fun <T> put(
        key: String,
        serializer: KSerializer<T>,
        value: T
    ): T {
        repository.save(
            OperationalStateEntry(
                key = key,
                valueJson = json.encodeToString(serializer, value),
                updatedAt = Instant.now(clock)
            )
        )
        return value
    }

    suspend fun listByPrefix(prefix: String): List<OperationalStateEntry> {
        val entriesByKey = repository.listByPrefix(prefix)
            .associateByTo(mutableMapOf(), OperationalStateEntry::key)
        legacyPreferenceRepository
            ?.listByPrefix(prefix)
            .orEmpty()
            .forEach { preference ->
                val migrated = repository.saveIfNewer(preference.toOperationalStateEntry())
                entriesByKey[migrated.key] = migrated
                legacyPreferenceRepository?.deleteIfUnchanged(preference)
            }
        return entriesByKey.values.sortedBy(OperationalStateEntry::key)
    }

    fun <T> decodeOrNull(
        entry: OperationalStateEntry,
        serializer: KSerializer<T>
    ): T? = runCatching {
        json.decodeFromString(serializer, entry.valueJson)
    }.getOrNull()

    private suspend fun stateEntry(key: String): OperationalStateEntry? {
        val current = repository.get(key)
        val legacy = legacyPreferenceRepository?.get(key) ?: return current
        val migrated = repository.saveIfNewer(legacy.toOperationalStateEntry())
        legacyPreferenceRepository.deleteIfUnchanged(legacy)
        return migrated
    }

    private fun AppPreference.toOperationalStateEntry(): OperationalStateEntry = OperationalStateEntry(
        key = key,
        valueJson = valueJson,
        updatedAt = updatedAt
    )
}
