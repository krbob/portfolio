package net.bobinski.portfolio.api.domain.repository

import net.bobinski.portfolio.api.domain.model.Account
import java.util.UUID

interface AccountRepository {
    suspend fun list(): List<Account>
    suspend fun get(id: UUID): Account?
    suspend fun save(account: Account): Account
}
