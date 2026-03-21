package net.bobinski.portfolio.api.domain.service

import net.bobinski.portfolio.api.domain.model.Account
import net.bobinski.portfolio.api.domain.model.AccountType
import net.bobinski.portfolio.api.domain.model.AppPreference
import net.bobinski.portfolio.api.domain.model.AssetClass
import net.bobinski.portfolio.api.domain.model.EdoTerms
import net.bobinski.portfolio.api.domain.model.Instrument
import net.bobinski.portfolio.api.domain.model.InstrumentKind
import net.bobinski.portfolio.api.domain.model.PortfolioTarget
import net.bobinski.portfolio.api.domain.model.Transaction
import net.bobinski.portfolio.api.domain.model.TransactionImportProfile
import net.bobinski.portfolio.api.domain.model.TransactionType
import net.bobinski.portfolio.api.domain.model.ValuationSource
import net.bobinski.portfolio.api.domain.repository.AccountRepository
import net.bobinski.portfolio.api.domain.repository.AppPreferenceRepository
import net.bobinski.portfolio.api.domain.repository.InstrumentRepository
import net.bobinski.portfolio.api.domain.repository.PortfolioTargetRepository
import net.bobinski.portfolio.api.domain.repository.TransactionRepository
import net.bobinski.portfolio.api.domain.repository.TransactionImportProfileRepository
import java.math.BigDecimal
import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.util.UUID
import kotlinx.serialization.Serializable
import net.bobinski.portfolio.api.domain.model.AuditEventCategory

