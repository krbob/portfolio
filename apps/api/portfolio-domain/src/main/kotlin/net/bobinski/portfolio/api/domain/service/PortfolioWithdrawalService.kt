package net.bobinski.portfolio.api.domain.service

import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope

/** Coordinates current read models and preferences for a non-mutating withdrawal preview. */
class PortfolioWithdrawalService(
    private val portfolioReadModelService: PortfolioReadModelService,
    private val portfolioTargetService: PortfolioTargetService,
    private val portfolioWithdrawalSettingsService: PortfolioWithdrawalSettingsService,
    private val portfolioWithdrawalPlanningService: PortfolioWithdrawalPlanningService
) {
    suspend fun plan(command: PortfolioWithdrawalPlanCommand): PortfolioWithdrawalPlan = coroutineScope {
        val overviewDeferred = async { portfolioReadModelService.overview() }
        val accountsDeferred = async { portfolioReadModelService.accounts() }
        val holdingsDeferred = async { portfolioReadModelService.holdings() }
        val settingsDeferred = async { portfolioWithdrawalSettingsService.settings() }

        val overview = overviewDeferred.await()
        portfolioWithdrawalPlanningService.plan(
            command = command,
            overview = overview,
            accounts = accountsDeferred.await(),
            holdings = holdingsDeferred.await(),
            targets = portfolioTargetService.targetAt(overview.asOf),
            settings = settingsDeferred.await()
        )
    }
}
