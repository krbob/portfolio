package net.bobinski.portfolio.api.route

import io.ktor.http.ContentDisposition
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.server.request.receive
import io.ktor.server.response.header
import io.ktor.server.response.respond
import io.ktor.server.response.respondText
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.route
import kotlinx.serialization.Serializable
import net.bobinski.portfolio.api.domain.model.AuditEvent
import net.bobinski.portfolio.api.domain.model.AuditEventCategory
import net.bobinski.portfolio.api.domain.service.AuditLogService
import net.bobinski.portfolio.api.domain.service.BackupTrigger
import net.bobinski.portfolio.api.domain.service.ImportMode
import net.bobinski.portfolio.api.domain.service.PortfolioBackupRecord
import net.bobinski.portfolio.api.domain.service.PortfolioBackupRestoreRequest
import net.bobinski.portfolio.api.domain.service.PortfolioBackupService
import net.bobinski.portfolio.api.domain.service.PortfolioBackupStatus
import net.bobinski.portfolio.api.domain.service.PortfolioImportIssue
import net.bobinski.portfolio.api.domain.service.PortfolioImportPreview
import net.bobinski.portfolio.api.domain.service.PortfolioImportRequest
import net.bobinski.portfolio.api.domain.service.PortfolioSnapshot
import net.bobinski.portfolio.api.domain.service.PortfolioTransferService
import net.bobinski.portfolio.api.domain.service.ReadModelCacheService
import net.bobinski.portfolio.api.domain.service.ReadModelCacheSnapshot
import net.bobinski.portfolio.api.marketdata.service.MarketDataSnapshotCacheService
import net.bobinski.portfolio.api.marketdata.service.MarketDataSnapshotSummary
import net.bobinski.portfolio.api.readmodel.ReadModelRefreshRunResult
import net.bobinski.portfolio.api.readmodel.ReadModelRefreshService
import net.bobinski.portfolio.api.readmodel.ReadModelRefreshStatus
import org.koin.ktor.ext.inject
import kotlin.reflect.typeOf

