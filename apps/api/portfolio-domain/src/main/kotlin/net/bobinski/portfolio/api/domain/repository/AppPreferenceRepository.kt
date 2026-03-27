package net.bobinski.portfolio.api.domain.repository

import net.bobinski.portfolio.api.domain.model.AppPreference

interface AppPreferenceRepository {
    suspend fun get(key: String): AppPreference?
    suspend fun list(): List<AppPreference>
    suspend fun listByPrefix(prefix: String): List<AppPreference>
    suspend fun save(preference: AppPreference): AppPreference
    suspend fun delete(key: String): Boolean
    suspend fun deleteAll()
}
