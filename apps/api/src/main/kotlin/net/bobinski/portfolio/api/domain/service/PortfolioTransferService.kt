package net.bobinski.portfolio.api.domain.service

import net.bobinski.portfolio.api.domain.model.Account
import net.bobinski.portfolio.api.domain.model.AccountType
import net.bobinski.portfolio.api.domain.model.AssetClass
import net.bobinski.portfolio.api.domain.model.EdoTerms
import net.bobinski.portfolio.api.domain.model.Instrument
import net.bobinski.portfolio.api.domain.model.InstrumentKind
import net.bobinski.portfolio.api.domain.model.Transaction
import net.bobinski.portfolio.api.domain.model.TransactionType
import net.bobinski.portfolio.api.domain.model.ValuationSource
import net.bobinski.portfolio.api.domain.repository.AccountRepository
import net.bobinski.portfolio.api.domain.repository.InstrumentRepository
import net.bobinski.portfolio.api.domain.repository.TransactionRepository
import java.math.BigDecimal
import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.util.UUID

class PortfolioTransferService(
    private val accountRepository: AccountRepository,
    private val instrumentRepository: InstrumentRepository,
    private val transactionRepository: TransactionRepository,
    private val clock: Clock
) {
    suspend fun exportState(): PortfolioSnapshot {
        val accounts = accountRepository.list().sortedBy(Account::createdAt)
        val instruments = instrumentRepository.list().sortedBy(Instrument::createdAt)
        val transactions = transactionRepository.list()
            .sortedWith(compareBy<Transaction>({ it.tradeDate }, { it.createdAt }))

        return PortfolioSnapshot(
            schemaVersion = SCHEMA_VERSION,
            exportedAt = Instant.now(clock),
            accounts = accounts.map { it.toSnapshot() },
            instruments = instruments.map { it.toSnapshot() },
            transactions = transactions.map { it.toSnapshot() }
        )
    }

    suspend fun previewImport(request: PortfolioImportRequest): PortfolioImportPreview {
        val existingAccounts = accountRepository.list()
        val existingInstruments = instrumentRepository.list()
        val existingTransactions = transactionRepository.list()
        val issues = mutableListOf<PortfolioImportIssue>()

        if (request.snapshot.schemaVersion != SCHEMA_VERSION) {
            issues += PortfolioImportIssue(
                severity = ImportIssueSeverity.ERROR,
                code = "UNSUPPORTED_SCHEMA_VERSION",
                message = "Unsupported snapshot schema version ${request.snapshot.schemaVersion}. Expected $SCHEMA_VERSION."
            )
        }

        issues += duplicateIdIssues(
            entityName = "account",
            ids = request.snapshot.accounts.map(AccountSnapshot::id)
        )
        issues += duplicateIdIssues(
            entityName = "instrument",
            ids = request.snapshot.instruments.map(InstrumentSnapshot::id)
        )
        issues += duplicateIdIssues(
            entityName = "transaction",
            ids = request.snapshot.transactions.map(TransactionSnapshot::id)
        )

        val snapshotAccountIds = mutableSetOf<UUID>()
        request.snapshot.accounts.forEach { snapshot ->
            runCatching { snapshot.toDomain() }
                .onSuccess { account ->
                    snapshotAccountIds += account.id
                }
                .onFailure { exception ->
                    issues += invalidSnapshotIssue(
                        entityName = "account",
                        entityId = snapshot.id,
                        message = exception.message ?: "Invalid account snapshot."
                    )
                }
        }

        val snapshotInstrumentIds = mutableSetOf<UUID>()
        request.snapshot.instruments.forEach { snapshot ->
            runCatching { snapshot.toDomain() }
                .onSuccess { instrument ->
                    snapshotInstrumentIds += instrument.id
                }
                .onFailure { exception ->
                    issues += invalidSnapshotIssue(
                        entityName = "instrument",
                        entityId = snapshot.id,
                        message = exception.message ?: "Invalid instrument snapshot."
                    )
                }
        }

        val accountIdsAvailable = when (request.mode) {
            ImportMode.MERGE -> existingAccounts.mapTo(mutableSetOf(), Account::id)
            ImportMode.REPLACE -> mutableSetOf()
        }.apply {
            addAll(snapshotAccountIds)
        }

        val instrumentIdsAvailable = when (request.mode) {
            ImportMode.MERGE -> existingInstruments.mapTo(mutableSetOf(), Instrument::id)
            ImportMode.REPLACE -> mutableSetOf()
        }.apply {
            addAll(snapshotInstrumentIds)
        }

        request.snapshot.transactions.forEach { snapshot ->
            runCatching { snapshot.toDomain() }
                .onSuccess { transaction ->
                    if (transaction.accountId !in accountIdsAvailable) {
                        issues += missingReferenceIssue(
                            transactionId = snapshot.id,
                            referenceName = "account",
                            referenceId = snapshot.accountId
                        )
                    }
                    if (transaction.instrumentId != null && transaction.instrumentId !in instrumentIdsAvailable) {
                        issues += missingReferenceIssue(
                            transactionId = snapshot.id,
                            referenceName = "instrument",
                            referenceId = snapshot.instrumentId ?: "null"
                        )
                    }
                }
                .onFailure { exception ->
                    issues += invalidSnapshotIssue(
                        entityName = "transaction",
                        entityId = snapshot.id,
                        message = exception.message ?: "Invalid transaction snapshot."
                    )
                }
        }

        val snapshotAccountIdsRaw = request.snapshot.accounts.map(AccountSnapshot::id).mapNotNull(String::toUuidOrNull).toSet()
        val snapshotInstrumentIdsRaw = request.snapshot.instruments.map(InstrumentSnapshot::id).mapNotNull(String::toUuidOrNull).toSet()
        val snapshotTransactionIdsRaw = request.snapshot.transactions.map(TransactionSnapshot::id).mapNotNull(String::toUuidOrNull).toSet()

        return PortfolioImportPreview(
            mode = request.mode,
            schemaVersion = request.snapshot.schemaVersion,
            isValid = issues.none { issue -> issue.severity == ImportIssueSeverity.ERROR },
            snapshotAccountCount = request.snapshot.accounts.size,
            snapshotInstrumentCount = request.snapshot.instruments.size,
            snapshotTransactionCount = request.snapshot.transactions.size,
            existingAccountCount = existingAccounts.size,
            existingInstrumentCount = existingInstruments.size,
            existingTransactionCount = existingTransactions.size,
            matchingAccountCount = existingAccounts.count { account -> account.id in snapshotAccountIdsRaw },
            matchingInstrumentCount = existingInstruments.count { instrument -> instrument.id in snapshotInstrumentIdsRaw },
            matchingTransactionCount = existingTransactions.count { transaction -> transaction.id in snapshotTransactionIdsRaw },
            blockingIssueCount = issues.count { issue -> issue.severity == ImportIssueSeverity.ERROR },
            warningCount = issues.count { issue -> issue.severity == ImportIssueSeverity.WARNING },
            issues = issues.sortedByDescending { issue -> issue.severity == ImportIssueSeverity.ERROR }
        )
    }

    suspend fun importState(request: PortfolioImportRequest): PortfolioImportResult {
        val preview = previewImport(request)
        require(preview.isValid) {
            buildString {
                append("Snapshot import validation failed.")
                preview.issues
                    .filter { issue -> issue.severity == ImportIssueSeverity.ERROR }
                    .take(3)
                    .forEach { issue ->
                        append(' ')
                        append(issue.message)
                    }
            }
        }

        if (request.mode == ImportMode.REPLACE) {
            transactionRepository.deleteAll()
            instrumentRepository.deleteAll()
            accountRepository.deleteAll()
        }

        val accounts = request.snapshot.accounts
            .sortedBy(AccountSnapshot::createdAt)
            .map { snapshot ->
                accountRepository.save(snapshot.toDomain())
            }
        val instruments = request.snapshot.instruments
            .sortedBy(InstrumentSnapshot::createdAt)
            .map { snapshot ->
                instrumentRepository.save(snapshot.toDomain())
            }
        val transactions = request.snapshot.transactions
            .sortedWith(compareBy<TransactionSnapshot>({ it.tradeDate }, { it.createdAt }))
            .map { snapshot ->
                transactionRepository.save(snapshot.toDomain())
            }

        return PortfolioImportResult(
            mode = request.mode,
            accountCount = accounts.size,
            instrumentCount = instruments.size,
            transactionCount = transactions.size
        )
    }

    private fun duplicateIdIssues(entityName: String, ids: List<String>): List<PortfolioImportIssue> = ids
        .groupingBy { it }
        .eachCount()
        .filterValues { count -> count > 1 }
        .keys
        .sorted()
        .map { duplicateId ->
            PortfolioImportIssue(
                severity = ImportIssueSeverity.ERROR,
                code = "${entityName.uppercase()}_ID_DUPLICATE",
                message = "Snapshot contains duplicate $entityName id $duplicateId."
            )
        }

    private fun invalidSnapshotIssue(
        entityName: String,
        entityId: String,
        message: String
    ): PortfolioImportIssue = PortfolioImportIssue(
        severity = ImportIssueSeverity.ERROR,
        code = "${entityName.uppercase()}_INVALID",
        message = "Invalid $entityName snapshot $entityId: $message"
    )

    private fun missingReferenceIssue(
        transactionId: String,
        referenceName: String,
        referenceId: String
    ): PortfolioImportIssue = PortfolioImportIssue(
        severity = ImportIssueSeverity.ERROR,
        code = "TRANSACTION_${referenceName.uppercase()}_MISSING",
        message = "Transaction $transactionId references missing $referenceName $referenceId."
    )

    private fun Account.toSnapshot(): AccountSnapshot = AccountSnapshot(
        id = id.toString(),
        name = name,
        institution = institution,
        type = type.name,
        baseCurrency = baseCurrency,
        isActive = isActive,
        createdAt = createdAt.toString(),
        updatedAt = updatedAt.toString()
    )

    private fun Instrument.toSnapshot(): InstrumentSnapshot = InstrumentSnapshot(
        id = id.toString(),
        name = name,
        kind = kind.name,
        assetClass = assetClass.name,
        symbol = symbol,
        currency = currency,
        valuationSource = valuationSource.name,
        edoTerms = edoTerms?.let { terms ->
            EdoTermsSnapshot(
                purchaseDate = terms.purchaseDate.toString(),
                firstPeriodRateBps = terms.firstPeriodRateBps,
                marginBps = terms.marginBps,
                principalUnits = terms.principalUnits,
                maturityDate = terms.maturityDate.toString()
            )
        },
        isActive = isActive,
        createdAt = createdAt.toString(),
        updatedAt = updatedAt.toString()
    )

    private fun Transaction.toSnapshot(): TransactionSnapshot = TransactionSnapshot(
        id = id.toString(),
        accountId = accountId.toString(),
        instrumentId = instrumentId?.toString(),
        type = type.name,
        tradeDate = tradeDate.toString(),
        settlementDate = settlementDate?.toString(),
        quantity = quantity?.toPlainString(),
        unitPrice = unitPrice?.toPlainString(),
        grossAmount = grossAmount.toPlainString(),
        feeAmount = feeAmount.toPlainString(),
        taxAmount = taxAmount.toPlainString(),
        currency = currency,
        fxRateToPln = fxRateToPln?.toPlainString(),
        notes = notes,
        createdAt = createdAt.toString(),
        updatedAt = updatedAt.toString()
    )

    private fun AccountSnapshot.toDomain(): Account = Account(
        id = UUID.fromString(id),
        name = name,
        institution = institution,
        type = AccountType.valueOf(type),
        baseCurrency = baseCurrency,
        isActive = isActive,
        createdAt = Instant.parse(createdAt),
        updatedAt = Instant.parse(updatedAt)
    )

    private fun InstrumentSnapshot.toDomain(): Instrument = Instrument(
        id = UUID.fromString(id),
        name = name,
        kind = InstrumentKind.valueOf(kind),
        assetClass = AssetClass.valueOf(assetClass),
        symbol = symbol,
        currency = currency,
        valuationSource = ValuationSource.valueOf(valuationSource),
        edoTerms = edoTerms?.toDomain(),
        isActive = isActive,
        createdAt = Instant.parse(createdAt),
        updatedAt = Instant.parse(updatedAt)
    )

    private fun EdoTermsSnapshot.toDomain(): EdoTerms = EdoTerms(
        purchaseDate = LocalDate.parse(purchaseDate),
        firstPeriodRateBps = firstPeriodRateBps,
        marginBps = marginBps,
        principalUnits = principalUnits,
        maturityDate = LocalDate.parse(maturityDate)
    )

    private fun TransactionSnapshot.toDomain(): Transaction = Transaction(
        id = UUID.fromString(id),
        accountId = UUID.fromString(accountId),
        instrumentId = instrumentId?.let(UUID::fromString),
        type = TransactionType.valueOf(type),
        tradeDate = LocalDate.parse(tradeDate),
        settlementDate = settlementDate?.let(LocalDate::parse),
        quantity = quantity?.toBigDecimalOrNull(),
        unitPrice = unitPrice?.toBigDecimalOrNull(),
        grossAmount = grossAmount.toBigDecimal(),
        feeAmount = feeAmount.toBigDecimal(),
        taxAmount = taxAmount.toBigDecimal(),
        currency = currency,
        fxRateToPln = fxRateToPln?.toBigDecimalOrNull(),
        notes = notes,
        createdAt = Instant.parse(createdAt),
        updatedAt = Instant.parse(updatedAt)
    )

    private companion object {
        const val SCHEMA_VERSION = 1
    }
}

