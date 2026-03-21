package net.bobinski.portfolio.api.route

import io.ktor.http.ContentDisposition
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.server.response.header
import io.ktor.server.response.respond
import io.ktor.server.response.respondText
import io.ktor.server.request.receive
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.route
import kotlinx.serialization.Serializable
import net.bobinski.portfolio.api.domain.service.HoldingSnapshot
import net.bobinski.portfolio.api.domain.model.AssetClass
import net.bobinski.portfolio.api.domain.model.AuditEvent
import net.bobinski.portfolio.api.domain.model.AuditEventCategory
import net.bobinski.portfolio.api.domain.service.PortfolioAllocationBucket
import net.bobinski.portfolio.api.domain.service.PortfolioAllocationService
import net.bobinski.portfolio.api.domain.service.PortfolioAllocationSummary
import net.bobinski.portfolio.api.domain.service.AuditLogService
import net.bobinski.portfolio.api.domain.service.PortfolioBackupRecord
import net.bobinski.portfolio.api.domain.service.PortfolioBackupRestoreRequest
import net.bobinski.portfolio.api.domain.service.PortfolioBackupService
import net.bobinski.portfolio.api.domain.service.PortfolioBackupStatus
import net.bobinski.portfolio.api.domain.service.BackupTrigger
import net.bobinski.portfolio.api.domain.service.PortfolioDailyHistory
import net.bobinski.portfolio.api.domain.service.PortfolioDailyHistoryPoint
import net.bobinski.portfolio.api.domain.service.PortfolioHistoryService
import net.bobinski.portfolio.api.domain.service.PortfolioImportIssue
import net.bobinski.portfolio.api.domain.service.PortfolioOverview
import net.bobinski.portfolio.api.domain.service.PortfolioReadModelService
import net.bobinski.portfolio.api.domain.service.PortfolioReadModelCacheDescriptorService
import net.bobinski.portfolio.api.domain.service.PortfolioRebalancingSettingsService
import net.bobinski.portfolio.api.domain.service.ReadModelCacheService
import net.bobinski.portfolio.api.domain.service.ReadModelCacheSnapshot
import net.bobinski.portfolio.api.domain.service.AllocationBucketAction
import net.bobinski.portfolio.api.domain.service.BenchmarkComparison
import net.bobinski.portfolio.api.domain.service.BenchmarkKey
import net.bobinski.portfolio.api.domain.service.BenchmarkOptionKind
import net.bobinski.portfolio.api.domain.service.PortfolioAllocationAction
import net.bobinski.portfolio.api.domain.service.PortfolioReturnPeriod
import net.bobinski.portfolio.api.domain.service.PortfolioReturns
import net.bobinski.portfolio.api.domain.service.PortfolioReturnsService
import net.bobinski.portfolio.api.domain.service.PortfolioBenchmarkSettingsService
import net.bobinski.portfolio.api.domain.service.RebalancingMode
import net.bobinski.portfolio.api.domain.service.PortfolioTargetService
import net.bobinski.portfolio.api.domain.service.PortfolioImportPreview
import net.bobinski.portfolio.api.domain.service.PortfolioSnapshot
import net.bobinski.portfolio.api.domain.service.PortfolioTransferService
import net.bobinski.portfolio.api.domain.service.PortfolioImportRequest
import net.bobinski.portfolio.api.domain.service.ImportMode
import net.bobinski.portfolio.api.domain.service.ReplacePortfolioTargetItem
import net.bobinski.portfolio.api.domain.service.ReplacePortfolioTargetsCommand
import net.bobinski.portfolio.api.domain.service.ReturnMetric
import net.bobinski.portfolio.api.domain.service.SavePortfolioBenchmarkSettingsCommand
import net.bobinski.portfolio.api.domain.service.SavePortfolioRebalancingSettingsCommand
import net.bobinski.portfolio.api.readmodel.ReadModelRefreshRunResult
import net.bobinski.portfolio.api.readmodel.ReadModelRefreshService
import net.bobinski.portfolio.api.readmodel.ReadModelRefreshStatus
import org.koin.ktor.ext.inject

