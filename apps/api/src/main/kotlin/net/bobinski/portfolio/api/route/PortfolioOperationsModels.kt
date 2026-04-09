package net.bobinski.portfolio.api.route

import kotlinx.serialization.Serializable
import net.bobinski.portfolio.api.domain.model.AuditEvent
import net.bobinski.portfolio.api.domain.model.AuditEventCategory
import net.bobinski.portfolio.api.domain.service.BackupTrigger
import net.bobinski.portfolio.api.domain.service.ImportMode
import net.bobinski.portfolio.api.domain.service.PortfolioBackupRecord
import net.bobinski.portfolio.api.domain.service.PortfolioBackupRestoreRequest
import net.bobinski.portfolio.api.domain.service.PortfolioBackupStatus
import net.bobinski.portfolio.api.domain.service.PortfolioImportIssue
import net.bobinski.portfolio.api.domain.service.PortfolioImportPreview
import net.bobinski.portfolio.api.domain.service.PortfolioImportRequest
import net.bobinski.portfolio.api.domain.service.PortfolioSnapshot
import net.bobinski.portfolio.api.domain.service.ReadModelCacheSnapshot
import net.bobinski.portfolio.api.marketdata.service.MarketDataSnapshotSummary
import net.bobinski.portfolio.api.readmodel.ReadModelRefreshRunResult
import net.bobinski.portfolio.api.readmodel.ReadModelRefreshStatus

@Serializable
data class PortfolioSnapshotResponse(
    val schemaVersion: Int,
    val exportedAt: String,
    val accounts: List<AccountSnapshotResponse>,
    val appPreferences: List<AppPreferenceSnapshotResponse> = emptyList(),
    val instruments: List<InstrumentSnapshotResponse>,
    val targets: List<PortfolioTargetSnapshotResponse> = emptyList(),
    val importProfiles: List<TransactionImportProfileSnapshotResponse> = emptyList(),
    val transactions: List<TransactionSnapshotResponse>
)

