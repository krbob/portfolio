package net.bobinski.portfolio.api.persistence.inmemory

import java.util.concurrent.atomic.AtomicReference
import net.bobinski.portfolio.api.domain.model.OperationalStateEntry
import net.bobinski.portfolio.api.domain.repository.OperationalStateRepository

class InMemoryOperationalStateRepository : OperationalStateRepository {
    private val state = AtomicReference<Map<String, OperationalStateEntry>>(emptyMap())

    override suspend fun get(key: String): OperationalStateEntry? = state.get()[key]

    override suspend fun listByPrefix(prefix: String): List<OperationalStateEntry> = state.get()
        .values
        .filter { entry -> entry.key.startsWith(prefix) }
        .sortedBy(OperationalStateEntry::key)

    override suspend fun save(entry: OperationalStateEntry): OperationalStateEntry {
        state.updateAndGet { current -> current + (entry.key to entry) }
        return entry
    }

    override suspend fun saveIfAbsent(entry: OperationalStateEntry): OperationalStateEntry {
        var stored = entry
        state.updateAndGet { current ->
            current[entry.key]?.let { existing ->
                stored = existing
                current
            } ?: (current + (entry.key to entry))
        }
        return stored
    }
}