fun Route.portfolioRoute() {
    val portfolioReadModelService: PortfolioReadModelService by inject()
    val readModelCacheService: ReadModelCacheService by inject()
    val portfolioReadModelCacheDescriptorService: PortfolioReadModelCacheDescriptorService by inject()
    val portfolioAllocationService: PortfolioAllocationService by inject()
    val portfolioHistoryService: PortfolioHistoryService by inject()
    val portfolioReturnsService: PortfolioReturnsService by inject()
    val portfolioBenchmarkSettingsService: PortfolioBenchmarkSettingsService by inject()
    val portfolioRebalancingSettingsService: PortfolioRebalancingSettingsService by inject()
    val portfolioTargetService: PortfolioTargetService by inject()
    val portfolioTransferService: PortfolioTransferService by inject()
    val portfolioBackupService: PortfolioBackupService by inject()
    val readModelRefreshService: ReadModelRefreshService by inject()
    val auditLogService: AuditLogService by inject()

    route("/v1/portfolio") {
        get("/overview") {
            call.respond(portfolioReadModelService.overview().toResponse())
        }

        get("/holdings") {
            call.respond(portfolioReadModelService.holdings().map { it.toResponse() })
        }

        get("/history/daily") {
            val descriptor = portfolioReadModelCacheDescriptorService.dailyHistoryDescriptor()
            call.respond(
                readModelCacheService.getOrCompute(
                    descriptor = descriptor,
                    serializer = PortfolioDailyHistoryResponse.serializer()
                ) {
                    portfolioHistoryService.dailyHistory().toResponse()
                }
            )
        }

        get("/returns") {
            val descriptor = portfolioReadModelCacheDescriptorService.returnsDescriptor()
            call.respond(
                readModelCacheService.getOrCompute(
                    descriptor = descriptor,
                    serializer = PortfolioReturnsResponse.serializer()
                ) {
                    portfolioReturnsService.returns().toResponse()
                }
            )
        }

        get("/allocation") {
            call.respond(portfolioAllocationService.summary().toResponse())
        }

        get("/read-model-cache") {
            call.respond(readModelCacheService.list().map(ReadModelCacheSnapshot::toResponse))
        }

        get("/read-model-refresh") {
            call.respond(readModelRefreshService.status().toResponse())
        }

        post("/read-model-refresh/run") {
            call.respond(readModelRefreshService.runManualRefresh().toResponse())
        }

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
        }

        get("/audit/events") {
            val limit = call.request.queryParameters["limit"]?.toIntOrNull() ?: 12
            val category = call.request.queryParameters["category"]?.let(::parseAuditEventCategory)
            call.respond(auditLogService.list(limit = limit, category = category).map(AuditEvent::toResponse))
        }

        get("/targets") {
            call.respond(portfolioTargetService.list().map { it.toResponse() })
        }

        post("/targets") {
            val request = call.receive<ReplacePortfolioTargetsRequest>()
            call.respond(portfolioTargetService.replace(request.toDomain()).map { it.toResponse() })
        }

        get("/benchmark-settings") {
            call.respond(portfolioBenchmarkSettingsService.settings().toResponse())
        }

        post("/benchmark-settings") {
            val request = call.receive<SavePortfolioBenchmarkSettingsRequest>()
            call.respond(portfolioBenchmarkSettingsService.update(request.toDomain()).toResponse())
        }

        get("/rebalancing-settings") {
            call.respond(portfolioRebalancingSettingsService.settings().toResponse())
        }

        post("/rebalancing-settings") {
            val request = call.receive<SavePortfolioRebalancingSettingsRequest>()
            call.respond(portfolioRebalancingSettingsService.update(request.toDomain()).toResponse())
        }

        get("/backups") {
            call.respond(portfolioBackupService.status().toResponse())
        }

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
        }

        post("/backups/run") {
            call.respond(portfolioBackupService.createBackup().toResponse())
        }

        post("/backups/restore") {
            val request = call.receive<RestorePortfolioBackupRequest>()
            requireReplaceConfirmation(mode = request.mode, confirmation = request.confirmation)
            call.respond(portfolioBackupService.restoreBackup(request.toDomain()).toResponse())
        }

        get("/state/export") {
            call.respond(portfolioTransferService.exportState().toResponse())
        }

        post("/state/preview") {
            val request = call.receive<ImportPortfolioStateRequest>()
            val result = portfolioTransferService.previewImport(request.toDomain())
            call.respond(result.toResponse())
        }

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
        }
    }
}