@Serializable
data class AccountSnapshotResponse(
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
data class InstrumentSnapshotResponse(
    val id: String,
    val name: String,
    val kind: String,
    val assetClass: String,
    val symbol: String?,
    val currency: String,
    val valuationSource: String,
    val edoTerms: EdoTermsSnapshotResponse?,
    val isActive: Boolean,
    val createdAt: String,
    val updatedAt: String
)

@Serializable
data class EdoTermsSnapshotResponse(
    val seriesMonth: String,
    val firstPeriodRateBps: Int,
    val marginBps: Int
)

@Serializable
data class TransactionSnapshotResponse(
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
data class PortfolioTargetSnapshotResponse(
    val id: String,
    val assetClass: String,
    val targetWeight: String,
    val createdAt: String,
    val updatedAt: String
)

@Serializable
data class AppPreferenceSnapshotResponse(
    val key: String,
    val valueJson: String,
    val updatedAt: String
)

@Serializable
data class TransactionImportProfileSnapshotResponse(
    val id: String,
    val name: String,
    val description: String,
    val delimiter: String,
    val dateFormat: String,
    val decimalSeparator: String,
    val skipDuplicatesByDefault: Boolean,
    val headerMappings: TransactionImportHeaderMappingsResponse,
    val defaults: TransactionImportDefaultsResponse,
    val createdAt: String,
    val updatedAt: String
)

@Serializable
data class ImportPortfolioStateRequest(
    val mode: String = "MERGE",
    val confirmation: String? = null,
    val snapshot: PortfolioSnapshotResponse
)

@Serializable
data class PortfolioImportResultResponse(
    val mode: String,
    val accountCount: Int,
    val appPreferenceCount: Int,
    val instrumentCount: Int,
    val targetCount: Int,
    val transactionCount: Int,
    val importProfileCount: Int,
    val safetyBackupFileName: String? = null
)

@Serializable
data class PortfolioImportPreviewResponse(
    val mode: String,
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
    val diff: PortfolioImportDiffResponse,
    val issues: List<PortfolioImportIssueResponse>
)

@Serializable
data class PortfolioImportDiffResponse(
    val accounts: PortfolioImportEntityDiffResponse,
    val appPreferences: PortfolioImportEntityDiffResponse,
    val instruments: PortfolioImportEntityDiffResponse,
    val targets: PortfolioImportEntityDiffResponse,
    val transactions: PortfolioImportEntityDiffResponse,
    val importProfiles: PortfolioImportEntityDiffResponse
)

@Serializable
data class PortfolioImportEntityDiffResponse(
    val createdCount: Int,
    val updatedCount: Int,
    val unchangedCount: Int,
    val preservedCount: Int,
    val deletedCount: Int,
    val sectionSkipped: Boolean
)

@Serializable
data class PortfolioImportIssueResponse(
    val severity: String,
    val code: String,
    val message: String
)

@Serializable
data class PortfolioBackupStatusResponse(
    val schedulerEnabled: Boolean,
    val directory: String,
    val intervalMinutes: Long,
    val retentionCount: Int,
    val running: Boolean,
    val lastRunAt: String?,
    val lastSuccessAt: String?,
    val lastFailureAt: String?,
    val lastFailureMessage: String?,
    val backups: List<PortfolioBackupRecordResponse>
)

@Serializable
data class AuditEventResponse(
    val id: String,
    val category: String,
    val action: String,
    val outcome: String,
    val entityType: String?,
    val entityId: String?,
    val message: String,
    val metadata: Map<String, String>,
    val occurredAt: String
)

@Serializable
data class ReadModelCacheSnapshotResponse(
    val cacheKey: String,
    val modelName: String,
    val modelVersion: Int,
    val inputsFrom: String?,
    val inputsTo: String?,
    val sourceUpdatedAt: String?,
    val generatedAt: String,
    val invalidationReason: String,
    val payloadSizeBytes: Int
)

@Serializable
data class ReadModelCacheInvalidationResponse(
    val clearedSnapshotCount: Int
)

@Serializable
data class MarketDataSnapshotResponse(
    val snapshotType: String,
    val identity: String,
    val cachedAt: String,
    val sourceFrom: String? = null,
    val sourceTo: String? = null,
    val sourceAsOf: String? = null,
    val pointCount: Int? = null,
    val status: String,
    val lastCheckedAt: String,
    val lastSuccessfulCheckAt: String? = null,
    val canonicalUpdatedAt: String? = null,
    val failureCount: Int,
    val lastFailureAt: String? = null,
    val lastFailureReason: String? = null
)

@Serializable
data class ReadModelRefreshStatusResponse(
    val schedulerEnabled: Boolean,
    val intervalMinutes: Long,
    val runOnStart: Boolean,
    val running: Boolean,
    val lastRunAt: String?,
    val lastSuccessAt: String?,
    val lastFailureAt: String?,
    val lastFailureMessage: String?,
    val lastTrigger: String?,
    val lastDurationMs: Long?,
    val modelNames: List<String>
)

@Serializable
data class ReadModelRefreshRunResponse(
    val trigger: String,
    val completedAt: String,
    val durationMs: Long,
    val refreshedModelCount: Int,
    val modelNames: List<String>
)

@Serializable
data class PortfolioBackupRecordResponse(
    val fileName: String,
    val createdAt: String,
    val exportedAt: String?,
    val sizeBytes: Long,
    val schemaVersion: Int?,
    val accountCount: Int?,
    val appPreferenceCount: Int?,
    val instrumentCount: Int?,
    val targetCount: Int?,
    val transactionCount: Int?,
    val importProfileCount: Int?,
    val isReadable: Boolean,
    val errorMessage: String?
)

@Serializable
data class RestorePortfolioBackupRequest(
    val fileName: String,
    val mode: String = "MERGE",
    val confirmation: String? = null
)

@Serializable
data class PortfolioBackupRestoreResultResponse(
    val fileName: String,
    val mode: String,
    val accountCount: Int,
    val appPreferenceCount: Int,
    val instrumentCount: Int,
    val targetCount: Int,
    val transactionCount: Int,
    val importProfileCount: Int,
    val safetyBackupFileName: String? = null
)

internal fun AuditEvent.toResponse(): AuditEventResponse = AuditEventResponse(
    id = id.toString(),
    category = category.name,
    action = action,
    outcome = outcome.name,
    entityType = entityType,
    entityId = entityId,
    message = message,
    metadata = metadata,
    occurredAt = occurredAt.toString()
)

internal fun ReadModelCacheSnapshot.toResponse(): ReadModelCacheSnapshotResponse = ReadModelCacheSnapshotResponse(
    cacheKey = cacheKey,
    modelName = modelName,
    modelVersion = modelVersion,
    inputsFrom = inputsFrom?.toString(),
    inputsTo = inputsTo?.toString(),
    sourceUpdatedAt = sourceUpdatedAt?.toString(),
    generatedAt = generatedAt.toString(),
    invalidationReason = invalidationReason.name,
    payloadSizeBytes = payloadSizeBytes
)

internal fun MarketDataSnapshotSummary.toResponse(): MarketDataSnapshotResponse = MarketDataSnapshotResponse(
    snapshotType = snapshotType,
    identity = identity,
    cachedAt = cachedAt.toString(),
    sourceFrom = sourceFrom,
    sourceTo = sourceTo,
    sourceAsOf = sourceAsOf,
    pointCount = pointCount,
    status = status.name,
    lastCheckedAt = lastCheckedAt.toString(),
    lastSuccessfulCheckAt = lastSuccessfulCheckAt?.toString(),
    canonicalUpdatedAt = canonicalUpdatedAt?.toString(),
    failureCount = failureCount,
    lastFailureAt = lastFailureAt?.toString(),
    lastFailureReason = lastFailureReason
)

internal fun ReadModelRefreshStatus.toResponse(): ReadModelRefreshStatusResponse = ReadModelRefreshStatusResponse(
    schedulerEnabled = schedulerEnabled,
    intervalMinutes = intervalMinutes,
    runOnStart = runOnStart,
    running = running,
    lastRunAt = lastRunAt?.toString(),
    lastSuccessAt = lastSuccessAt?.toString(),
    lastFailureAt = lastFailureAt?.toString(),
    lastFailureMessage = lastFailureMessage,
    lastTrigger = lastTrigger?.name,
    lastDurationMs = lastDurationMs,
    modelNames = modelNames
)

internal fun ReadModelRefreshRunResult.toResponse(): ReadModelRefreshRunResponse = ReadModelRefreshRunResponse(
    trigger = trigger.name,
    completedAt = completedAt.toString(),
    durationMs = durationMs,
    refreshedModelCount = refreshedModelCount,
    modelNames = modelNames
)

internal fun PortfolioBackupStatus.toResponse(): PortfolioBackupStatusResponse = PortfolioBackupStatusResponse(
    schedulerEnabled = schedulerEnabled,
    directory = directory,
    intervalMinutes = intervalMinutes,
    retentionCount = retentionCount,
    running = running,
    lastRunAt = lastRunAt?.toString(),
    lastSuccessAt = lastSuccessAt?.toString(),
    lastFailureAt = lastFailureAt?.toString(),
    lastFailureMessage = lastFailureMessage,
    backups = backups.map(PortfolioBackupRecord::toResponse)
)

internal fun PortfolioBackupRecord.toResponse(): PortfolioBackupRecordResponse = PortfolioBackupRecordResponse(
    fileName = fileName,
    createdAt = createdAt.toString(),
    exportedAt = exportedAt?.toString(),
    sizeBytes = sizeBytes,
    schemaVersion = schemaVersion,
    accountCount = accountCount,
    appPreferenceCount = appPreferenceCount,
    instrumentCount = instrumentCount,
    targetCount = targetCount,
    transactionCount = transactionCount,
    importProfileCount = importProfileCount,
    isReadable = isReadable,
    errorMessage = errorMessage
)

internal fun PortfolioSnapshot.toResponse(): PortfolioSnapshotResponse = PortfolioSnapshotResponse(
    schemaVersion = schemaVersion,
    exportedAt = exportedAt.toString(),
    accounts = accounts.map(net.bobinski.portfolio.api.domain.service.AccountSnapshot::toResponse),
    appPreferences = appPreferences.map(net.bobinski.portfolio.api.domain.service.AppPreferenceSnapshot::toResponse),
    instruments = instruments.map(net.bobinski.portfolio.api.domain.service.InstrumentSnapshot::toResponse),
    targets = targets.map(net.bobinski.portfolio.api.domain.service.PortfolioTargetSnapshot::toResponse),
    importProfiles = importProfiles.map(net.bobinski.portfolio.api.domain.service.TransactionImportProfileSnapshot::toResponse),
    transactions = transactions.map(net.bobinski.portfolio.api.domain.service.TransactionSnapshot::toResponse)
)

private fun net.bobinski.portfolio.api.domain.service.AccountSnapshot.toResponse() = AccountSnapshotResponse(
    id = id, name = name, institution = institution, type = type,
    baseCurrency = baseCurrency, displayOrder = displayOrder, isActive = isActive,
    createdAt = createdAt, updatedAt = updatedAt
)

private fun net.bobinski.portfolio.api.domain.service.AppPreferenceSnapshot.toResponse() = AppPreferenceSnapshotResponse(
    key = key, valueJson = valueJson, updatedAt = updatedAt
)

private fun net.bobinski.portfolio.api.domain.service.InstrumentSnapshot.toResponse() = InstrumentSnapshotResponse(
    id = id, name = name, kind = kind, assetClass = assetClass,
    symbol = symbol, currency = currency, valuationSource = valuationSource,
    edoTerms = edoTerms?.let { EdoTermsSnapshotResponse(it.seriesMonth, it.firstPeriodRateBps, it.marginBps) },
    isActive = isActive, createdAt = createdAt, updatedAt = updatedAt
)

private fun net.bobinski.portfolio.api.domain.service.PortfolioTargetSnapshot.toResponse() = PortfolioTargetSnapshotResponse(
    id = id, assetClass = assetClass, targetWeight = targetWeight,
    createdAt = createdAt, updatedAt = updatedAt
)

private fun net.bobinski.portfolio.api.domain.service.TransactionImportProfileSnapshot.toResponse() = TransactionImportProfileSnapshotResponse(
    id = id, name = name, description = description,
    delimiter = delimiter, dateFormat = dateFormat, decimalSeparator = decimalSeparator,
    skipDuplicatesByDefault = skipDuplicatesByDefault,
    headerMappings = TransactionImportHeaderMappingsResponse(
        account = headerMappings.account, type = headerMappings.type,
        tradeDate = headerMappings.tradeDate, settlementDate = headerMappings.settlementDate,
        instrument = headerMappings.instrument, quantity = headerMappings.quantity,
        unitPrice = headerMappings.unitPrice, grossAmount = headerMappings.grossAmount,
        feeAmount = headerMappings.feeAmount, taxAmount = headerMappings.taxAmount,
        currency = headerMappings.currency, fxRateToPln = headerMappings.fxRateToPln,
        notes = headerMappings.notes
    ),
    defaults = TransactionImportDefaultsResponse(accountId = defaults.accountId, currency = defaults.currency),
    createdAt = createdAt, updatedAt = updatedAt
)

private fun net.bobinski.portfolio.api.domain.service.TransactionSnapshot.toResponse() = TransactionSnapshotResponse(
    id = id, accountId = accountId, instrumentId = instrumentId, type = type,
    tradeDate = tradeDate, settlementDate = settlementDate,
    quantity = quantity, unitPrice = unitPrice, grossAmount = grossAmount,
    feeAmount = feeAmount, taxAmount = taxAmount, currency = currency,
    fxRateToPln = fxRateToPln, notes = notes, createdAt = createdAt, updatedAt = updatedAt
)

internal fun ImportPortfolioStateRequest.toDomain(): PortfolioImportRequest = PortfolioImportRequest(
    mode = try {
        ImportMode.valueOf(mode)
    } catch (_: IllegalArgumentException) {
        throw IllegalArgumentException("mode must be one of ${ImportMode.entries.joinToString()}.")
    },
    snapshot = PortfolioSnapshot(
        schemaVersion = snapshot.schemaVersion,
        exportedAt = snapshot.exportedAt.toInstantOrThrow("snapshot.exportedAt"),
        accounts = snapshot.accounts.map(AccountSnapshotResponse::toDomain),
        appPreferences = snapshot.appPreferences.map(AppPreferenceSnapshotResponse::toDomain),
        instruments = snapshot.instruments.map(InstrumentSnapshotResponse::toDomain),
        targets = snapshot.targets.map(PortfolioTargetSnapshotResponse::toDomain),
        importProfiles = snapshot.importProfiles.map(TransactionImportProfileSnapshotResponse::toDomain),
        transactions = snapshot.transactions.map(TransactionSnapshotResponse::toDomain)
    )
)

private fun AccountSnapshotResponse.toDomain() = net.bobinski.portfolio.api.domain.service.AccountSnapshot(
    id = id, name = name, institution = institution, type = type,
    baseCurrency = baseCurrency, displayOrder = displayOrder, isActive = isActive,
    createdAt = createdAt, updatedAt = updatedAt
)

private fun AppPreferenceSnapshotResponse.toDomain() = net.bobinski.portfolio.api.domain.service.AppPreferenceSnapshot(
    key = key, valueJson = valueJson, updatedAt = updatedAt
)

private fun InstrumentSnapshotResponse.toDomain() = net.bobinski.portfolio.api.domain.service.InstrumentSnapshot(
    id = id, name = name, kind = kind, assetClass = assetClass,
    symbol = symbol, currency = currency, valuationSource = valuationSource,
    edoTerms = edoTerms?.let {
        net.bobinski.portfolio.api.domain.service.EdoTermsSnapshot(it.seriesMonth, it.firstPeriodRateBps, it.marginBps)
    },
    isActive = isActive, createdAt = createdAt, updatedAt = updatedAt
)

private fun PortfolioTargetSnapshotResponse.toDomain() = net.bobinski.portfolio.api.domain.service.PortfolioTargetSnapshot(
    id = id, assetClass = assetClass, targetWeight = targetWeight,
    createdAt = createdAt, updatedAt = updatedAt
)

private fun TransactionImportProfileSnapshotResponse.toDomain() = net.bobinski.portfolio.api.domain.service.TransactionImportProfileSnapshot(
    id = id, name = name, description = description,
    delimiter = delimiter, dateFormat = dateFormat, decimalSeparator = decimalSeparator,
    skipDuplicatesByDefault = skipDuplicatesByDefault,
    headerMappings = net.bobinski.portfolio.api.domain.model.TransactionImportHeaderMappings(
        account = headerMappings.account, type = headerMappings.type,
        tradeDate = headerMappings.tradeDate, settlementDate = headerMappings.settlementDate,
        instrument = headerMappings.instrument, quantity = headerMappings.quantity,
        unitPrice = headerMappings.unitPrice, grossAmount = headerMappings.grossAmount,
        feeAmount = headerMappings.feeAmount, taxAmount = headerMappings.taxAmount,
        currency = headerMappings.currency, fxRateToPln = headerMappings.fxRateToPln,
        notes = headerMappings.notes
    ),
    defaults = net.bobinski.portfolio.api.domain.model.TransactionImportDefaults(
        accountId = defaults.accountId, currency = defaults.currency
    ),
    createdAt = createdAt, updatedAt = updatedAt
)

private fun TransactionSnapshotResponse.toDomain() = net.bobinski.portfolio.api.domain.service.TransactionSnapshot(
    id = id, accountId = accountId, instrumentId = instrumentId, type = type,
    tradeDate = tradeDate, settlementDate = settlementDate,
    quantity = quantity, unitPrice = unitPrice, grossAmount = grossAmount,
    feeAmount = feeAmount, taxAmount = taxAmount, currency = currency,
    fxRateToPln = fxRateToPln, notes = notes, createdAt = createdAt, updatedAt = updatedAt
)

internal fun net.bobinski.portfolio.api.domain.service.PortfolioImportResult.toResponse(): PortfolioImportResultResponse =
    PortfolioImportResultResponse(
        mode = mode.name,
        accountCount = accountCount,
        appPreferenceCount = appPreferenceCount,
        instrumentCount = instrumentCount,
        targetCount = targetCount,
        transactionCount = transactionCount,
        importProfileCount = importProfileCount,
        safetyBackupFileName = safetyBackupFileName
    )

internal fun PortfolioImportPreview.toResponse(): PortfolioImportPreviewResponse =
    PortfolioImportPreviewResponse(
        mode = mode.name,
        schemaVersion = schemaVersion,
        isValid = isValid,
        snapshotAccountCount = snapshotAccountCount,
        snapshotAppPreferenceCount = snapshotAppPreferenceCount,
        snapshotInstrumentCount = snapshotInstrumentCount,
        snapshotTargetCount = snapshotTargetCount,
        snapshotTransactionCount = snapshotTransactionCount,
        snapshotImportProfileCount = snapshotImportProfileCount,
        existingAccountCount = existingAccountCount,
        existingAppPreferenceCount = existingAppPreferenceCount,
        existingInstrumentCount = existingInstrumentCount,
        existingTargetCount = existingTargetCount,
        existingTransactionCount = existingTransactionCount,
        existingImportProfileCount = existingImportProfileCount,
        matchingAccountCount = matchingAccountCount,
        matchingAppPreferenceCount = matchingAppPreferenceCount,
        matchingInstrumentCount = matchingInstrumentCount,
        matchingTargetCount = matchingTargetCount,
        matchingTransactionCount = matchingTransactionCount,
        matchingImportProfileCount = matchingImportProfileCount,
        blockingIssueCount = blockingIssueCount,
        warningCount = warningCount,
        diff = diff.toResponse(),
        issues = issues.map(PortfolioImportIssue::toResponse)
    )

internal fun net.bobinski.portfolio.api.domain.service.PortfolioImportDiff.toResponse(): PortfolioImportDiffResponse =
    PortfolioImportDiffResponse(
        accounts = accounts.toResponse(),
        appPreferences = appPreferences.toResponse(),
        instruments = instruments.toResponse(),
        targets = targets.toResponse(),
        transactions = transactions.toResponse(),
        importProfiles = importProfiles.toResponse()
    )

internal fun net.bobinski.portfolio.api.domain.service.PortfolioImportEntityDiff.toResponse(): PortfolioImportEntityDiffResponse =
    PortfolioImportEntityDiffResponse(
        createdCount = createdCount,
        updatedCount = updatedCount,
        unchangedCount = unchangedCount,
        preservedCount = preservedCount,
        deletedCount = deletedCount,
        sectionSkipped = sectionSkipped
    )

internal fun PortfolioImportIssue.toResponse(): PortfolioImportIssueResponse = PortfolioImportIssueResponse(
    severity = severity.name,
    code = code,
    message = message
)

internal fun RestorePortfolioBackupRequest.toDomain(): PortfolioBackupRestoreRequest = PortfolioBackupRestoreRequest(
    fileName = fileName,
    mode = try {
        ImportMode.valueOf(mode)
    } catch (_: IllegalArgumentException) {
        throw IllegalArgumentException("mode must be one of ${ImportMode.entries.joinToString()}.")
    }
)

internal fun net.bobinski.portfolio.api.domain.service.PortfolioBackupRestoreResult.toResponse():
    PortfolioBackupRestoreResultResponse = PortfolioBackupRestoreResultResponse(
    fileName = fileName,
    mode = mode.name,
    accountCount = accountCount,
    appPreferenceCount = appPreferenceCount,
    instrumentCount = instrumentCount,
    targetCount = targetCount,
    transactionCount = transactionCount,
    importProfileCount = importProfileCount,
    safetyBackupFileName = safetyBackupFileName
)

internal fun requireReplaceConfirmation(mode: String, confirmation: String?) {
    if (mode.trim().uppercase() != ImportMode.REPLACE.name) {
        return
    }
    require(confirmation?.trim()?.uppercase() == ImportMode.REPLACE.name) {
        "REPLACE operations require confirmation set to REPLACE."
    }
}

internal fun String.toInstantOrThrow(field: String): java.time.Instant = try {
    java.time.Instant.parse(this)
} catch (_: java.time.format.DateTimeParseException) {
    throw IllegalArgumentException("$field must use ISO-8601 instant format.")
}

internal fun parseAuditEventCategory(value: String): AuditEventCategory = try {
    AuditEventCategory.valueOf(value.uppercase())
} catch (_: IllegalArgumentException) {
    throw IllegalArgumentException(
        "category must be one of ${AuditEventCategory.entries.joinToString()}."
    )
}
