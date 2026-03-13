package net.bobinski.portfolio.api.route

import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.route
import kotlinx.serialization.Serializable
import net.bobinski.portfolio.api.domain.service.HoldingSnapshot
import net.bobinski.portfolio.api.domain.service.PortfolioOverview
import net.bobinski.portfolio.api.domain.service.PortfolioReadModelService
import org.koin.ktor.ext.inject

fun Route.portfolioRoute() {
    val portfolioReadModelService: PortfolioReadModelService by inject()

    route("/v1/portfolio") {
        get("/overview") {
            call.respond(portfolioReadModelService.overview().toResponse())
        }

        get("/holdings") {
            call.respond(portfolioReadModelService.holdings().map { it.toResponse() })
        }
    }
}

@Serializable
data class PortfolioOverviewResponse(
    val asOf: String,
    val valuationState: String,
    val totalBookValuePln: String,
    val investedBookValuePln: String,
    val cashBalancePln: String,
    val netContributionsPln: String,
    val equityBookValuePln: String,
    val bondBookValuePln: String,
    val cashBookValuePln: String,
    val accountCount: Int,
    val instrumentCount: Int,
    val activeHoldingCount: Int,
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
    val transactionCount: Int
)

private fun PortfolioOverview.toResponse(): PortfolioOverviewResponse = PortfolioOverviewResponse(
    asOf = asOf.toString(),
    valuationState = valuationState.name,
    totalBookValuePln = totalBookValuePln.toPlainString(),
    investedBookValuePln = investedBookValuePln.toPlainString(),
    cashBalancePln = cashBalancePln.toPlainString(),
    netContributionsPln = netContributionsPln.toPlainString(),
    equityBookValuePln = equityBookValuePln.toPlainString(),
    bondBookValuePln = bondBookValuePln.toPlainString(),
    cashBookValuePln = cashBookValuePln.toPlainString(),
    accountCount = accountCount,
    instrumentCount = instrumentCount,
    activeHoldingCount = activeHoldingCount,
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
    transactionCount = transactionCount
)
