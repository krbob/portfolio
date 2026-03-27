package net.bobinski.portfolio.api.domain.service

import java.time.Clock
import java.time.Instant
import kotlinx.serialization.KSerializer
import kotlinx.serialization.json.Json
import net.bobinski.portfolio.api.domain.model.AppPreference
import net.bobinski.portfolio.api.domain.repository.AppPreferenceRepository

class AppPreferenceService(
    private val repository: AppPreferenceRepository,
    private val json: Json,
    private val clock: Clock
) {
    suspend fun <T> get(
        key: String,
        serializer: KSerializer<T>,
        defaultValue: () -> T
    ): T {
        val preference = repository.get(key) ?: return defaultValue()
        return runCatching {
            json.decodeFromString(serializer, preference.valueJson)
        }.getOrElse {
            defaultValue()
        }
    }

    suspend fun <T> getOrNull(
        key: String,
        serializer: KSerializer<T>
    ): T? {
        val preference = repository.get(key) ?: return null
        return runCatching {
            json.decodeFromString(serializer, preference.valueJson)
        }.getOrNull()
    }

    suspend fun <T> put(
        key: String,
        serializer: KSerializer<T>,
        value: T
    ): T {
        repository.save(
            AppPreference(
                key = key,
                valueJson = json.encodeToString(serializer, value),
                updatedAt = Instant.now(clock)
            )
        )
        return value
    }

    suspend fun listByPrefix(prefix: String): List<AppPreference> =
        repository.list().filter { preference -> preference.key.startsWith(prefix) }

    suspend fun delete(key: String): Boolean = repository.delete(key)
}
