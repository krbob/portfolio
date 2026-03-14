package net.bobinski.portfolio.api.domain.repository

import java.util.UUID
import net.bobinski.portfolio.api.domain.model.TransactionImportProfile

interface TransactionImportProfileRepository {
    suspend fun list(): List<TransactionImportProfile>
    suspend fun get(id: UUID): TransactionImportProfile?
    suspend fun save(profile: TransactionImportProfile): TransactionImportProfile
    suspend fun delete(id: UUID): Boolean
    suspend fun deleteAll()
}