@Serializable
data class PortfolioOverviewResponse(
    val asOf: String,
    val valuationState: String,
    val totalBookValuePln: String,
    val totalCurrentValuePln: String,
    val investedBookValuePln: String,
    val investedCurrentValuePln: String,
    val cashBalancePln: String,
    val netContributionsPln: String,
    val equityBookValuePln: String,
    val equityCurrentValuePln: String,
    val bondBookValuePln: String,
    val bondCurrentValuePln: String,
    val cashBookValuePln: String,
    val cashCurrentValuePln: String,
    val totalUnrealizedGainPln: String,
    val accountCount: Int,
    val instrumentCount: Int,
    val activeHoldingCount: Int,
    val valuedHoldingCount: Int,
    val unvaluedHoldingCount: Int,
    val valuationIssueCount: Int,
    val missingFxTransactions: Int,
    val unsupportedCorrectionTransactions: Int
)

@Serializable
data class HoldingResponse(
    val accountId: String,
    val accountName: String,
    val instrumentId: String,
    val instrumentName: String,
    val kind: String,
    val assetClass: String,
    val currency: String,
    val quantity: String,
    val averageCostPerUnitPln: String,
    val costBasisPln: String,
    val bookValuePln: String,
    val currentPricePln: String?,
    val currentValuePln: String?,
    val unrealizedGainPln: String?,
    val valuedAt: String?,
    val valuationStatus: String,
    val valuationIssue: String?,
    val transactionCount: Int
)

@Serializable
data class PortfolioDailyHistoryResponse(
    val from: String,
    val until: String,
    val valuationState: String,
    val instrumentHistoryIssueCount: Int,
    val referenceSeriesIssueCount: Int,
    val benchmarkSeriesIssueCount: Int,
    val missingFxTransactions: Int,
    val unsupportedCorrectionTransactions: Int,
    val points: List<PortfolioDailyHistoryPointResponse>
)

@Serializable
data class PortfolioDailyHistoryPointResponse(
    val date: String,
    val totalBookValuePln: String,
    val totalCurrentValuePln: String,
    val netContributionsPln: String,
    val cashBalancePln: String,
    val totalCurrentValueUsd: String?,
    val netContributionsUsd: String?,
    val cashBalanceUsd: String?,
    val totalCurrentValueAu: String?,
    val netContributionsAu: String?,
    val cashBalanceAu: String?,
    val equityCurrentValuePln: String,
    val bondCurrentValuePln: String,
    val cashCurrentValuePln: String,
    val equityAllocationPct: String,
    val bondAllocationPct: String,
    val cashAllocationPct: String,
    val portfolioPerformanceIndex: String?,
    val equityBenchmarkIndex: String?,
    val inflationBenchmarkIndex: String?,
    val targetMixBenchmarkIndex: String?,
    val activeHoldingCount: Int,
    val valuedHoldingCount: Int
)

@Serializable
data class PortfolioReturnsResponse(
    val asOf: String,
    val periods: List<PortfolioReturnPeriodResponse>
)

@Serializable
data class PortfolioTargetResponse(
    val id: String,
    val assetClass: String,
    val targetWeight: String,
    val createdAt: String,
    val updatedAt: String
)

@Serializable
data class ReplacePortfolioTargetsRequest(
    val items: List<PortfolioTargetRequestItem>
)

@Serializable
data class PortfolioTargetRequestItem(
    val assetClass: String,
    val targetWeight: String
)

