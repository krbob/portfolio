package net.bobinski.portfolio.api.route

import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import net.bobinski.portfolio.api.domain.service.PortfolioAllocationService
import net.bobinski.portfolio.api.domain.service.PortfolioHistoryService
import net.bobinski.portfolio.api.domain.service.PortfolioReadModelCacheDescriptorService
import net.bobinski.portfolio.api.domain.service.PortfolioReadModelService
import net.bobinski.portfolio.api.domain.service.PortfolioReturnsService
import net.bobinski.portfolio.api.domain.service.ReadModelCacheService

internal fun Route.registerPortfolioReadModelRoutes(
    portfolioReadModelService: PortfolioReadModelService,
) {
    get("/overview") {
        call.respond(portfolioReadModelService.overview().toResponse())
    }.documented(
        operationId = "getPortfolioOverview",
        summary = "Get portfolio overview",
        description = "Returns the current overview totals, valuation basis and top-level portfolio metrics.",
        tag = "Portfolio"
    )

    get("/holdings") {
        call.respond(portfolioReadModelService.holdings().map { it.toResponse() })
    }.documented(
        operationId = "listPortfolioHoldings",
        summary = "List portfolio holdings",
        description = "Returns current holdings with valuation, gains and optional EDO lot details.",
        tag = "Portfolio"
    )

    get("/accounts") {
        call.respond(portfolioReadModelService.accounts().map { it.toResponse() })
    }.documented(
        operationId = "listPortfolioAccounts",
        summary = "List portfolio account summaries",
        description = "Returns read-model account summaries with balances, valuation status and allocation details.",
        tag = "Portfolio"
    )
}

internal fun Route.registerPortfolioAnalyticsRoutes(
    readModelCacheService: ReadModelCacheService,
    portfolioReadModelCacheDescriptorService: PortfolioReadModelCacheDescriptorService,
    portfolioAllocationService: PortfolioAllocationService,
    portfolioHistoryService: PortfolioHistoryService,
    portfolioReturnsService: PortfolioReturnsService,
) {
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
    }.documented(
        operationId = "getPortfolioDailyHistory",
        summary = "Get daily portfolio history",
        description = "Returns the cached or freshly computed daily portfolio history read model.",
        tag = "Portfolio"
    )

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
    }.documented(
        operationId = "getPortfolioReturns",
        summary = "Get portfolio returns",
        description = "Returns aggregated portfolio return metrics and benchmark comparisons.",
        tag = "Portfolio"
    )

    get("/allocation") {
        call.respond(portfolioAllocationService.summary().toResponse())
    }.documented(
        operationId = "getPortfolioAllocation",
        summary = "Get allocation summary",
        description = "Returns current allocation, target mix drift and rebalancing guidance.",
        tag = "Portfolio"
    )
}
