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
import net.bobinski.portfolio.api.domain.model.AuditEventCategory
import net.bobinski.portfolio.api.domain.service.AuditLogService
import net.bobinski.portfolio.api.domain.service.BackupTrigger
import net.bobinski.portfolio.api.domain.service.ImportMode
import net.bobinski.portfolio.api.domain.service.PortfolioBackupService
import net.bobinski.portfolio.api.domain.service.PortfolioTransferService
import net.bobinski.portfolio.api.domain.service.ReadModelCacheService
import net.bobinski.portfolio.api.marketdata.service.MarketDataSnapshotCacheService
import net.bobinski.portfolio.api.readmodel.ReadModelRefreshService
import kotlin.reflect.typeOf

internal fun Route.registerPortfolioDiagnosticsRoutes(
    readModelCacheService: ReadModelCacheService,
    marketDataSnapshotCacheService: MarketDataSnapshotCacheService,
    readModelRefreshService: ReadModelRefreshService,
    auditLogService: AuditLogService,
) {
    get("/read-model-cache") {
        call.respond(readModelCacheService.list().map { it.toResponse() })
    }.documented(
        operationId = "listReadModelCacheSnapshots",
        summary = "List read-model cache snapshots",
        description = "Returns cached read-model snapshots and their invalidation metadata.",
        tag = "Portfolio"
    )

    get("/market-data-snapshots") {
        call.respond(marketDataSnapshotCacheService.listSnapshots().map { it.toResponse() })
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
        call.respond(ReadModelCacheInvalidationResponse(clearedSnapshotCount = clearedSnapshotCount))
    }.documented(
        operationId = "invalidateReadModelCache",
        summary = "Invalidate read-model cache",
        description = "Clears all cached read-model snapshots so they are rebuilt on the next access.",
        tag = "Portfolio"
    )
}

internal fun Route.registerPortfolioAuditRoutes(
    auditLogService: AuditLogService,
) {
    get("/audit/events") {
        val limit = call.request.queryParameters["limit"]?.toIntOrNull() ?: 12
        val category = call.request.queryParameters["category"]?.let(::parseAuditEventCategory)
        call.respond(auditLogService.list(limit = limit, category = category).map { it.toResponse() })
    }.documented(
        operationId = "listPortfolioAuditEvents",
        summary = "List portfolio audit events",
        description = "Returns recent operational audit events with optional category filtering.",
        tag = "Portfolio"
    )
}

internal fun Route.registerPortfolioBackupRoutes(
    portfolioBackupService: PortfolioBackupService,
) {
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
}

internal fun Route.registerPortfolioStateTransferRoutes(
    portfolioTransferService: PortfolioTransferService,
    portfolioBackupService: PortfolioBackupService,
) {
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
