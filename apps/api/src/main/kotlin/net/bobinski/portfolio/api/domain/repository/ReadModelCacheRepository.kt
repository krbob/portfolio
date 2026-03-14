package net.bobinski.portfolio.api.domain.repository

import net.bobinski.portfolio.api.domain.service.ReadModelCacheSnapshot

interface ReadModelCacheRepository {
    suspend fun get(cacheKey: String): ReadModelCacheSnapshot?
    suspend fun list(): List<ReadModelCacheSnapshot>
    suspend fun save(snapshot: ReadModelCacheSnapshot)
}
