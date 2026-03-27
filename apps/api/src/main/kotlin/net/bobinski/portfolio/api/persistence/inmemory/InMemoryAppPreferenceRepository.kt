package net.bobinski.portfolio.api.persistence.inmemory

import java.util.concurrent.atomic.AtomicReference
import net.bobinski.portfolio.api.domain.model.AppPreference
import net.bobinski.portfolio.api.domain.repository.AppPreferenceRepository

class InMemoryAppPreferenceRepository : AppPreferenceRepository {
    private val state = AtomicReference<Map<String, AppPreference>>(emptyMap())

    override suspend fun get(key: String): AppPreference? = state.get()[key]

    override suspend fun list(): List<AppPreference> = state.get()
        .values
        .sortedBy(AppPreference::key)

    override suspend fun listByPrefix(prefix: String): List<AppPreference> = state.get()
        .values
        .filter { preference -> preference.key.startsWith(prefix) }
        .sortedBy(AppPreference::key)

    override suspend fun save(preference: AppPreference): AppPreference {
        state.updateAndGet { current ->
            current + (preference.key to preference)
        }
        return preference
    }

    override suspend fun delete(key: String): Boolean {
        var deleted = false
        state.updateAndGet { current ->
            if (current.containsKey(key)) {
                deleted = true
            }
            current - key
        }
        return deleted
    }

    override suspend fun deleteAll() {
        state.set(emptyMap())
    }
}
