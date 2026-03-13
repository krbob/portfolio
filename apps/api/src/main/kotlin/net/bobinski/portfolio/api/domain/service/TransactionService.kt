package net.bobinski.portfolio.api.domain.service

import net.bobinski.portfolio.api.domain.error.ResourceNotFoundException
import net.bobinski.portfolio.api.domain.model.Transaction
import net.bobinski.portfolio.api.domain.model.TransactionType
import net.bobinski.portfolio.api.domain.repository.AccountRepository
import net.bobinski.portfolio.api.domain.repository.InstrumentRepository
import net.bobinski.portfolio.api.domain.repository.TransactionRepository
import java.math.BigDecimal
import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.util.UUID

class TransactionService(
    private val transactionRepository: TransactionRepository,
    private val accountRepository: AccountRepository,
    private val instrumentRepository: InstrumentRepository,
    private val clock: Clock
) {
    suspend fun list(): List<Transaction> = transactionRepository.list()

    suspend fun create(command: CreateTransactionCommand): Transaction {
        validateReferences(command)
        return saveNew(command, Instant.now(clock))
    }

    suspend fun importAll(commands: List<CreateTransactionCommand>): List<Transaction> {
        require(commands.isNotEmpty()) { "Import requires at least one transaction row." }
        commands.forEach { validateReferences(it) }

        val baseTimestamp = Instant.now(clock)
        return commands.mapIndexed { index, command ->
            saveNew(command, baseTimestamp.plusMillis(index.toLong()))
        }
    }

    suspend fun update(id: UUID, command: CreateTransactionCommand): Transaction {
        val existing = transactionRepository.get(id)
            ?: throw ResourceNotFoundException("Transaction $id was not found.")
        validateReferences(command)

        return transactionRepository.save(
            Transaction(
                id = existing.id,
                accountId = command.accountId,
                instrumentId = command.instrumentId,
                type = command.type,
                tradeDate = command.tradeDate,
                settlementDate = command.settlementDate,
                quantity = command.quantity,
                unitPrice = command.unitPrice,
                grossAmount = command.grossAmount,
                feeAmount = command.feeAmount,
                taxAmount = command.taxAmount,
                currency = command.currency.uppercase(),
                fxRateToPln = command.fxRateToPln,
                notes = command.notes.trim(),
                createdAt = existing.createdAt,
                updatedAt = Instant.now(clock)
            )
        )
    }

    suspend fun delete(id: UUID) {
        if (!transactionRepository.delete(id)) {
            throw ResourceNotFoundException("Transaction $id was not found.")
        }
    }

    private suspend fun validateReferences(command: CreateTransactionCommand) {
        val account = accountRepository.get(command.accountId)
            ?: throw ResourceNotFoundException("Account ${command.accountId} was not found.")

        if (!account.isActive) {
            throw IllegalArgumentException("Transactions cannot target inactive accounts.")
        }

        command.instrumentId?.let { instrumentId ->
            instrumentRepository.get(instrumentId)
                ?: throw ResourceNotFoundException("Instrument $instrumentId was not found.")
        }
    }

    private suspend fun saveNew(command: CreateTransactionCommand, timestamp: Instant): Transaction =
        transactionRepository.save(
            Transaction(
                id = UUID.randomUUID(),
                accountId = command.accountId,
                instrumentId = command.instrumentId,
                type = command.type,
                tradeDate = command.tradeDate,
                settlementDate = command.settlementDate,
                quantity = command.quantity,
                unitPrice = command.unitPrice,
                grossAmount = command.grossAmount,
                feeAmount = command.feeAmount,
                taxAmount = command.taxAmount,
                currency = command.currency.uppercase(),
                fxRateToPln = command.fxRateToPln,
                notes = command.notes.trim(),
                createdAt = timestamp,
                updatedAt = timestamp
            )
        )
}

data class CreateTransactionCommand(
    val accountId: UUID,
    val instrumentId: UUID?,
    val type: TransactionType,
    val tradeDate: LocalDate,
    val settlementDate: LocalDate?,
    val quantity: BigDecimal?,
    val unitPrice: BigDecimal?,
    val grossAmount: BigDecimal,
    val feeAmount: BigDecimal,
    val taxAmount: BigDecimal,
    val currency: String,
    val fxRateToPln: BigDecimal?,
    val notes: String
)
