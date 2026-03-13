package net.bobinski.portfolio.api.domain.repository

import net.bobinski.portfolio.api.domain.model.Transaction
import java.util.UUID

interface TransactionRepository {
    suspend fun list(): List<Transaction>
    suspend fun get(id: UUID): Transaction?
    suspend fun save(transaction: Transaction): Transaction
}
