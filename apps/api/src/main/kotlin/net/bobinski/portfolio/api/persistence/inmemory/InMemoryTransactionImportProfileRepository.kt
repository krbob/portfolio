package net.bobinski.portfolio.api.persistence.inmemory

import java.util.UUID
import java.util.concurrent.atomic.AtomicReference
import net.bobinski.portfolio.api.domain.model.TransactionImportProfile
import net.bobinski.portfolio.api.domain.repository.TransactionImportProfileRepository

class InMemoryTransactionImportProfileRepository : TransactionImportProfileRepository {
    private val state = AtomicReference<List<TransactionImportProfile>>(emptyList())

    override suspend fun list(): List<TransactionImportProfile> = state.get()
        .sortedBy { it.name.lowercase() }

    override suspend fun get(id: UUID): TransactionImportProfile? = state.get()
        .firstOrNull { it.id == id }

    override suspend fun save(profile: TransactionImportProfile): TransactionImportProfile {
        state.updateAndGet { current ->
            current.filterNot { it.id == profile.id } + profile
        }
        return profile
    }

    override suspend fun delete(id: UUID): Boolean {
        var deleted = false
        state.updateAndGet { current ->
            val next = current.filterNot { profile ->
                val matches = profile.id == id
                if (matches) {
                    deleted = true
                }
                matches
            }
            next
        }
        return deleted
    }

    override suspend fun deleteAll() {
        state.set(emptyList())
    }
}