data class PortfolioSnapshot(
    val schemaVersion: Int,
    val exportedAt: Instant,
    val accounts: List<AccountSnapshot>,
    val instruments: List<InstrumentSnapshot>,
    val transactions: List<TransactionSnapshot>
)

data class AccountSnapshot(
    val id: String,
    val name: String,
    val institution: String,
    val type: String,
    val baseCurrency: String,
    val isActive: Boolean,
    val createdAt: String,
    val updatedAt: String
)

data class InstrumentSnapshot(
    val id: String,
    val name: String,
    val kind: String,
    val assetClass: String,
    val symbol: String?,
    val currency: String,
    val valuationSource: String,
    val edoTerms: EdoTermsSnapshot?,
    val isActive: Boolean,
    val createdAt: String,
    val updatedAt: String
)

data class EdoTermsSnapshot(
    val purchaseDate: String,
    val firstPeriodRateBps: Int,
    val marginBps: Int,
    val principalUnits: Int,
    val maturityDate: String
)

data class TransactionSnapshot(
    val id: String,
    val accountId: String,
    val instrumentId: String?,
    val type: String,
    val tradeDate: String,
    val settlementDate: String?,
    val quantity: String?,
    val unitPrice: String?,
    val grossAmount: String,
    val feeAmount: String,
    val taxAmount: String,
    val currency: String,
    val fxRateToPln: String?,
    val notes: String,
    val createdAt: String,
    val updatedAt: String
)

data class PortfolioImportRequest(
    val mode: ImportMode,
    val snapshot: PortfolioSnapshot
)

data class PortfolioImportResult(
    val mode: ImportMode,
    val accountCount: Int,
    val instrumentCount: Int,
    val transactionCount: Int
)

enum class ImportMode {
    MERGE,
    REPLACE
}

data class PortfolioImportPreview(
    val mode: ImportMode,
    val schemaVersion: Int,
    val isValid: Boolean,
    val snapshotAccountCount: Int,
    val snapshotInstrumentCount: Int,
    val snapshotTransactionCount: Int,
    val existingAccountCount: Int,
    val existingInstrumentCount: Int,
    val existingTransactionCount: Int,
    val matchingAccountCount: Int,
    val matchingInstrumentCount: Int,
    val matchingTransactionCount: Int,
    val blockingIssueCount: Int,
    val warningCount: Int,
    val issues: List<PortfolioImportIssue>
)

data class PortfolioImportIssue(
    val severity: ImportIssueSeverity,
    val code: String,
    val message: String
)

enum class ImportIssueSeverity {
    ERROR,
    WARNING
}

private fun String.toUuidOrNull(): UUID? = runCatching(UUID::fromString).getOrNull()