@Serializable
data class PortfolioAllocationResponse(
    val asOf: String,
    val valuationState: String,
    val configured: Boolean,
    val toleranceBandPctPoints: String,
    val rebalancingMode: String,
    val targetWeightSumPct: String,
    val totalCurrentValuePln: String,
    val availableCashPln: String,
    val breachedBucketCount: Int,
    val largestBandBreachPctPoints: String?,
    val recommendedAction: String,
    val recommendedAssetClass: String?,
    val recommendedContributionPln: String,
    val remainingContributionGapPln: String,
    val fullRebalanceBuyAmountPln: String,
    val fullRebalanceSellAmountPln: String,
    val requiresSelling: Boolean,
    val buckets: List<PortfolioAllocationBucketResponse>
)

@Serializable
data class PortfolioAllocationBucketResponse(
    val assetClass: String,
    val currentValuePln: String,
    val currentWeightPct: String,
    val targetWeightPct: String?,
    val targetValuePln: String?,
    val driftPctPoints: String?,
    val gapValuePln: String?,
    val toleranceLowerPct: String?,
    val toleranceUpperPct: String?,
    val withinTolerance: Boolean,
    val suggestedContributionPln: String,
    val rebalanceAction: String,
    val status: String
)

@Serializable
data class PortfolioReturnPeriodResponse(
    val key: String,
    val label: String,
    val requestedFrom: String,
    val from: String,
    val until: String,
    val clippedToInception: Boolean,
    val dayCount: Long,
    val nominalPln: ReturnMetricResponse?,
    val nominalUsd: ReturnMetricResponse?,
    val realPln: ReturnMetricResponse?,
    val inflationFrom: String?,
    val inflationUntil: String?,
    val inflationMultiplier: String?,
    val benchmarks: Array<BenchmarkComparisonResponse>
)

@Serializable
data class ReturnMetricResponse(
    val moneyWeightedReturn: String,
    val annualizedMoneyWeightedReturn: String?,
    val timeWeightedReturn: String?,
    val annualizedTimeWeightedReturn: String?
)

@Serializable
data class BenchmarkComparisonResponse(
    val key: String,
    val label: String,
    val pinned: Boolean,
    val nominalPln: ReturnMetricResponse?,
    val excessTimeWeightedReturn: String?,
    val excessAnnualizedTimeWeightedReturn: String?
)

@Serializable
data class PortfolioBenchmarkSettingsResponse(
    val enabledKeys: List<String>,
    val pinnedKeys: List<String>,
    val customLabel: String?,
    val customSymbol: String?,
    val options: List<BenchmarkOptionResponse>
)

@Serializable
data class BenchmarkOptionResponse(
    val key: String,
    val label: String,
    val symbol: String?,
    val kind: String,
    val configurable: Boolean,
    val defaultEnabled: Boolean,
    val defaultPinned: Boolean
)

@Serializable
data class SavePortfolioBenchmarkSettingsRequest(
    val enabledKeys: List<String>,
    val pinnedKeys: List<String>,
    val customLabel: String? = null,
    val customSymbol: String? = null
)

@Serializable
data class PortfolioRebalancingSettingsResponse(
    val toleranceBandPctPoints: String,
    val mode: String
)

@Serializable
data class SavePortfolioRebalancingSettingsRequest(
    val toleranceBandPctPoints: String,
    val mode: String
)

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
    val purchaseDate: String,
    val firstPeriodRateBps: Int,
    val marginBps: Int,
    val principalUnits: Int,
    val maturityDate: String
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