fun Route.portfolioOperationsRoute() {
    val readModelCacheService: ReadModelCacheService by inject()
    val portfolioTransferService: PortfolioTransferService by inject()
    val portfolioBackupService: PortfolioBackupService by inject()
    val readModelRefreshService: ReadModelRefreshService by inject()
    val marketDataSnapshotCacheService: MarketDataSnapshotCacheService by inject()
    val auditLogService: AuditLogService by inject()

    route("/v1/portfolio") {
        get("/read-model-cache") {
            call.respond(readModelCacheService.list().map(ReadModelCacheSnapshot::toResponse))
        }.documented(
            operationId = "listReadModelCacheSnapshots",
            summary = "List read-model cache snapshots",
            description = "Returns cached read-model snapshots and their invalidation metadata.",
            tag = "Portfolio"
        )

        get("/market-data-snapshots") {
            call.respond(marketDataSnapshotCacheService.listSnapshots().map(MarketDataSnapshotSummary::toResponse))
        }.documented(
            operationId = "listMarketDataSnapshots",
            summary = "List market-data snapshots",
            description = "Returns cached last-known-good market-data snapshots used for stale fallback diagnostics.",
            tag = "Portfolio"
        )

        get("/read-model-refresh") {
            call.respond(readModelRefreshService.status().toResponse())
        }.documented(
            operationId = "getReadModelRefreshStatus",
            summary = "Get read-model refresh status",
            description = "Returns the status of background refresh jobs for read models.",
            tag = "Portfolio"
        )

        post("/read-model-refresh/run") {
            call.respond(readModelRefreshService.runManualRefresh().toResponse())
        }.documented(
            operationId = "runReadModelRefresh",
            summary = "Run a manual read-model refresh",
            description = "Triggers an immediate refresh of portfolio read models and returns the result.",
            tag = "Portfolio"
        )

        post("/read-model-cache/invalidate") {
            val clearedSnapshotCount = readModelCacheService.clearAll()
            auditLogService.record(
                category = AuditEventCategory.SYSTEM,
                action = "READ_MODEL_CACHE_INVALIDATED",
                entityType = "READ_MODEL_CACHE",
                message = "Invalidated read-model cache snapshots.",
                metadata = mapOf(
                    "clearedSnapshotCount" to clearedSnapshotCount.toString()
                )
            )
            call.respond(
                ReadModelCacheInvalidationResponse(
                    clearedSnapshotCount = clearedSnapshotCount
                )
            )
        }.documented(
            operationId = "invalidateReadModelCache",
            summary = "Invalidate read-model cache",
            description = "Clears all cached read-model snapshots so they are rebuilt on the next access.",
            tag = "Portfolio"
        )

        get("/audit/events") {
            val limit = call.request.queryParameters["limit"]?.toIntOrNull() ?: 12
            val category = call.request.queryParameters["category"]?.let(::parseAuditEventCategory)
            call.respond(auditLogService.list(limit = limit, category = category).map(AuditEvent::toResponse))
        }.documented(
            operationId = "listPortfolioAuditEvents",
            summary = "List portfolio audit events",
            description = "Returns recent operational audit events with optional category filtering.",
            tag = "Portfolio"
        )

        get("/backups") {
            call.respond(portfolioBackupService.status().toResponse())
        }.documented(
            operationId = "getPortfolioBackupStatus",
            summary = "Get backup status",
            description = "Returns server backup status, retention settings and stored backup records.",
            tag = "Portfolio"
        )

        get("/backups/download") {
            val fileName = call.request.queryParameters["fileName"]
                ?: throw IllegalArgumentException("fileName query parameter is required.")
            val backup = portfolioBackupService.downloadBackup(fileName)
            call.response.header(
                HttpHeaders.ContentDisposition,
                ContentDisposition.Attachment.withParameter(ContentDisposition.Parameters.FileName, backup.fileName).toString()
            )
            call.respondText(
                text = backup.content,
                contentType = ContentType.Application.Json
            )
        }.documented(
            operationId = "downloadPortfolioBackup",
            summary = "Download a portfolio backup",
            description = "Downloads a stored portfolio backup as a JSON attachment.",
            tag = "Portfolio"
        ) {
            responses {
                response(200) {
                    description = "JSON backup file."
                    headers {
                        header(HttpHeaders.ContentDisposition) {
                            description = "Attachment header containing the backup file name."
                            required = true
                            schema = buildSchema(typeOf<String>())
                        }
                    }
                }
            }
        }

        post("/backups/run") {
            call.respond(portfolioBackupService.createBackup().toResponse())
        }.documented(
            operationId = "runPortfolioBackup",
            summary = "Create a portfolio backup",
            description = "Triggers an on-demand portfolio backup and returns the created backup metadata.",
            tag = "Portfolio"
        )

        post("/backups/restore") {
            val request = call.receive<RestorePortfolioBackupRequest>()
            requireReplaceConfirmation(mode = request.mode, confirmation = request.confirmation)
            call.respond(portfolioBackupService.restoreBackup(request.toDomain()).toResponse())
        }.documented(
            operationId = "restorePortfolioBackup",
            summary = "Restore a portfolio backup",
            description = "Restores a stored portfolio backup in merge or replace mode.",
            tag = "Portfolio"
        )

        get("/state/export") {
            call.respond(portfolioTransferService.exportState().toResponse())
        }.documented(
            operationId = "exportPortfolioState",
            summary = "Export portfolio state",
            description = "Exports the canonical portfolio state as structured JSON.",
            tag = "Portfolio"
        )

        post("/state/preview") {
            val request = call.receive<ImportPortfolioStateRequest>()
            val result = portfolioTransferService.previewImport(request.toDomain())
            call.respond(result.toResponse())
        }.documented(
            operationId = "previewPortfolioStateImport",
            summary = "Preview portfolio state import",
            description = "Validates an incoming portfolio state snapshot and returns a preview of the import impact.",
            tag = "Portfolio"
        )

        post("/state/import") {
            val request = call.receive<ImportPortfolioStateRequest>()
            requireReplaceConfirmation(mode = request.mode, confirmation = request.confirmation)
            val domainRequest = request.toDomain()
            val safetyBackup = if (domainRequest.mode == ImportMode.REPLACE) {
                portfolioBackupService.createBackup(trigger = BackupTrigger.PRE_IMPORT_REPLACE)
            } else {
                null
            }
            val result = portfolioTransferService.importState(domainRequest).copy(
                safetyBackupFileName = safetyBackup?.fileName
            )
            call.respond(result.toResponse())
        }.documented(
            operationId = "importPortfolioState",
            summary = "Import portfolio state",
            description = "Imports a portfolio state snapshot in merge or replace mode.",
            tag = "Portfolio"
        )
    }
}

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
    val issues: List<PortfolioImportIssueResponse>
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
    val pointCount: Int? = null
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

