package net.bobinski.portfolio.api.route

import io.ktor.server.application.ApplicationCall
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import java.math.BigDecimal
import java.math.RoundingMode
import kotlinx.serialization.Serializable
import net.bobinski.portfolio.api.domain.model.AssetClass
import kotlin.text.toBigDecimalOrNull
import net.bobinski.portfolio.api.domain.service.PortfolioAllocationService
import net.bobinski.portfolio.api.domain.service.PortfolioHistoryService
import net.bobinski.portfolio.api.domain.service.PortfolioReadModelCacheDescriptorService
import net.bobinski.portfolio.api.domain.service.PortfolioReadModelService
import net.bobinski.portfolio.api.domain.service.PortfolioReturnsService
import net.bobinski.portfolio.api.domain.service.ValuationState
import net.bobinski.portfolio.api.readmodel.isPortfolioAnalyticsHistoryPreferredForCache
import net.bobinski.portfolio.api.readmodel.isPreferredForCache
import net.bobinski.portfolio.api.readmodel.PortfolioOverviewSnapshotService
import net.bobinski.portfolio.api.readmodel.ReadModelSnapshotService
import net.bobinski.portfolio.api.readmodel.SnapshotCandidate

internal fun Route.registerPortfolioReadModelRoutes(
    portfolioReadModelService: PortfolioReadModelService,
    portfolioOverviewSnapshotService: PortfolioOverviewSnapshotService,
) {
    get("/overview") {
        val preferCached = call.request.queryParameters["preferCached"]?.let { value ->
            requireNotNull(value.toBooleanStrictOrNull()) { "preferCached must be true or false." }
        } ?: false
        call.respond(portfolioOverviewSnapshotService.overview(preferCached))
    }.documented(
        operationId = "getPortfolioOverview",
        summary = "Get portfolio overview",
        description = "Returns overview totals and valuation timing. With preferCached=true, returns the last complete valuation of the same ledger immediately; refreshRequired requests a subsequent live read. A failed live refresh preserves a compatible complete snapshot and marks refreshFailed.",
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
    portfolioReadModelCacheDescriptorService: PortfolioReadModelCacheDescriptorService,
    portfolioAllocationService: PortfolioAllocationService,
    portfolioHistoryService: PortfolioHistoryService,
    snapshots: ReadModelSnapshotService,
    portfolioReturnsService: PortfolioReturnsService,
) {
    registerPortfolioAnalyticsReadModelRoutes(
        portfolioReadModelCacheDescriptorService = portfolioReadModelCacheDescriptorService,
        portfolioHistoryService = portfolioHistoryService,
        snapshots = snapshots,
        portfolioReturnsService = portfolioReturnsService
    )

    get("/allocation/contribution-plan") {
        val amountPln = call.requiredMoneyQueryParameter("amountPln")
        val targetEquitiesWeightPct = call.optionalPercentQueryParameter("equitiesTargetWeightPct")
        call.respond(portfolioAllocationService.contributionPlan(amountPln, targetEquitiesWeightPct).toResponse())
    }.documented(
        operationId = "getPortfolioContributionPlan",
        summary = "Calculate contribution plan",
        description = "Returns a suggested split for a new PLN contribution, the minimum amount needed to return within tolerance and optional what-if target mix simulations.",
        tag = "Portfolio"
    )

    post("/allocation/manual-contribution-preview") {
        val request = call.receive<ManualContributionPreviewRequest>()
        call.respond(portfolioAllocationService.manualContributionPreview(request.toDomain()).toResponse())
    }.documented(
        operationId = "previewPortfolioManualContribution",
        summary = "Preview manual contribution split",
        description = "Returns the projected allocation after manually assigning PLN contribution amounts to equities, bonds and cash.",
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

internal fun Route.registerPortfolioAnalyticsReadModelRoutes(
    portfolioReadModelCacheDescriptorService: PortfolioReadModelCacheDescriptorService,
    portfolioHistoryService: PortfolioHistoryService,
    snapshots: ReadModelSnapshotService,
    portfolioReturnsService: PortfolioReturnsService,
) {
    get("/history/daily") {
        val result = snapshots.read(
            preferCached = call.prefersCachedReadModel(),
            serializer = PortfolioDailyHistoryResponse.serializer(),
            descriptor = { portfolioReadModelCacheDescriptorService.previewDescriptor("daily-history") }
        ) {
            val history = portfolioHistoryService.dailyHistory(forceRefresh = true).toResponse()
            SnapshotCandidate(history, history.isPreferredForCache())
        }
        call.snapshotHeaders(result)
        call.respond(result.value)
    }.documented(
        operationId = "getPortfolioDailyHistory",
        summary = "Get daily portfolio history",
        description = "Returns daily history. preferCached=true returns a complete snapshot of the same portfolio immediately. X-Read-Model-* headers report generation time, cache origin, refreshRequired and refreshFailed; request a live read when refresh is required.",
        tag = "Portfolio"
    ) { snapshotReadDocumentation() }

    get("/returns") {
        val result = snapshots.read(
            preferCached = call.prefersCachedReadModel(),
            serializer = PortfolioReturnsResponse.serializer(),
            descriptor = { portfolioReadModelCacheDescriptorService.previewDescriptor("returns") }
        ) {
            val history = portfolioHistoryService.dailyHistory(forceRefresh = true)
            SnapshotCandidate(portfolioReturnsService.returns(history).toResponse(), history.isPreferredForCache())
        }
        call.snapshotHeaders(result)
        call.respond(result.value)
    }.documented(
        operationId = "getPortfolioReturns",
        summary = "Get portfolio returns",
        description = "Returns portfolio returns. preferCached=true returns a complete snapshot of the same portfolio immediately. X-Read-Model-* headers report generation time, cache origin, refreshRequired and refreshFailed; request a live read when refresh is required.",
        tag = "Portfolio"
    ) { snapshotReadDocumentation() }
}

internal fun PortfolioDailyHistoryResponse.isPreferredForCache(): Boolean =
    isPortfolioAnalyticsHistoryPreferredForCache(
        valuationState = ValuationState.entries.firstOrNull { state -> state.name == valuationState },
        missingFxTransactions = missingFxTransactions,
        referenceViewsAvailable = points.all { point ->
            point.totalCurrentValueUsd != null && point.totalCurrentValueAu != null
        }
    )

private fun ApplicationCall.requiredMoneyQueryParameter(name: String): BigDecimal {
    val rawValue = request.queryParameters[name]
        ?: throw IllegalArgumentException("Query parameter $name is required.")
    return rawValue
        .toBigDecimalOrNull()
        ?.setScale(2, RoundingMode.HALF_UP)
        ?: throw IllegalArgumentException("Query parameter $name must be a valid PLN amount.")
}

private fun ApplicationCall.optionalPercentQueryParameter(name: String): BigDecimal? {
    val rawValue = request.queryParameters[name] ?: return null
    return rawValue
        .toBigDecimalOrNull()
        ?.setScale(2, RoundingMode.HALF_UP)
        ?: throw IllegalArgumentException("Query parameter $name must be a valid percentage.")
}

@Serializable
data class ManualContributionPreviewRequest(
    val equitiesAmountPln: String = "0.00",
    val bondsAmountPln: String = "0.00",
    val cashAmountPln: String = "0.00"
)

private fun ManualContributionPreviewRequest.toDomain(): Map<AssetClass, BigDecimal> = mapOf(
    AssetClass.EQUITIES to equitiesAmountPln.toMoneyAmount("equitiesAmountPln"),
    AssetClass.BONDS to bondsAmountPln.toMoneyAmount("bondsAmountPln"),
    AssetClass.CASH to cashAmountPln.toMoneyAmount("cashAmountPln")
)

private fun String.toMoneyAmount(fieldName: String): BigDecimal =
    toBigDecimalOrNull()
        ?.setScale(2, RoundingMode.HALF_UP)
        ?: throw IllegalArgumentException("Field $fieldName must be a valid PLN amount.")