private fun PortfolioOverview.toResponse(): PortfolioOverviewResponse = PortfolioOverviewResponse(
    asOf = asOf.toString(),
    valuationState = valuationState.name,
    totalBookValuePln = totalBookValuePln.toPlainString(),
    totalCurrentValuePln = totalCurrentValuePln.toPlainString(),
    investedBookValuePln = investedBookValuePln.toPlainString(),
    investedCurrentValuePln = investedCurrentValuePln.toPlainString(),
    cashBalancePln = cashBalancePln.toPlainString(),
    netContributionsPln = netContributionsPln.toPlainString(),
    equityBookValuePln = equityBookValuePln.toPlainString(),
    equityCurrentValuePln = equityCurrentValuePln.toPlainString(),
    bondBookValuePln = bondBookValuePln.toPlainString(),
    bondCurrentValuePln = bondCurrentValuePln.toPlainString(),
    cashBookValuePln = cashBookValuePln.toPlainString(),
    cashCurrentValuePln = cashCurrentValuePln.toPlainString(),
    totalUnrealizedGainPln = totalUnrealizedGainPln.toPlainString(),
    accountCount = accountCount,
    instrumentCount = instrumentCount,
    activeHoldingCount = activeHoldingCount,
    valuedHoldingCount = valuedHoldingCount,
    unvaluedHoldingCount = unvaluedHoldingCount,
    valuationIssueCount = valuationIssueCount,
    missingFxTransactions = missingFxTransactions,
    unsupportedCorrectionTransactions = unsupportedCorrectionTransactions
)

private fun HoldingSnapshot.toResponse(): HoldingResponse = HoldingResponse(
    accountId = accountId.toString(),
    accountName = accountName,
    instrumentId = instrumentId.toString(),
    instrumentName = instrumentName,
    kind = kind,
    assetClass = assetClass,
    currency = currency,
    quantity = quantity.toPlainString(),
    averageCostPerUnitPln = averageCostPerUnitPln.toPlainString(),
    costBasisPln = costBasisPln.toPlainString(),
    bookValuePln = bookValuePln.toPlainString(),
    currentPricePln = currentPricePln?.toPlainString(),
    currentValuePln = currentValuePln?.toPlainString(),
    unrealizedGainPln = unrealizedGainPln?.toPlainString(),
    valuedAt = valuedAt?.toString(),
    valuationStatus = valuationStatus.name,
    valuationIssue = valuationIssue,
    transactionCount = transactionCount
)

private fun PortfolioDailyHistory.toResponse(): PortfolioDailyHistoryResponse = PortfolioDailyHistoryResponse(
    from = from.toString(),
    until = until.toString(),
    valuationState = valuationState.name,
    instrumentHistoryIssueCount = instrumentHistoryIssueCount,
    referenceSeriesIssueCount = referenceSeriesIssueCount,
    benchmarkSeriesIssueCount = benchmarkSeriesIssueCount,
    missingFxTransactions = missingFxTransactions,
    unsupportedCorrectionTransactions = unsupportedCorrectionTransactions,
    points = points.map { it.toResponse() }
)

private fun PortfolioDailyHistoryPoint.toResponse(): PortfolioDailyHistoryPointResponse = PortfolioDailyHistoryPointResponse(
    date = date.toString(),
    totalBookValuePln = totalBookValuePln.toPlainString(),
    totalCurrentValuePln = totalCurrentValuePln.toPlainString(),
    netContributionsPln = netContributionsPln.toPlainString(),
    cashBalancePln = cashBalancePln.toPlainString(),
    totalCurrentValueUsd = totalCurrentValueUsd?.toPlainString(),
    netContributionsUsd = netContributionsUsd?.toPlainString(),
    cashBalanceUsd = cashBalanceUsd?.toPlainString(),
    totalCurrentValueAu = totalCurrentValueAu?.toPlainString(),
    netContributionsAu = netContributionsAu?.toPlainString(),
    cashBalanceAu = cashBalanceAu?.toPlainString(),
    equityCurrentValuePln = equityCurrentValuePln.toPlainString(),
    bondCurrentValuePln = bondCurrentValuePln.toPlainString(),
    cashCurrentValuePln = cashCurrentValuePln.toPlainString(),
    equityAllocationPct = equityAllocationPct.toPlainString(),
    bondAllocationPct = bondAllocationPct.toPlainString(),
    cashAllocationPct = cashAllocationPct.toPlainString(),
    portfolioPerformanceIndex = portfolioPerformanceIndex?.toPlainString(),
    equityBenchmarkIndex = equityBenchmarkIndex?.toPlainString(),
    inflationBenchmarkIndex = inflationBenchmarkIndex?.toPlainString(),
    targetMixBenchmarkIndex = targetMixBenchmarkIndex?.toPlainString(),
    activeHoldingCount = activeHoldingCount,
    valuedHoldingCount = valuedHoldingCount
)

