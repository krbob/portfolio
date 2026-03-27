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
import java.time.YearMonth
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
    private val transactionRunner: PersistenceTransactionRunner,
    private val auditLogService: AuditLogService,
    private val clock: Clock
) {
    suspend fun exportState(): PortfolioSnapshot {
        val accounts = accountRepository.list()
            .sortedWith(compareBy<Account>({ it.displayOrder }, { it.createdAt }, { it.name.lowercase() }))
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

    suspend fun previewImport(request: PortfolioImportRequest): PortfolioImportPreview =
        prepareImport(request).preview

    suspend fun importState(request: PortfolioImportRequest): PortfolioImportResult {
        val prepared = prepareImport(request)
        val preview = prepared.preview
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

        val result = transactionRunner.inTransaction {
            if (request.mode == ImportMode.REPLACE) {
                transactionRepository.deleteAll()
                transactionImportProfileRepository.deleteAll()
                portfolioTargetRepository.deleteAll()
                instrumentRepository.deleteAll()
                appPreferenceRepository.deleteAll()
                accountRepository.deleteAll()
            }

            val accounts = prepared.accounts
                .sortedWith(compareBy<Account>({ it.displayOrder }, { it.createdAt }, { it.name.lowercase() }))
                .map { account -> accountRepository.save(account) }
            val appPreferences = prepared.appPreferences
                .sortedWith(compareBy<AppPreference>({ it.key }, { it.updatedAt }))
                .map { preference -> appPreferenceRepository.save(preference) }
            val instruments = prepared.instruments
                .sortedBy(Instrument::createdAt)
                .map { instrument -> instrumentRepository.save(instrument) }

            when (val targetPlan = prepared.targetPlan) {
                PreparedTargetImportPlan.Preserve -> Unit
                is PreparedTargetImportPlan.Replace -> {
                    portfolioTargetRepository.replaceAll(
                        targetPlan.targets.sortedWith(compareBy<PortfolioTarget>({ it.createdAt }, { it.assetClass.name }))
                    )
                }
            }

            val transactions = prepared.transactions
                .sortedWith(compareBy<Transaction>({ it.tradeDate }, { it.createdAt }))
                .map { transaction -> transactionRepository.save(transaction) }

            when (val importProfilesPlan = prepared.importProfilesPlan) {
                PreparedImportProfilesPlan.Preserve -> Unit
                is PreparedImportProfilesPlan.ReplaceAll -> {
                    if (request.mode == ImportMode.MERGE) {
                        transactionImportProfileRepository.deleteAll()
                    }
                    importProfilesPlan.profiles
                        .sortedWith(compareBy<TransactionImportProfile>({ it.name.lowercase() }, { it.createdAt }))
                        .forEach { profile -> transactionImportProfileRepository.save(profile) }
                }
            }

            PortfolioImportResult(
                mode = request.mode,
                accountCount = prepared.accounts.size,
                appPreferenceCount = prepared.appPreferences.size,
                instrumentCount = prepared.instruments.size,
                targetCount = prepared.targetPlan.appliedCount,
                transactionCount = prepared.transactions.size,
                importProfileCount = prepared.importProfilesPlan.importedCount
            )
        }
        auditLogService.record(
            category = AuditEventCategory.IMPORTS,
            action = "PORTFOLIO_STATE_IMPORTED",
            entityType = "PORTFOLIO_SNAPSHOT",
            message = "Imported portfolio snapshot in ${request.mode.name} mode.",
            metadata = mapOf(
                "mode" to result.mode.name,
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

    private suspend fun prepareImport(request: PortfolioImportRequest): PreparedPortfolioImport {
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

        issues += duplicateIdIssues("account", request.snapshot.accounts.map(AccountSnapshot::id))
        issues += duplicateIdIssues("instrument", request.snapshot.instruments.map(InstrumentSnapshot::id))
        issues += duplicateIdIssues("target", request.snapshot.targets.map(PortfolioTargetSnapshot::id))
        issues += duplicateStringIssues("app preference", request.snapshot.appPreferences.map(AppPreferenceSnapshot::key))
        issues += duplicateIdIssues("transaction", request.snapshot.transactions.map(TransactionSnapshot::id))
        issues += duplicateIdIssues("import profile", request.snapshot.importProfiles.map(TransactionImportProfileSnapshot::id))

        val snapshotAccounts = parseSnapshots(
            snapshots = request.snapshot.accounts,
            entityName = "account",
            entityId = AccountSnapshot::id,
            issues = issues,
            convert = { snapshot -> snapshot.toDomain() }
        )
        val snapshotAppPreferences = parseSnapshots(
            snapshots = request.snapshot.appPreferences,
            entityName = "app preference",
            entityId = AppPreferenceSnapshot::key,
            issues = issues,
            convert = { snapshot -> snapshot.toDomain() }
        )
        val snapshotInstruments = parseSnapshots(
            snapshots = request.snapshot.instruments,
            entityName = "instrument",
            entityId = InstrumentSnapshot::id,
            issues = issues,
            convert = { snapshot -> snapshot.toDomain() }
        )
        val snapshotTargets = parseSnapshots(
            snapshots = request.snapshot.targets,
            entityName = "target",
            entityId = PortfolioTargetSnapshot::id,
            issues = issues,
            convert = { snapshot -> snapshot.toDomain() }
        )
        val snapshotTransactions = parseSnapshots(
            snapshots = request.snapshot.transactions,
            entityName = "transaction",
            entityId = TransactionSnapshot::id,
            issues = issues,
            convert = { snapshot -> snapshot.toDomain() }
        )
        val snapshotImportProfiles = parseSnapshots(
            snapshots = request.snapshot.importProfiles,
            entityName = "import profile",
            entityId = TransactionImportProfileSnapshot::id,
            issues = issues,
            convert = { snapshot -> snapshot.toDomain() }
        )

        if (snapshotTargets.isNotEmpty()) {
            runCatching { PortfolioTargetService.validateTargets(snapshotTargets) }
                .onFailure { exception ->
                    issues += invalidSnapshotIssue(
                        entityName = "target",
                        entityId = "targets",
                        message = exception.message ?: "Invalid target snapshot set."
                    )
                }
        }

        val accountIdsAvailable = when (request.mode) {
            ImportMode.MERGE -> existingAccounts.mapTo(mutableSetOf(), Account::id)
            ImportMode.REPLACE -> mutableSetOf()
        }.apply {
            addAll(snapshotAccounts.map(Account::id))
        }
        val instrumentIdsAvailable = when (request.mode) {
            ImportMode.MERGE -> existingInstruments.mapTo(mutableSetOf(), Instrument::id)
            ImportMode.REPLACE -> mutableSetOf()
        }.apply {
            addAll(snapshotInstruments.map(Instrument::id))
        }

        snapshotTransactions.forEach { transaction ->
            if (transaction.accountId !in accountIdsAvailable) {
                issues += missingReferenceIssue(
                    transactionId = transaction.id.toString(),
                    referenceName = "account",
                    referenceId = transaction.accountId.toString()
                )
            }
            if (transaction.instrumentId != null && transaction.instrumentId !in instrumentIdsAvailable) {
                issues += missingReferenceIssue(
                    transactionId = transaction.id.toString(),
                    referenceName = "instrument",
                    referenceId = transaction.instrumentId.toString()
                )
            }
        }

        snapshotImportProfiles.forEach { profile ->
            val defaultAccountId = profile.defaults.accountId?.let(String::toUuidOrNull)
            if (profile.defaults.accountId != null && defaultAccountId == null) {
                issues += invalidSnapshotIssue(
                    entityName = "import profile",
                    entityId = profile.id.toString(),
                    message = "Import profile default account id must be a valid UUID."
                )
            } else if (defaultAccountId != null && defaultAccountId !in accountIdsAvailable) {
                issues += PortfolioImportIssue(
                    severity = ImportIssueSeverity.ERROR,
                    code = "IMPORT_PROFILE_ACCOUNT_MISSING",
                    message = "Import profile ${profile.id} references missing account ${profile.defaults.accountId}."
                )
            }
        }

        val targetPlan = prepareTargetPlan(
            mode = request.mode,
            existingTargets = existingTargets,
            snapshotTargets = snapshotTargets,
            issues = issues
        )
        val importProfilesPlan = prepareImportProfilesPlan(
            mode = request.mode,
            existingProfiles = existingImportProfiles,
            snapshotProfiles = snapshotImportProfiles,
            issues = issues
        )

        val diff = PortfolioImportDiff(
            accounts = buildEntityDiff(
                mode = request.mode,
                existing = existingAccounts,
                incoming = snapshotAccounts,
                keySelector = Account::id,
                signatureSelector = { account -> account.toSnapshot() }
            ),
            appPreferences = buildEntityDiff(
                mode = request.mode,
                existing = existingAppPreferences,
                incoming = snapshotAppPreferences,
                keySelector = AppPreference::key,
                signatureSelector = { preference -> preference.toSnapshot() }
            ),
            instruments = buildEntityDiff(
                mode = request.mode,
                existing = existingInstruments,
                incoming = snapshotInstruments,
                keySelector = Instrument::id,
                signatureSelector = { instrument -> instrument.toSnapshot() }
            ),
            targets = when (targetPlan) {
                PreparedTargetImportPlan.Preserve -> PortfolioImportEntityDiff(
                    createdCount = 0,
                    updatedCount = 0,
                    unchangedCount = 0,
                    preservedCount = existingTargets.size,
                    deletedCount = 0,
                    sectionSkipped = true
                )
                is PreparedTargetImportPlan.Replace -> buildEntityDiff(
                    mode = request.mode,
                    existing = existingTargets,
                    incoming = targetPlan.targets,
                    keySelector = PortfolioTarget::assetClass,
                    signatureSelector = { target -> target.toSnapshot() },
                    allowDeletionInMerge = request.mode == ImportMode.MERGE
                )
            },
            transactions = buildEntityDiff(
                mode = request.mode,
                existing = existingTransactions,
                incoming = snapshotTransactions,
                keySelector = Transaction::id,
                signatureSelector = { transaction -> transaction.toSnapshot() }
            ),
            importProfiles = when (importProfilesPlan) {
                PreparedImportProfilesPlan.Preserve -> PortfolioImportEntityDiff(
                    createdCount = 0,
                    updatedCount = 0,
                    unchangedCount = 0,
                    preservedCount = existingImportProfiles.size,
                    deletedCount = 0,
                    sectionSkipped = true
                )
                is PreparedImportProfilesPlan.ReplaceAll -> buildEntityDiff(
                    mode = request.mode,
                    existing = existingImportProfiles,
                    incoming = snapshotImportProfiles,
                    keySelector = TransactionImportProfile::id,
                    signatureSelector = { profile -> profile.toSnapshot() }
                )
            }
        )

        val sortedIssues = issues.sortedWith(
            compareBy<PortfolioImportIssue>(
                { it.severity != ImportIssueSeverity.ERROR },
                { it.code },
                { it.message }
            )
        )

        return PreparedPortfolioImport(
            accounts = snapshotAccounts,
            appPreferences = snapshotAppPreferences,
            instruments = snapshotInstruments,
            targetPlan = targetPlan,
            transactions = snapshotTransactions,
            importProfilesPlan = importProfilesPlan,
            preview = PortfolioImportPreview(
                mode = request.mode,
                schemaVersion = request.snapshot.schemaVersion,
                isValid = sortedIssues.none { issue -> issue.severity == ImportIssueSeverity.ERROR },
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
                matchingAccountCount = diff.accounts.matchingCount,
                matchingAppPreferenceCount = diff.appPreferences.matchingCount,
                matchingInstrumentCount = diff.instruments.matchingCount,
                matchingTargetCount = diff.targets.matchingCount,
                matchingTransactionCount = diff.transactions.matchingCount,
                matchingImportProfileCount = diff.importProfiles.matchingCount,
                blockingIssueCount = sortedIssues.count { issue -> issue.severity == ImportIssueSeverity.ERROR },
                warningCount = sortedIssues.count { issue -> issue.severity == ImportIssueSeverity.WARNING },
                diff = diff,
                issues = sortedIssues
            )
        )
    }

    private inline fun <S, T> parseSnapshots(
        snapshots: List<S>,
        entityName: String,
        entityId: (S) -> String,
        issues: MutableList<PortfolioImportIssue>,
        convert: (S) -> T
    ): List<T> = buildList {
        snapshots.forEach { snapshot ->
            runCatching { convert(snapshot) }
                .onSuccess(::add)
                .onFailure { exception ->
                    issues += invalidSnapshotIssue(
                        entityName = entityName,
                        entityId = entityId(snapshot),
                        message = exception.message ?: "Invalid $entityName snapshot."
                    )
                }
        }
    }

    private fun prepareTargetPlan(
        mode: ImportMode,
        existingTargets: List<PortfolioTarget>,
        snapshotTargets: List<PortfolioTarget>,
        issues: MutableList<PortfolioImportIssue>
    ): PreparedTargetImportPlan {
        if (mode == ImportMode.MERGE && snapshotTargets.isEmpty()) {
            if (existingTargets.isNotEmpty()) {
                issues += PortfolioImportIssue(
                    severity = ImportIssueSeverity.WARNING,
                    code = "TARGETS_SECTION_SKIPPED",
                    message = "Snapshot does not contain targets. MERGE will preserve the current target allocation."
                )
            }
            return PreparedTargetImportPlan.Preserve
        }

        if (mode == ImportMode.MERGE && snapshotTargets.isNotEmpty() && existingTargets.isNotEmpty()) {
            issues += PortfolioImportIssue(
                severity = ImportIssueSeverity.WARNING,
                code = "TARGETS_SECTION_REPLACED",
                message = "MERGE will replace the current target allocation with the snapshot target set."
            )
        }

        return PreparedTargetImportPlan.Replace(snapshotTargets)
    }

    private fun prepareImportProfilesPlan(
        mode: ImportMode,
        existingProfiles: List<TransactionImportProfile>,
        snapshotProfiles: List<TransactionImportProfile>,
        issues: MutableList<PortfolioImportIssue>
    ): PreparedImportProfilesPlan {
        if (mode == ImportMode.MERGE && snapshotProfiles.isEmpty()) {
            return PreparedImportProfilesPlan.Preserve
        }

        val finalProfiles = when (mode) {
            ImportMode.REPLACE -> snapshotProfiles
            ImportMode.MERGE -> {
                val merged = existingProfiles.associateBy(TransactionImportProfile::id).toMutableMap()
                snapshotProfiles.forEach { profile ->
                    merged[profile.id] = profile
                }
                merged.values.toList()
            }
        }

        issues += duplicateImportProfileNameIssues(finalProfiles)
        return PreparedImportProfilesPlan.ReplaceAll(
            profiles = finalProfiles,
            importedCount = snapshotProfiles.size
        )
    }

    private fun duplicateImportProfileNameIssues(
        profiles: List<TransactionImportProfile>
    ): List<PortfolioImportIssue> = profiles
        .groupingBy { it.name.trim() }
        .eachCount()
        .filter { (name, count) -> name.isNotBlank() && count > 1 }
        .keys
        .sorted()
        .map { duplicateName ->
            PortfolioImportIssue(
                severity = ImportIssueSeverity.ERROR,
                code = "IMPORT_PROFILE_NAME_DUPLICATE",
                message = "Import profile name '$duplicateName' would not be unique after import."
            )
        }

    private fun <T, K> buildEntityDiff(
        mode: ImportMode,
        existing: List<T>,
        incoming: List<T>,
        keySelector: (T) -> K,
        signatureSelector: (T) -> Any,
        allowDeletionInMerge: Boolean = false
    ): PortfolioImportEntityDiff {
        val existingByKey = existing.associateBy(keySelector)
        val incomingKeys = incoming.map(keySelector).toSet()
        val createdCount = incoming.count { item -> keySelector(item) !in existingByKey }
        val updatedCount = incoming.count { item ->
            val key = keySelector(item)
            val existingItem = existingByKey[key] ?: return@count false
            signatureSelector(existingItem) != signatureSelector(item)
        }
        val unchangedCount = incoming.count { item ->
            val key = keySelector(item)
            val existingItem = existingByKey[key] ?: return@count false
            signatureSelector(existingItem) == signatureSelector(item)
        }
        val preservedCount = when {
            mode == ImportMode.MERGE && !allowDeletionInMerge ->
                existing.count { item -> keySelector(item) !in incomingKeys }
            else -> 0
        }
        val deletedCount = when {
            mode == ImportMode.REPLACE ->
                existing.count { item -> keySelector(item) !in incomingKeys }
            mode == ImportMode.MERGE && allowDeletionInMerge ->
                existing.count { item -> keySelector(item) !in incomingKeys }
            else -> 0
        }
        return PortfolioImportEntityDiff(
            createdCount = createdCount,
            updatedCount = updatedCount,
            unchangedCount = unchangedCount,
            preservedCount = preservedCount,
            deletedCount = deletedCount
        )
    }

    private data class PreparedPortfolioImport(
        val accounts: List<Account>,
        val appPreferences: List<AppPreference>,
        val instruments: List<Instrument>,
        val targetPlan: PreparedTargetImportPlan,
        val transactions: List<Transaction>,
        val importProfilesPlan: PreparedImportProfilesPlan,
        val preview: PortfolioImportPreview
    )

    private sealed interface PreparedTargetImportPlan {
        val appliedCount: Int

        data object Preserve : PreparedTargetImportPlan {
            override val appliedCount: Int = 0
        }

        data class Replace(val targets: List<PortfolioTarget>) : PreparedTargetImportPlan {
            override val appliedCount: Int = targets.size
        }
    }

    private sealed interface PreparedImportProfilesPlan {
        val importedCount: Int

        data object Preserve : PreparedImportProfilesPlan {
            override val importedCount: Int = 0
        }

        data class ReplaceAll(
            val profiles: List<TransactionImportProfile>,
            override val importedCount: Int
        ) : PreparedImportProfilesPlan
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
        displayOrder = displayOrder,
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
                seriesMonth = terms.seriesMonth.toString(),
                firstPeriodRateBps = terms.firstPeriodRateBps,
                marginBps = terms.marginBps
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
        displayOrder = displayOrder,
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
        seriesMonth = YearMonth.parse(seriesMonth),
        firstPeriodRateBps = firstPeriodRateBps,
        marginBps = marginBps
    )

    private fun TransactionSnapshot.toDomain(): Transaction = Transaction(
        id = UUID.fromString(id),
        accountId = UUID.fromString(accountId),
        instrumentId = instrumentId?.let(UUID::fromString),
        type = TransactionType.valueOf(type),
        tradeDate = LocalDate.parse(tradeDate),
        settlementDate = settlementDate?.let(LocalDate::parse),
        quantity = quantity?.toBigDecimal(),
        unitPrice = unitPrice?.toBigDecimal(),
        grossAmount = grossAmount.toBigDecimal(),
        feeAmount = feeAmount.toBigDecimal(),
        taxAmount = taxAmount.toBigDecimal(),
        currency = currency.uppercase(),
        fxRateToPln = fxRateToPln?.toBigDecimal()?.takeUnless { currency.uppercase() == "PLN" },
        notes = notes,
        createdAt = Instant.parse(createdAt),
        updatedAt = Instant.parse(updatedAt)
    )

    private fun TransactionImportProfileSnapshot.toDomain(): TransactionImportProfile {
        require(name.isNotBlank()) { "Import profile name must not be blank." }
        return TransactionImportProfile(
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
    }

    private companion object {
        const val CURRENT_SCHEMA_VERSION = 4
        val SUPPORTED_SCHEMA_VERSIONS = setOf(4)
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
    val displayOrder: Int,
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
    val seriesMonth: String,
    val firstPeriodRateBps: Int,
    val marginBps: Int
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
    val diff: PortfolioImportDiff,
    val issues: List<PortfolioImportIssue>
)

data class PortfolioImportDiff(
    val accounts: PortfolioImportEntityDiff,
    val appPreferences: PortfolioImportEntityDiff,
    val instruments: PortfolioImportEntityDiff,
    val targets: PortfolioImportEntityDiff,
    val transactions: PortfolioImportEntityDiff,
    val importProfiles: PortfolioImportEntityDiff
)

data class PortfolioImportEntityDiff(
    val createdCount: Int,
    val updatedCount: Int,
    val unchangedCount: Int,
    val preservedCount: Int,
    val deletedCount: Int,
    val sectionSkipped: Boolean = false
) {
    val matchingCount: Int
        get() = updatedCount + unchangedCount
}

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
