package net.bobinski.portfolio.api.route

import io.ktor.server.routing.Route
import io.ktor.server.routing.route
import net.bobinski.portfolio.api.domain.service.AuditLogService
import net.bobinski.portfolio.api.domain.service.PortfolioBackupService
import net.bobinski.portfolio.api.domain.service.PortfolioTransferService
import net.bobinski.portfolio.api.domain.service.ReadModelCacheService
import net.bobinski.portfolio.api.marketdata.service.MarketDataSnapshotCacheService
import net.bobinski.portfolio.api.readmodel.ReadModelRefreshService
import org.koin.ktor.ext.inject

fun Route.portfolioOperationsRoute() {
    val readModelCacheService: ReadModelCacheService by inject()
    val portfolioTransferService: PortfolioTransferService by inject()
    val portfolioBackupService: PortfolioBackupService by inject()
    val readModelRefreshService: ReadModelRefreshService by inject()
    val marketDataSnapshotCacheService: MarketDataSnapshotCacheService by inject()
    val auditLogService: AuditLogService by inject()

    route("/v1/portfolio") {
        registerPortfolioDiagnosticsRoutes(
            readModelCacheService = readModelCacheService,
            marketDataSnapshotCacheService = marketDataSnapshotCacheService,
            readModelRefreshService = readModelRefreshService,
            auditLogService = auditLogService,
        )
        registerPortfolioAuditRoutes(
            auditLogService = auditLogService,
        )
        registerPortfolioBackupRoutes(
            portfolioBackupService = portfolioBackupService,
        )
        registerPortfolioStateTransferRoutes(
            portfolioTransferService = portfolioTransferService,
            portfolioBackupService = portfolioBackupService,
        )
    }
}
