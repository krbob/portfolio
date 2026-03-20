package net.bobinski.portfolio.api.persistence.inmemory

import java.util.concurrent.atomic.AtomicReference
import net.bobinski.portfolio.api.domain.repository.ReadModelCacheRepository
import net.bobinski.portfolio.api.domain.service.ReadModelCacheSnapshot

class InMemoryReadModelCacheRepository : ReadModelCacheRepository {
    private val state = AtomicReference<Map<String, ReadModelCacheSnapshot>>(emptyMap())

    override suspend fun get(cacheKey: String): ReadModelCacheSnapshot? = state.get()[cacheKey]

    override suspend fun list(): List<ReadModelCacheSnapshot> = state.get().values.toList()

    override suspend fun save(snapshot: ReadModelCacheSnapshot) {
        state.updateAndGet { current -> current + (snapshot.cacheKey to snapshot) }
    }

    override suspend fun clearAll(): Int {
        val previous = state.getAndSet(emptyMap())
        return previous.size
    }
}
