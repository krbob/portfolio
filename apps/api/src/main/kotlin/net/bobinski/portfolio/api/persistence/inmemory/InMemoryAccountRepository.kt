package net.bobinski.portfolio.api.persistence.inmemory

import net.bobinski.portfolio.api.domain.model.Account
import net.bobinski.portfolio.api.domain.repository.AccountRepository
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

class InMemoryAccountRepository : AccountRepository {
    private val accounts = ConcurrentHashMap<UUID, Account>()

    override suspend fun list(): List<Account> = accounts.values.sortedByDescending { it.createdAt }

    override suspend fun get(id: UUID): Account? = accounts[id]

    override suspend fun save(account: Account): Account {
        accounts[account.id] = account
        return account
    }
}