private fun PortfolioReturns.toResponse(): PortfolioReturnsResponse = PortfolioReturnsResponse(
    asOf = asOf.toString(),
    periods = periods.map { it.toResponse() }
)

private fun net.bobinski.portfolio.api.domain.model.PortfolioTarget.toResponse(): PortfolioTargetResponse =
    PortfolioTargetResponse(
        id = id.toString(),
        assetClass = assetClass.name,
        targetWeight = targetWeight.toPlainString(),
        createdAt = createdAt.toString(),
        updatedAt = updatedAt.toString()
    )

private fun ReplacePortfolioTargetsRequest.toDomain() = ReplacePortfolioTargetsCommand(
    items = items.map { item ->
        ReplacePortfolioTargetItem(
            assetClass = AssetClass.valueOf(item.assetClass),
            targetWeight = item.targetWeight.toBigDecimal()
        )
    }
)

private fun PortfolioAllocationSummary.toResponse(): PortfolioAllocationResponse = PortfolioAllocationResponse(
    asOf = asOf.toString(),
    valuationState = valuationState.name,
    configured = configured,
    toleranceBandPctPoints = toleranceBandPctPoints.toPlainString(),
    rebalancingMode = rebalancingMode.name,
    targetWeightSumPct = targetWeightSumPct.toPlainString(),
    totalCurrentValuePln = totalCurrentValuePln.toPlainString(),
    availableCashPln = availableCashPln.toPlainString(),
    breachedBucketCount = breachedBucketCount,
    largestBandBreachPctPoints = largestBandBreachPctPoints?.toPlainString(),
    recommendedAction = recommendedAction.name,
    recommendedAssetClass = recommendedAssetClass?.name,
    recommendedContributionPln = recommendedContributionPln.toPlainString(),
    remainingContributionGapPln = remainingContributionGapPln.toPlainString(),
    fullRebalanceBuyAmountPln = fullRebalanceBuyAmountPln.toPlainString(),
    fullRebalanceSellAmountPln = fullRebalanceSellAmountPln.toPlainString(),
    requiresSelling = requiresSelling,
    buckets = buckets.map { it.toResponse() }
)

private fun PortfolioAllocationBucket.toResponse(): PortfolioAllocationBucketResponse = PortfolioAllocationBucketResponse(
    assetClass = assetClass.name,
    currentValuePln = currentValuePln.toPlainString(),
    currentWeightPct = currentWeightPct.toPlainString(),
    targetWeightPct = targetWeightPct?.toPlainString(),
    targetValuePln = targetValuePln?.toPlainString(),
    driftPctPoints = driftPctPoints?.toPlainString(),
    gapValuePln = gapValuePln?.toPlainString(),
    toleranceLowerPct = toleranceLowerPct?.toPlainString(),
    toleranceUpperPct = toleranceUpperPct?.toPlainString(),
    withinTolerance = withinTolerance,
    suggestedContributionPln = suggestedContributionPln.toPlainString(),
    rebalanceAction = rebalanceAction.name,
    status = status.name
)

private fun PortfolioReturnPeriod.toResponse(): PortfolioReturnPeriodResponse = PortfolioReturnPeriodResponse(
    key = key.name,
    label = label,
    requestedFrom = requestedFrom.toString(),
    from = from.toString(),
    until = until.toString(),
    clippedToInception = clippedToInception,
    dayCount = dayCount,
    nominalPln = nominalPln?.toResponse(),
    nominalUsd = nominalUsd?.toResponse(),
    realPln = realPln?.toResponse(),
    inflationFrom = inflation?.from?.toString(),
    inflationUntil = inflation?.until?.toString(),
    inflationMultiplier = inflation?.multiplier?.toPlainString(),
    benchmarks = benchmarks.map { it.toResponse() }.toTypedArray()
)

