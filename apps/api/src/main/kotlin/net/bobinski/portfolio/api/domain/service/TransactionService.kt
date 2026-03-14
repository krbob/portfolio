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

    suspend fun previewImport(commands: List<CreateTransactionCommand>): TransactionImportPreview =
        analyzeImport(commands)

    suspend fun importAll(
        commands: List<CreateTransactionCommand>,
        skipDuplicates: Boolean
    ): TransactionImportResult {
        val preview = analyzeImport(commands)
        require(preview.invalidRowCount == 0) {
            preview.rows.firstOrNull { it.status == TransactionImportRowStatus.INVALID }?.message
                ?: "Import contains invalid rows."
        }
        require(skipDuplicates || preview.duplicateRowCount == 0) {
            "Import contains duplicate rows. Preview the batch or enable skipDuplicates."
        }

        val baseTimestamp = Instant.now(clock)
        val transactions = preview.rows.mapIndexedNotNull { index, row ->
            if (row.status != TransactionImportRowStatus.IMPORTABLE) {
                return@mapIndexedNotNull null
            }

            saveNew(commands[index], baseTimestamp.plusMillis(index.toLong()))
        }

        return TransactionImportResult(
            createdCount = transactions.size,
            skippedDuplicateCount = preview.duplicateRowCount,
            transactions = transactions
        )
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

    private suspend fun analyzeImport(commands: List<CreateTransactionCommand>): TransactionImportPreview {
        require(commands.isNotEmpty()) { "Import requires at least one transaction row." }

        val existingKeys = transactionRepository.list()
            .map { transaction -> transaction.toFingerprint() }
            .toSet()
        val seenBatchKeys = linkedSetOf<TransactionFingerprint>()
        val rows = commands.mapIndexed { index, command ->
            val validationError = validateImportRow(command)
            val statusAndMessage = when {
                validationError != null -> TransactionImportRowStatus.INVALID to validationError
                command.toFingerprint() in existingKeys ->
                    TransactionImportRowStatus.DUPLICATE_EXISTING to "Already present in the transaction journal."

                !seenBatchKeys.add(command.toFingerprint()) ->
                    TransactionImportRowStatus.DUPLICATE_BATCH to "Duplicate of an earlier row in the same batch."

                else -> TransactionImportRowStatus.IMPORTABLE to "Ready to import."
            }

            TransactionImportPreviewRow(
                rowNumber = index + 1,
                status = statusAndMessage.first,
                message = statusAndMessage.second
            )
        }

        return TransactionImportPreview(
            totalRowCount = rows.size,
            importableRowCount = rows.count { it.status == TransactionImportRowStatus.IMPORTABLE },
            duplicateRowCount = rows.count {
                it.status == TransactionImportRowStatus.DUPLICATE_EXISTING ||
                    it.status == TransactionImportRowStatus.DUPLICATE_BATCH
            },
            invalidRowCount = rows.count { it.status == TransactionImportRowStatus.INVALID },
            rows = rows
        )
    }

    private suspend fun validateImportRow(command: CreateTransactionCommand): String? = try {
        validateReferences(command)
        null
    } catch (exception: IllegalArgumentException) {
        exception.message ?: "Row validation failed."
    } catch (exception: ResourceNotFoundException) {
        exception.message ?: "Referenced resource was not found."
    }

    private fun Transaction.toFingerprint(): TransactionFingerprint = TransactionFingerprint(
        accountId = accountId,
        instrumentId = instrumentId,
        type = type,
        tradeDate = tradeDate,
        settlementDate = settlementDate,
        quantity = quantity?.normalized(),
        unitPrice = unitPrice?.normalized(),
        grossAmount = grossAmount.normalized(),
        feeAmount = feeAmount.normalized(),
        taxAmount = taxAmount.normalized(),
        currency = currency.uppercase(),
        fxRateToPln = fxRateToPln?.normalized(),
        notes = notes.trim()
    )

    private fun CreateTransactionCommand.toFingerprint(): TransactionFingerprint = TransactionFingerprint(
        accountId = accountId,
        instrumentId = instrumentId,
        type = type,
        tradeDate = tradeDate,
        settlementDate = settlementDate,
        quantity = quantity?.normalized(),
        unitPrice = unitPrice?.normalized(),
        grossAmount = grossAmount.normalized(),
        feeAmount = feeAmount.normalized(),
        taxAmount = taxAmount.normalized(),
        currency = currency.uppercase(),
        fxRateToPln = fxRateToPln?.normalized(),
        notes = notes.trim()
    )

    private fun BigDecimal.normalized(): BigDecimal = stripTrailingZeros()
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

data class TransactionImportResult(
    val createdCount: Int,
    val skippedDuplicateCount: Int,
    val transactions: List<Transaction>
)

data class TransactionImportPreview(
    val totalRowCount: Int,
    val importableRowCount: Int,
    val duplicateRowCount: Int,
    val invalidRowCount: Int,
    val rows: List<TransactionImportPreviewRow>
)

data class TransactionImportPreviewRow(
    val rowNumber: Int,
    val status: TransactionImportRowStatus,
    val message: String
)

enum class TransactionImportRowStatus {
    IMPORTABLE,
    DUPLICATE_EXISTING,
    DUPLICATE_BATCH,
    INVALID
}

private data class TransactionFingerprint(
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