private fun AuditEvent.toResponse(): AuditEventResponse = AuditEventResponse(
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

private fun ReadModelCacheSnapshot.toResponse(): ReadModelCacheSnapshotResponse = ReadModelCacheSnapshotResponse(
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

private fun MarketDataSnapshotSummary.toResponse(): MarketDataSnapshotResponse = MarketDataSnapshotResponse(
    snapshotType = snapshotType,
    identity = identity,
    cachedAt = cachedAt.toString(),
    sourceFrom = sourceFrom,
    sourceTo = sourceTo,
    sourceAsOf = sourceAsOf,
    pointCount = pointCount
)

private fun ReadModelRefreshStatus.toResponse(): ReadModelRefreshStatusResponse = ReadModelRefreshStatusResponse(
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

private fun ReadModelRefreshRunResult.toResponse(): ReadModelRefreshRunResponse = ReadModelRefreshRunResponse(
    trigger = trigger.name,
    completedAt = completedAt.toString(),
    durationMs = durationMs,
    refreshedModelCount = refreshedModelCount,
    modelNames = modelNames
)

private fun PortfolioBackupStatus.toResponse(): PortfolioBackupStatusResponse = PortfolioBackupStatusResponse(
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

private fun PortfolioBackupRecord.toResponse(): PortfolioBackupRecordResponse = PortfolioBackupRecordResponse(
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

private fun PortfolioSnapshot.toResponse(): PortfolioSnapshotResponse = PortfolioSnapshotResponse(
    schemaVersion = schemaVersion,
    exportedAt = exportedAt.toString(),
    accounts = accounts.map { snapshot ->
        AccountSnapshotResponse(
            id = snapshot.id,
            name = snapshot.name,
            institution = snapshot.institution,
            type = snapshot.type,
            baseCurrency = snapshot.baseCurrency,
            displayOrder = snapshot.displayOrder,
            isActive = snapshot.isActive,
            createdAt = snapshot.createdAt,
            updatedAt = snapshot.updatedAt
        )
    },
    appPreferences = appPreferences.map { snapshot ->
        AppPreferenceSnapshotResponse(
            key = snapshot.key,
            valueJson = snapshot.valueJson,
            updatedAt = snapshot.updatedAt
        )
    },
    instruments = instruments.map { snapshot ->
        InstrumentSnapshotResponse(
            id = snapshot.id,
            name = snapshot.name,
            kind = snapshot.kind,
            assetClass = snapshot.assetClass,
            symbol = snapshot.symbol,
            currency = snapshot.currency,
            valuationSource = snapshot.valuationSource,
            edoTerms = snapshot.edoTerms?.let { terms ->
                EdoTermsSnapshotResponse(
                    seriesMonth = terms.seriesMonth,
                    firstPeriodRateBps = terms.firstPeriodRateBps,
                    marginBps = terms.marginBps
                )
            },
            isActive = snapshot.isActive,
            createdAt = snapshot.createdAt,
            updatedAt = snapshot.updatedAt
        )
    },
    targets = targets.map { snapshot ->
        PortfolioTargetSnapshotResponse(
            id = snapshot.id,
            assetClass = snapshot.assetClass,
            targetWeight = snapshot.targetWeight,
            createdAt = snapshot.createdAt,
            updatedAt = snapshot.updatedAt
        )
    },
    importProfiles = importProfiles.map { snapshot ->
        TransactionImportProfileSnapshotResponse(
            id = snapshot.id,
            name = snapshot.name,
            description = snapshot.description,
            delimiter = snapshot.delimiter,
            dateFormat = snapshot.dateFormat,
            decimalSeparator = snapshot.decimalSeparator,
            skipDuplicatesByDefault = snapshot.skipDuplicatesByDefault,
            headerMappings = TransactionImportHeaderMappingsResponse(
                account = snapshot.headerMappings.account,
                type = snapshot.headerMappings.type,
                tradeDate = snapshot.headerMappings.tradeDate,
                settlementDate = snapshot.headerMappings.settlementDate,
                instrument = snapshot.headerMappings.instrument,
                quantity = snapshot.headerMappings.quantity,
                unitPrice = snapshot.headerMappings.unitPrice,
                grossAmount = snapshot.headerMappings.grossAmount,
                feeAmount = snapshot.headerMappings.feeAmount,
                taxAmount = snapshot.headerMappings.taxAmount,
                currency = snapshot.headerMappings.currency,
                fxRateToPln = snapshot.headerMappings.fxRateToPln,
                notes = snapshot.headerMappings.notes
            ),
            defaults = TransactionImportDefaultsResponse(
                accountId = snapshot.defaults.accountId,
                currency = snapshot.defaults.currency
            ),
            createdAt = snapshot.createdAt,
            updatedAt = snapshot.updatedAt
        )
    },
    transactions = transactions.map { snapshot ->
        TransactionSnapshotResponse(
            id = snapshot.id,
            accountId = snapshot.accountId,
            instrumentId = snapshot.instrumentId,
            type = snapshot.type,
            tradeDate = snapshot.tradeDate,
            settlementDate = snapshot.settlementDate,
            quantity = snapshot.quantity,
            unitPrice = snapshot.unitPrice,
            grossAmount = snapshot.grossAmount,
            feeAmount = snapshot.feeAmount,
            taxAmount = snapshot.taxAmount,
            currency = snapshot.currency,
            fxRateToPln = snapshot.fxRateToPln,
            notes = snapshot.notes,
            createdAt = snapshot.createdAt,
            updatedAt = snapshot.updatedAt
        )
    }
)

private fun ImportPortfolioStateRequest.toDomain(): PortfolioImportRequest = PortfolioImportRequest(
    mode = try {
        ImportMode.valueOf(mode)
    } catch (_: IllegalArgumentException) {
        throw IllegalArgumentException("mode must be one of ${ImportMode.entries.joinToString()}.")
    },
    snapshot = PortfolioSnapshot(
        schemaVersion = snapshot.schemaVersion,
        exportedAt = snapshot.exportedAt.toInstantOrThrow("snapshot.exportedAt"),
        accounts = snapshot.accounts.map { account ->
            net.bobinski.portfolio.api.domain.service.AccountSnapshot(
                id = account.id,
                name = account.name,
                institution = account.institution,
                type = account.type,
                baseCurrency = account.baseCurrency,
                displayOrder = account.displayOrder,
                isActive = account.isActive,
                createdAt = account.createdAt,
                updatedAt = account.updatedAt
            )
        },
        appPreferences = snapshot.appPreferences.map { preference ->
            net.bobinski.portfolio.api.domain.service.AppPreferenceSnapshot(
                key = preference.key,
                valueJson = preference.valueJson,
                updatedAt = preference.updatedAt
            )
        },
        instruments = snapshot.instruments.map { instrument ->
            net.bobinski.portfolio.api.domain.service.InstrumentSnapshot(
                id = instrument.id,
                name = instrument.name,
                kind = instrument.kind,
                assetClass = instrument.assetClass,
                symbol = instrument.symbol,
                currency = instrument.currency,
                valuationSource = instrument.valuationSource,
                edoTerms = instrument.edoTerms?.let { terms ->
                    net.bobinski.portfolio.api.domain.service.EdoTermsSnapshot(
                        seriesMonth = terms.seriesMonth,
                        firstPeriodRateBps = terms.firstPeriodRateBps,
                        marginBps = terms.marginBps
                    )
                },
                isActive = instrument.isActive,
                createdAt = instrument.createdAt,
                updatedAt = instrument.updatedAt
            )
        },
        targets = snapshot.targets.map { target ->
            net.bobinski.portfolio.api.domain.service.PortfolioTargetSnapshot(
                id = target.id,
                assetClass = target.assetClass,
                targetWeight = target.targetWeight,
                createdAt = target.createdAt,
                updatedAt = target.updatedAt
            )
        },
        importProfiles = snapshot.importProfiles.map { profile ->
            net.bobinski.portfolio.api.domain.service.TransactionImportProfileSnapshot(
                id = profile.id,
                name = profile.name,
                description = profile.description,
                delimiter = profile.delimiter,
                dateFormat = profile.dateFormat,
                decimalSeparator = profile.decimalSeparator,
                skipDuplicatesByDefault = profile.skipDuplicatesByDefault,
                headerMappings = net.bobinski.portfolio.api.domain.model.TransactionImportHeaderMappings(
                    account = profile.headerMappings.account,
                    type = profile.headerMappings.type,
                    tradeDate = profile.headerMappings.tradeDate,
                    settlementDate = profile.headerMappings.settlementDate,
                    instrument = profile.headerMappings.instrument,
                    quantity = profile.headerMappings.quantity,
                    unitPrice = profile.headerMappings.unitPrice,
                    grossAmount = profile.headerMappings.grossAmount,
                    feeAmount = profile.headerMappings.feeAmount,
                    taxAmount = profile.headerMappings.taxAmount,
                    currency = profile.headerMappings.currency,
                    fxRateToPln = profile.headerMappings.fxRateToPln,
                    notes = profile.headerMappings.notes
                ),
                defaults = net.bobinski.portfolio.api.domain.model.TransactionImportDefaults(
                    accountId = profile.defaults.accountId,
                    currency = profile.defaults.currency
                ),
                createdAt = profile.createdAt,
                updatedAt = profile.updatedAt
            )
        },
        transactions = snapshot.transactions.map { transaction ->
            net.bobinski.portfolio.api.domain.service.TransactionSnapshot(
                id = transaction.id,
                accountId = transaction.accountId,
                instrumentId = transaction.instrumentId,
                type = transaction.type,
                tradeDate = transaction.tradeDate,
                settlementDate = transaction.settlementDate,
                quantity = transaction.quantity,
                unitPrice = transaction.unitPrice,
                grossAmount = transaction.grossAmount,
                feeAmount = transaction.feeAmount,
                taxAmount = transaction.taxAmount,
                currency = transaction.currency,
                fxRateToPln = transaction.fxRateToPln,
                notes = transaction.notes,
                createdAt = transaction.createdAt,
                updatedAt = transaction.updatedAt
            )
        }
    )
)

private fun net.bobinski.portfolio.api.domain.service.PortfolioImportResult.toResponse(): PortfolioImportResultResponse =
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

private fun PortfolioImportPreview.toResponse(): PortfolioImportPreviewResponse =
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
        issues = issues.map(PortfolioImportIssue::toResponse)
    )

private fun PortfolioImportIssue.toResponse(): PortfolioImportIssueResponse = PortfolioImportIssueResponse(
    severity = severity.name,
    code = code,
    message = message
)

private fun RestorePortfolioBackupRequest.toDomain(): PortfolioBackupRestoreRequest = PortfolioBackupRestoreRequest(
    fileName = fileName,
    mode = try {
        ImportMode.valueOf(mode)
    } catch (_: IllegalArgumentException) {
        throw IllegalArgumentException("mode must be one of ${ImportMode.entries.joinToString()}.")
    }
)

private fun net.bobinski.portfolio.api.domain.service.PortfolioBackupRestoreResult.toResponse():
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

private fun requireReplaceConfirmation(mode: String, confirmation: String?) {
    if (mode.trim().uppercase() != ImportMode.REPLACE.name) {
        return
    }
    require(confirmation?.trim()?.uppercase() == ImportMode.REPLACE.name) {
        "REPLACE operations require confirmation set to REPLACE."
    }
}

private fun String.toInstantOrThrow(field: String): java.time.Instant = try {
    java.time.Instant.parse(this)
} catch (_: java.time.format.DateTimeParseException) {
    throw IllegalArgumentException("$field must use ISO-8601 instant format.")
}

private fun parseAuditEventCategory(value: String): AuditEventCategory = try {
    AuditEventCategory.valueOf(value.uppercase())
} catch (_: IllegalArgumentException) {
    throw IllegalArgumentException(
        "category must be one of ${AuditEventCategory.entries.joinToString()}."
    )
}
