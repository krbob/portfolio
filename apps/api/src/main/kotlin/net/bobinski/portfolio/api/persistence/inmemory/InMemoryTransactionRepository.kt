package net.bobinski.portfolio.api.persistence.inmemory

import net.bobinski.portfolio.api.domain.model.Transaction
import net.bobinski.portfolio.api.domain.repository.TransactionRepository
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

class InMemoryTransactionRepository : TransactionRepository {
    private val transactions = ConcurrentHashMap<UUID, Transaction>()

    override suspend fun list(): List<Transaction> = transactions.values.sortedByDescending { it.tradeDate }

    override suspend fun get(id: UUID): Transaction? = transactions[id]

    override suspend fun save(transaction: Transaction): Transaction {
        transactions[transaction.id] = transaction
        return transaction
    }
}
