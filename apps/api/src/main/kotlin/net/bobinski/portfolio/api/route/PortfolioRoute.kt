package net.bobinski.portfolio.api.route

import io.ktor.server.routing.Route
import io.ktor.server.routing.route
import net.bobinski.portfolio.api.domain.service.PortfolioAllocationService
import net.bobinski.portfolio.api.domain.service.PortfolioHistoryService
import net.bobinski.portfolio.api.domain.service.PortfolioReadModelCacheDescriptorService
import net.bobinski.portfolio.api.domain.service.PortfolioReadModelService
import net.bobinski.portfolio.api.domain.service.PortfolioReturnsService
import net.bobinski.portfolio.api.domain.service.ReadModelCacheService
import org.koin.ktor.ext.inject

fun Route.portfolioRoute() {
    val portfolioReadModelService: PortfolioReadModelService by inject()
    val readModelCacheService: ReadModelCacheService by inject()
    val portfolioReadModelCacheDescriptorService: PortfolioReadModelCacheDescriptorService by inject()
    val portfolioAllocationService: PortfolioAllocationService by inject()
    val portfolioHistoryService: PortfolioHistoryService by inject()
    val portfolioReturnsService: PortfolioReturnsService by inject()

    route("/v1/portfolio") {
        registerPortfolioReadModelRoutes(
            portfolioReadModelService = portfolioReadModelService,
        )
        registerPortfolioAnalyticsRoutes(
            readModelCacheService = readModelCacheService,
            portfolioReadModelCacheDescriptorService = portfolioReadModelCacheDescriptorService,
            portfolioAllocationService = portfolioAllocationService,
            portfolioHistoryService = portfolioHistoryService,
            portfolioReturnsService = portfolioReturnsService,
        )
    }
}