class PortfolioTransferService(
    private val accountRepository: AccountRepository,
    private val appPreferenceRepository: AppPreferenceRepository,
    private val instrumentRepository: InstrumentRepository,
    private val portfolioTargetRepository: PortfolioTargetRepository,
    private val transactionRepository: TransactionRepository,
    private val transactionImportProfileRepository: TransactionImportProfileRepository,
    private val auditLogService: AuditLogService,
    private val clock: Clock
) {
    suspend fun exportState(): PortfolioSnapshot {
        val accounts = accountRepository.list().sortedBy(Account::createdAt)
        val appPreferences = appPreferenceRepository.list().sortedBy(AppPreference::key)
        val instruments = instrumentRepository.list().sortedBy(Instrument::createdAt)
        val targets = portfolioTargetRepository.list()
            .sortedWith(compareBy<PortfolioTarget>({ it.createdAt }, { it.assetClass.name }))
        val transactions = transactionRepository.list()
            .sortedWith(compareBy<Transaction>({ it.tradeDate }, { it.createdAt }))
        val importProfiles = transactionImportProfileRepository.list()
            .sortedWith(compareBy<TransactionImportProfile>({ it.name.lowercase() }, { it.createdAt }))

        return PortfolioSnapshot(
            schemaVersion = CURRENT_SCHEMA_VERSION,
            exportedAt = Instant.now(clock),
            accounts = accounts.map { it.toSnapshot() },
            appPreferences = appPreferences.map { it.toSnapshot() },
            instruments = instruments.map { it.toSnapshot() },
            targets = targets.map { it.toSnapshot() },
            importProfiles = importProfiles.map { it.toSnapshot() },
            transactions = transactions.map { it.toSnapshot() }
        )
    }

    suspend fun previewImport(request: PortfolioImportRequest): PortfolioImportPreview {
        val existingAccounts = accountRepository.list()
        val existingAppPreferences = appPreferenceRepository.list()
        val existingInstruments = instrumentRepository.list()
        val existingTargets = portfolioTargetRepository.list()
        val existingTransactions = transactionRepository.list()
        val existingImportProfiles = transactionImportProfileRepository.list()
        val issues = mutableListOf<PortfolioImportIssue>()

        if (request.snapshot.schemaVersion !in SUPPORTED_SCHEMA_VERSIONS) {
            issues += PortfolioImportIssue(
                severity = ImportIssueSeverity.ERROR,
                code = "UNSUPPORTED_SCHEMA_VERSION",
                message = "Unsupported snapshot schema version ${request.snapshot.schemaVersion}. Expected one of ${SUPPORTED_SCHEMA_VERSIONS.sorted().joinToString()}."
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
            entityName = "target",
            ids = request.snapshot.targets.map(PortfolioTargetSnapshot::id)
        )
        issues += duplicateStringIssues(
            entityName = "app preference",
            values = request.snapshot.appPreferences.map(AppPreferenceSnapshot::key)
        )
        issues += duplicateIdIssues(
            entityName = "transaction",
            ids = request.snapshot.transactions.map(TransactionSnapshot::id)
        )
        issues += duplicateIdIssues(
            entityName = "import profile",
            ids = request.snapshot.importProfiles.map(TransactionImportProfileSnapshot::id)
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

        request.snapshot.targets.forEach { snapshot ->
            runCatching { snapshot.toDomain() }
                .onFailure { exception ->
                    issues += invalidSnapshotIssue(
                        entityName = "target",
                        entityId = snapshot.id,
                        message = exception.message ?: "Invalid target snapshot."
                    )
                }
        }

        val snapshotPreferenceKeys = mutableSetOf<String>()
        request.snapshot.appPreferences.forEach { snapshot ->
            runCatching { snapshot.toDomain() }
                .onSuccess { preference ->
                    snapshotPreferenceKeys += preference.key
                }
                .onFailure { exception ->
                    issues += invalidSnapshotIssue(
                        entityName = "app preference",
                        entityId = snapshot.key,
                        message = exception.message ?: "Invalid app preference snapshot."
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

        request.snapshot.importProfiles.forEach { snapshot ->
            runCatching { snapshot.toDomain() }
                .onSuccess { profile ->
                    val defaultAccountId = profile.defaults.accountId?.let(String::toUuidOrNull)
                    if (profile.defaults.accountId != null && defaultAccountId == null) {
                        issues += invalidSnapshotIssue(
                            entityName = "import profile",
                            entityId = snapshot.id,
                            message = "Import profile default account id must be a valid UUID."
                        )
                    } else if (defaultAccountId != null && defaultAccountId !in accountIdsAvailable) {
                        issues += PortfolioImportIssue(
                            severity = ImportIssueSeverity.ERROR,
                            code = "IMPORT_PROFILE_ACCOUNT_MISSING",
                            message = "Import profile ${snapshot.id} references missing account ${profile.defaults.accountId}."
                        )
                    }
                }
                .onFailure { exception ->
                    issues += invalidSnapshotIssue(
                        entityName = "import profile",
                        entityId = snapshot.id,
                        message = exception.message ?: "Invalid import profile snapshot."
                    )
                }
        }

        val snapshotAccountIdsRaw = request.snapshot.accounts.map(AccountSnapshot::id).mapNotNull(String::toUuidOrNull).toSet()
        val snapshotPreferenceKeysRaw = request.snapshot.appPreferences.map(AppPreferenceSnapshot::key).toSet()
        val snapshotInstrumentIdsRaw = request.snapshot.instruments.map(InstrumentSnapshot::id).mapNotNull(String::toUuidOrNull).toSet()
        val snapshotTargetIdsRaw = request.snapshot.targets.map(PortfolioTargetSnapshot::id).mapNotNull(String::toUuidOrNull).toSet()
        val snapshotTransactionIdsRaw = request.snapshot.transactions.map(TransactionSnapshot::id).mapNotNull(String::toUuidOrNull).toSet()
        val snapshotImportProfileIdsRaw = request.snapshot.importProfiles.map(TransactionImportProfileSnapshot::id).mapNotNull(String::toUuidOrNull).toSet()

        return PortfolioImportPreview(
            mode = request.mode,
            schemaVersion = request.snapshot.schemaVersion,
            isValid = issues.none { issue -> issue.severity == ImportIssueSeverity.ERROR },
            snapshotAccountCount = request.snapshot.accounts.size,
            snapshotAppPreferenceCount = request.snapshot.appPreferences.size,
            snapshotInstrumentCount = request.snapshot.instruments.size,
            snapshotTargetCount = request.snapshot.targets.size,
            snapshotTransactionCount = request.snapshot.transactions.size,
            snapshotImportProfileCount = request.snapshot.importProfiles.size,
            existingAccountCount = existingAccounts.size,
            existingAppPreferenceCount = existingAppPreferences.size,
            existingInstrumentCount = existingInstruments.size,
            existingTargetCount = existingTargets.size,
            existingTransactionCount = existingTransactions.size,
            existingImportProfileCount = existingImportProfiles.size,
            matchingAccountCount = existingAccounts.count { account -> account.id in snapshotAccountIdsRaw },
            matchingAppPreferenceCount = existingAppPreferences.count { preference -> preference.key in snapshotPreferenceKeysRaw },
            matchingInstrumentCount = existingInstruments.count { instrument -> instrument.id in snapshotInstrumentIdsRaw },
            matchingTargetCount = existingTargets.count { target -> target.id in snapshotTargetIdsRaw },
            matchingTransactionCount = existingTransactions.count { transaction -> transaction.id in snapshotTransactionIdsRaw },
            matchingImportProfileCount = existingImportProfiles.count { profile -> profile.id in snapshotImportProfileIdsRaw },
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
            transactionImportProfileRepository.deleteAll()
            portfolioTargetRepository.deleteAll()
            instrumentRepository.deleteAll()
            appPreferenceRepository.deleteAll()
            accountRepository.deleteAll()
        }

        val accounts = request.snapshot.accounts
            .sortedBy(AccountSnapshot::createdAt)
            .map { snapshot ->
                accountRepository.save(snapshot.toDomain())
            }
        val appPreferences = request.snapshot.appPreferences
            .sortedWith(compareBy<AppPreferenceSnapshot>({ it.key }, { it.updatedAt }))
            .map { snapshot ->
                appPreferenceRepository.save(snapshot.toDomain())
            }
        val instruments = request.snapshot.instruments
            .sortedBy(InstrumentSnapshot::createdAt)
            .map { snapshot ->
                instrumentRepository.save(snapshot.toDomain())
            }
        val targets = request.snapshot.targets
            .sortedWith(compareBy<PortfolioTargetSnapshot>({ it.createdAt }, { it.assetClass }))
            .also { snapshots ->
                portfolioTargetRepository.replaceAll(snapshots.map { it.toDomain() })
            }
        val transactions = request.snapshot.transactions
            .sortedWith(compareBy<TransactionSnapshot>({ it.tradeDate }, { it.createdAt }))
            .map { snapshot ->
                transactionRepository.save(snapshot.toDomain())
            }
        val importProfiles = request.snapshot.importProfiles
            .sortedWith(compareBy<TransactionImportProfileSnapshot>({ it.name.lowercase() }, { it.createdAt }))
            .map { snapshot ->
                transactionImportProfileRepository.save(snapshot.toDomain())
            }

        val result = PortfolioImportResult(
            mode = request.mode,
            accountCount = accounts.size,
            appPreferenceCount = appPreferences.size,
            instrumentCount = instruments.size,
            targetCount = targets.size,
            transactionCount = transactions.size,
            importProfileCount = importProfiles.size
        )
        auditLogService.record(
            category = AuditEventCategory.IMPORTS,
            action = "PORTFOLIO_STATE_IMPORTED",
            entityType = "PORTFOLIO_SNAPSHOT",
            message = "Imported portfolio snapshot in ${request.mode.name} mode.",
            metadata = mapOf(
                "mode" to request.mode.name,
                "accountCount" to result.accountCount.toString(),
                "appPreferenceCount" to result.appPreferenceCount.toString(),
                "instrumentCount" to result.instrumentCount.toString(),
                "targetCount" to result.targetCount.toString(),
                "transactionCount" to result.transactionCount.toString(),
                "importProfileCount" to result.importProfileCount.toString()
            )
        )
        return result
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

    private fun duplicateStringIssues(entityName: String, values: List<String>): List<PortfolioImportIssue> = values
        .groupingBy { it }
        .eachCount()
        .filter { (_, count) -> count > 1 }
        .keys
        .sorted()
        .map { value ->
            PortfolioImportIssue(
                severity = ImportIssueSeverity.ERROR,
                code = "${entityName.uppercase().replace(' ', '_')}_KEY_DUPLICATE",
                message = "Snapshot contains duplicate $entityName key $value."
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

    private fun PortfolioTarget.toSnapshot(): PortfolioTargetSnapshot = PortfolioTargetSnapshot(
        id = id.toString(),
        assetClass = assetClass.name,
        targetWeight = targetWeight.toPlainString(),
        createdAt = createdAt.toString(),
        updatedAt = updatedAt.toString()
    )

    private fun AppPreference.toSnapshot(): AppPreferenceSnapshot = AppPreferenceSnapshot(
        key = key,
        valueJson = valueJson,
        updatedAt = updatedAt.toString()
    )

    private fun TransactionImportProfile.toSnapshot(): TransactionImportProfileSnapshot = TransactionImportProfileSnapshot(
        id = id.toString(),
        name = name,
        description = description,
        delimiter = delimiter.name,
        dateFormat = dateFormat.name,
        decimalSeparator = decimalSeparator.name,
        skipDuplicatesByDefault = skipDuplicatesByDefault,
        headerMappings = headerMappings,
        defaults = defaults,
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

    private fun PortfolioTargetSnapshot.toDomain(): PortfolioTarget = PortfolioTarget(
        id = UUID.fromString(id),
        assetClass = AssetClass.valueOf(assetClass),
        targetWeight = targetWeight.toBigDecimal(),
        createdAt = Instant.parse(createdAt),
        updatedAt = Instant.parse(updatedAt)
    )

    private fun AppPreferenceSnapshot.toDomain(): AppPreference {
        require(key.isNotBlank()) { "App preference key must not be blank." }
        return AppPreference(
            key = key,
            valueJson = valueJson,
            updatedAt = Instant.parse(updatedAt)
        )
    }

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

    private fun TransactionImportProfileSnapshot.toDomain(): TransactionImportProfile = TransactionImportProfile(
        id = UUID.fromString(id),
        name = name,
        description = description,
        delimiter = net.bobinski.portfolio.api.domain.model.CsvDelimiter.valueOf(delimiter),
        dateFormat = net.bobinski.portfolio.api.domain.model.CsvDateFormat.valueOf(dateFormat),
        decimalSeparator = net.bobinski.portfolio.api.domain.model.CsvDecimalSeparator.valueOf(decimalSeparator),
        skipDuplicatesByDefault = skipDuplicatesByDefault,
        headerMappings = headerMappings,
        defaults = defaults,
        createdAt = Instant.parse(createdAt),
        updatedAt = Instant.parse(updatedAt)
    )

    private companion object {
        const val CURRENT_SCHEMA_VERSION = 2
        val SUPPORTED_SCHEMA_VERSIONS = setOf(1, 2)
    }
}

data class PortfolioSnapshot(
    val schemaVersion: Int,
    val exportedAt: Instant,
    val accounts: List<AccountSnapshot>,
    val appPreferences: List<AppPreferenceSnapshot> = emptyList(),
    val instruments: List<InstrumentSnapshot>,
    val targets: List<PortfolioTargetSnapshot> = emptyList(),
    val importProfiles: List<TransactionImportProfileSnapshot> = emptyList(),
    val transactions: List<TransactionSnapshot>
)

@Serializable
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

@Serializable
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

@Serializable
data class EdoTermsSnapshot(
    val purchaseDate: String,
    val firstPeriodRateBps: Int,
    val marginBps: Int,
    val principalUnits: Int,
    val maturityDate: String
)

@Serializable
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

@Serializable
data class PortfolioTargetSnapshot(
    val id: String,
    val assetClass: String,
    val targetWeight: String,
    val createdAt: String,
    val updatedAt: String
)

@Serializable
data class AppPreferenceSnapshot(
    val key: String,
    val valueJson: String,
    val updatedAt: String
)

@Serializable
data class TransactionImportProfileSnapshot(
    val id: String,
    val name: String,
    val description: String,
    val delimiter: String,
    val dateFormat: String,
    val decimalSeparator: String,
    val skipDuplicatesByDefault: Boolean,
    val headerMappings: net.bobinski.portfolio.api.domain.model.TransactionImportHeaderMappings,
    val defaults: net.bobinski.portfolio.api.domain.model.TransactionImportDefaults,
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
    val appPreferenceCount: Int,
    val instrumentCount: Int,
    val targetCount: Int,
    val transactionCount: Int,
    val importProfileCount: Int,
    val safetyBackupFileName: String? = null
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
    val snapshotAppPreferenceCount: Int,
    val snapshotInstrumentCount: Int,
    val snapshotTargetCount: Int,
    val snapshotTransactionCount: Int,
    val snapshotImportProfileCount: Int,
    val existingAccountCount: Int,
    val existingAppPreferenceCount: Int,
    val existingInstrumentCount: Int,
    val existingTargetCount: Int,
    val existingTransactionCount: Int,
    val existingImportProfileCount: Int,
    val matchingAccountCount: Int,
    val matchingAppPreferenceCount: Int,
    val matchingInstrumentCount: Int,
    val matchingTargetCount: Int,
    val matchingTransactionCount: Int,
    val matchingImportProfileCount: Int,
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
