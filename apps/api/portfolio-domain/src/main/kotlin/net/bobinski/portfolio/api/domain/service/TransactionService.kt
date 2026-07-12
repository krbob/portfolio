package net.bobinski.portfolio.api.domain.service

import net.bobinski.portfolio.api.domain.error.ResourceNotFoundException
import net.bobinski.portfolio.api.domain.model.AuditEventCategory
import net.bobinski.portfolio.api.domain.model.InstrumentKind
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
    private val transactionRunner: PersistenceTransactionRunner,
    private val auditLogService: AuditLogService,
    private val clock: Clock
) {
    suspend fun list(): List<Transaction> = transactionRepository.list()
        .sortedWith(TransactionLedger.order.reversed())

    suspend fun create(command: CreateTransactionCommand): Transaction {
        val transaction = transactionRunner.inTransaction {
            validateReferences(command)
            val candidate = newTransaction(command, Instant.now(clock))
            TransactionLedger.requireLongOnly(transactionRepository.list() + candidate)
            transactionRepository.save(candidate)
        }
        auditLogService.record(
            category = AuditEventCategory.TRANSACTIONS,
            action = "TRANSACTION_CREATED",
            entityType = "TRANSACTION",
            entityId = transaction.id.toString(),
            message = "Created ${transaction.type.name} transaction.",
            metadata = transaction.auditMetadata()
        )
        return transaction
    }

    suspend fun previewImport(commands: List<CreateTransactionCommand>): TransactionImportPreview =
        transactionRunner.inTransaction {
            prepareImport(commands, Instant.now(clock)).preview
        }

    suspend fun importAll(
        commands: List<CreateTransactionCommand>,
        skipDuplicates: Boolean,
        context: TransactionImportContext? = null
    ): TransactionImportResult {
        val prepared = transactionRunner.inTransaction {
            val import = prepareImport(commands, Instant.now(clock))
            require(import.preview.invalidRowCount == 0) {
                import.preview.rows.firstOrNull { it.status == TransactionImportRowStatus.INVALID }?.message
                    ?: "Import contains invalid rows."
            }
            require(skipDuplicates || import.preview.duplicateRowCount == 0) {
                "Import contains duplicate rows. Preview the batch or enable skipDuplicates."
            }

            TransactionLedger.requireLongOnly(transactionRepository.list() + import.transactions)
            import.transactions.forEach { transaction -> transactionRepository.save(transaction) }
            import
        }

        val result = TransactionImportResult(
            createdCount = prepared.transactions.size,
            skippedDuplicateCount = prepared.preview.duplicateRowCount,
            transactions = prepared.transactions
        )
        auditLogService.record(
            category = AuditEventCategory.IMPORTS,
            action = "TRANSACTION_BATCH_IMPORTED",
            entityType = "TRANSACTION_BATCH",
            message = buildImportMessage(result, context),
            metadata = mapOf(
                "rowCount" to prepared.preview.totalRowCount.toString(),
                "createdCount" to result.createdCount.toString(),
                "skippedDuplicateCount" to result.skippedDuplicateCount.toString(),
                "invalidRowCount" to prepared.preview.invalidRowCount.toString(),
                "duplicateExistingCount" to prepared.preview.duplicateExistingCount.toString(),
                "duplicateBatchCount" to prepared.preview.duplicateBatchCount.toString()
            ) + (context?.auditMetadata() ?: emptyMap())
        )
        return result
    }

    suspend fun update(id: UUID, command: CreateTransactionCommand): Transaction {
        val transaction = transactionRunner.inTransaction {
            val existing = transactionRepository.get(id)
                ?: throw ResourceNotFoundException("Transaction $id was not found.")
            validateReferences(command)
            val candidate = Transaction(
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
                fxRateToPln = canonicalFxRateToPln(command.currency, command.fxRateToPln),
                notes = command.notes.trim(),
                createdAt = existing.createdAt,
                updatedAt = Instant.now(clock)
            )
            val finalTransactions = transactionRepository.list().map { persisted ->
                if (persisted.id == id) candidate else persisted
            }
            TransactionLedger.requireLongOnly(finalTransactions)
            transactionRepository.save(candidate)
        }
        auditLogService.record(
            category = AuditEventCategory.TRANSACTIONS,
            action = "TRANSACTION_UPDATED",
            entityType = "TRANSACTION",
            entityId = transaction.id.toString(),
            message = "Updated ${transaction.type.name} transaction.",
            metadata = transaction.auditMetadata()
        )
        return transaction
    }

    suspend fun delete(id: UUID) {
        transactionRunner.inTransaction {
            transactionRepository.get(id)
                ?: throw ResourceNotFoundException("Transaction $id was not found.")
            val finalTransactions = transactionRepository.list().filterNot { transaction -> transaction.id == id }
            TransactionLedger.requireLongOnly(finalTransactions)
            check(transactionRepository.delete(id)) { "Transaction $id disappeared during deletion." }
        }
        auditLogService.record(
            category = AuditEventCategory.TRANSACTIONS,
            action = "TRANSACTION_DELETED",
            entityType = "TRANSACTION",
            entityId = id.toString(),
            message = "Deleted transaction $id."
        )
    }

    private suspend fun validateReferences(command: CreateTransactionCommand) {
        val account = accountRepository.get(command.accountId)
            ?: throw ResourceNotFoundException("Account ${command.accountId} was not found.")

        require(account.isActive) { "Transactions cannot target inactive accounts." }

        val instrument = command.instrumentId?.let { instrumentId ->
            instrumentRepository.get(instrumentId)
                ?: throw ResourceNotFoundException("Instrument $instrumentId was not found.")
        }

        when (command.type) {
            TransactionType.REDEEM -> require(instrument?.kind == InstrumentKind.BOND_EDO) {
                "REDEEM transactions require an EDO instrument."
            }

            TransactionType.SELL -> require(instrument?.kind != InstrumentKind.BOND_EDO) {
                "Use REDEEM instead of SELL for EDO instruments."
            }

            else -> Unit
        }
    }

    private fun newTransaction(command: CreateTransactionCommand, timestamp: Instant): Transaction =
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
            fxRateToPln = canonicalFxRateToPln(command.currency, command.fxRateToPln),
            notes = command.notes.trim(),
            createdAt = timestamp,
            updatedAt = timestamp
        )

    private suspend fun prepareImport(
        commands: List<CreateTransactionCommand>,
        baseTimestamp: Instant
    ): PreparedTransactionImport {
        require(commands.isNotEmpty()) { "Import requires at least one transaction row." }

        val existingTransactions = transactionRepository.list()
        val existingKeys = existingTransactions
            .map { transaction -> transaction.toFingerprint() }
            .toSet()
        val seenBatchKeys = linkedSetOf<TransactionFingerprint>()
        val candidateLedger = existingTransactions.toMutableList()
        val importableTransactions = mutableListOf<Transaction>()
        val rows = commands.mapIndexed { index, command ->
            val validationError = validateImportRow(command)
            val fingerprint = command.toFingerprint()
            val statusAndMessage = when {
                validationError != null -> TransactionImportRowStatus.INVALID to validationError
                fingerprint in existingKeys ->
                    TransactionImportRowStatus.DUPLICATE_EXISTING to "Already present in the transaction journal."

                !seenBatchKeys.add(fingerprint) ->
                    TransactionImportRowStatus.DUPLICATE_BATCH to "Duplicate of an earlier row in the same batch."

                else -> {
                    val candidate = newTransaction(command, baseTimestamp.plusMillis(index.toLong()))
                    val violation = TransactionLedger.firstLongOnlyViolation(candidateLedger + candidate)
                    if (violation == null) {
                        candidateLedger += candidate
                        importableTransactions += candidate
                        TransactionImportRowStatus.IMPORTABLE to "Ready to import."
                    } else {
                        TransactionImportRowStatus.INVALID to
                            "Adding this row would violate the transaction ledger. ${violation.message}"
                    }
                }
            }

            TransactionImportPreviewRow(
                rowNumber = index + 1,
                status = statusAndMessage.first,
                message = statusAndMessage.second
            )
        }

        return PreparedTransactionImport(
            transactions = importableTransactions,
            preview = TransactionImportPreview(
                totalRowCount = rows.size,
                importableRowCount = rows.count { it.status == TransactionImportRowStatus.IMPORTABLE },
                duplicateRowCount = rows.count {
                    it.status == TransactionImportRowStatus.DUPLICATE_EXISTING ||
                        it.status == TransactionImportRowStatus.DUPLICATE_BATCH
                },
                duplicateExistingCount = rows.count { it.status == TransactionImportRowStatus.DUPLICATE_EXISTING },
                duplicateBatchCount = rows.count { it.status == TransactionImportRowStatus.DUPLICATE_BATCH },
                invalidRowCount = rows.count { it.status == TransactionImportRowStatus.INVALID },
                rows = rows
            )
        )
    }

    private suspend fun validateImportRow(command: CreateTransactionCommand): String? = try {
        validateReferences(command)
        newTransaction(command, Instant.EPOCH)
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
        fxRateToPln = canonicalFxRateToPln(currency, fxRateToPln)?.normalized(),
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
        fxRateToPln = canonicalFxRateToPln(currency, fxRateToPln)?.normalized(),
        notes = notes.trim()
    )

    private fun Transaction.auditMetadata(): Map<String, String> = buildMap {
        put("accountId", accountId.toString())
        put("type", type.name)
        put("tradeDate", tradeDate.toString())
        put("grossAmount", grossAmount.toPlainString())
        put("currency", currency)
        instrumentId?.let { put("instrumentId", it.toString()) }
        settlementDate?.let { put("settlementDate", it.toString()) }
    }

    private fun buildImportMessage(
        result: TransactionImportResult,
        context: TransactionImportContext?
    ): String {
        val sourceDescription = context?.displaySourceDescription()
        return if (sourceDescription == null) {
            "Imported ${result.createdCount} transaction rows."
        } else {
            "Imported ${result.createdCount} transaction rows from $sourceDescription."
        }
    }

    private fun BigDecimal.normalized(): BigDecimal = stripTrailingZeros()

    private fun canonicalFxRateToPln(currency: String, fxRateToPln: BigDecimal?): BigDecimal? =
        if (currency.uppercase() == "PLN") {
            null
        } else {
            fxRateToPln
        }
}

private data class PreparedTransactionImport(
    val transactions: List<Transaction>,
    val preview: TransactionImportPreview
)

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
    val duplicateExistingCount: Int,
    val duplicateBatchCount: Int,
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

data class TransactionImportContext(
    val profileId: UUID,
    val profileName: String,
    val sourceFileName: String? = null,
    val sourceLabel: String? = null
) {
    fun auditMetadata(): Map<String, String> = buildMap {
        put("profileId", profileId.toString())
        put("profileName", profileName)
        sourceFileName?.let { put("sourceFileName", it) }
        sourceLabel?.let { put("sourceLabel", it) }
    }

    fun displaySourceDescription(): String? = when {
        sourceLabel != null && sourceFileName != null -> "$sourceLabel ($sourceFileName)"
        sourceLabel != null -> sourceLabel
        sourceFileName != null -> sourceFileName
        else -> null
    }
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