private fun ReturnMetric.toResponse(): ReturnMetricResponse = ReturnMetricResponse(
    moneyWeightedReturn = moneyWeightedReturn.toPlainString(),
    annualizedMoneyWeightedReturn = annualizedMoneyWeightedReturn?.toPlainString(),
    timeWeightedReturn = timeWeightedReturn?.toPlainString(),
    annualizedTimeWeightedReturn = annualizedTimeWeightedReturn?.toPlainString()
)

private fun BenchmarkComparison.toResponse(): BenchmarkComparisonResponse = BenchmarkComparisonResponse(
    key = key.name,
    label = label,
    pinned = pinned,
    nominalPln = nominalPln?.toResponse(),
    excessTimeWeightedReturn = excessTimeWeightedReturn?.toPlainString(),
    excessAnnualizedTimeWeightedReturn = excessAnnualizedTimeWeightedReturn?.toPlainString()
)

private fun net.bobinski.portfolio.api.domain.service.PortfolioBenchmarkSettings.toResponse(): PortfolioBenchmarkSettingsResponse =
    PortfolioBenchmarkSettingsResponse(
        enabledKeys = enabledKeys.map(BenchmarkKey::name),
        pinnedKeys = pinnedKeys.map(BenchmarkKey::name),
        customLabel = customLabel,
        customSymbol = customSymbol,
        options = options.map { option ->
            BenchmarkOptionResponse(
                key = option.key.name,
                label = option.label,
                symbol = option.symbol,
                kind = option.kind.name,
                configurable = option.configurable,
                defaultEnabled = option.defaultEnabled,
                defaultPinned = option.defaultPinned
            )
        }
    )

private fun net.bobinski.portfolio.api.domain.service.PortfolioRebalancingSettings.toResponse(): PortfolioRebalancingSettingsResponse =
    PortfolioRebalancingSettingsResponse(
        toleranceBandPctPoints = toleranceBandPctPoints.toPlainString(),
        mode = mode.name
    )

private fun SavePortfolioRebalancingSettingsRequest.toDomain(): SavePortfolioRebalancingSettingsCommand =
    SavePortfolioRebalancingSettingsCommand(
        toleranceBandPctPoints = toleranceBandPctPoints.toBigDecimal(),
        mode = parseRebalancingMode(mode)
    )

private fun SavePortfolioBenchmarkSettingsRequest.toDomain(): SavePortfolioBenchmarkSettingsCommand =
    SavePortfolioBenchmarkSettingsCommand(
        enabledKeys = enabledKeys.map(::parseBenchmarkKey),
        pinnedKeys = pinnedKeys.map(::parseBenchmarkKey),
        customLabel = customLabel,
        customSymbol = customSymbol
    )

private fun parseBenchmarkKey(value: String): BenchmarkKey = try {
    BenchmarkKey.valueOf(value.uppercase())
} catch (_: IllegalArgumentException) {
    throw IllegalArgumentException("Unsupported benchmark key: $value")
}

private fun parseRebalancingMode(value: String): RebalancingMode = try {
    RebalancingMode.valueOf(value.uppercase())
} catch (_: IllegalArgumentException) {
    throw IllegalArgumentException("Unsupported rebalancing mode: $value")
}

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
                    purchaseDate = terms.purchaseDate,
                    firstPeriodRateBps = terms.firstPeriodRateBps,
                    marginBps = terms.marginBps,
                    principalUnits = terms.principalUnits,
                    maturityDate = terms.maturityDate
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
                        purchaseDate = terms.purchaseDate,
                        firstPeriodRateBps = terms.firstPeriodRateBps,
                        marginBps = terms.marginBps,
                        principalUnits = terms.principalUnits,
                        maturityDate = terms.maturityDate
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
