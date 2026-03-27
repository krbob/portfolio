package net.bobinski.portfolio.api.domain.service

interface PersistenceTransactionRunner {
    suspend fun <T> inTransaction(block: suspend () -> T): T
}
