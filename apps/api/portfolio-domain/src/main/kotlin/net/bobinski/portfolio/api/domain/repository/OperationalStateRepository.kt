package net.bobinski.portfolio.api.domain.repository

import net.bobinski.portfolio.api.domain.model.OperationalStateEntry

interface OperationalStateRepository {
    suspend fun get(key: String): OperationalStateEntry?
    suspend fun listByPrefix(prefix: String): List<OperationalStateEntry>
    suspend fun save(entry: OperationalStateEntry): OperationalStateEntry
    suspend fun saveIfAbsent(entry: OperationalStateEntry): OperationalStateEntry
}
