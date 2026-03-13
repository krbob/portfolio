package net.bobinski.portfolio.api.route

import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.route
import kotlinx.serialization.Serializable
import net.bobinski.portfolio.api.domain.service.HoldingSnapshot
import net.bobinski.portfolio.api.domain.service.PortfolioDailyHistory
import net.bobinski.portfolio.api.domain.service.PortfolioDailyHistoryPoint
import net.bobinski.portfolio.api.domain.service.PortfolioHistoryService
import net.bobinski.portfolio.api.domain.service.PortfolioOverview
import net.bobinski.portfolio.api.domain.service.PortfolioReadModelService
import org.koin.ktor.ext.inject

fun Route.portfolioRoute() {
    val portfolioReadModelService: PortfolioReadModelService by inject()
    val portfolioHistoryService: PortfolioHistoryService by inject()

    route("/v1/portfolio") {
        get("/overview") {
            call.respond(portfolioReadModelService.overview().toResponse())
        }

        get("/holdings") {
            call.respond(portfolioReadModelService.holdings().map { it.toResponse() })
        }

        get("/history/daily") {
            call.respond(portfolioHistoryService.dailyHistory().toResponse())
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
    val activeHoldingCount: Int,
    val valuedHoldingCount: Int
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
    activeHoldingCount = activeHoldingCount,
    valuedHoldingCount = valuedHoldingCount
)
