package net.bobinski.portfolio.api.route

import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import java.util.UUID
import kotlinx.serialization.Serializable
import net.bobinski.portfolio.api.domain.service.PortfolioWithdrawalPlan
import net.bobinski.portfolio.api.domain.service.PortfolioWithdrawalPlanCommand
import net.bobinski.portfolio.api.domain.service.PortfolioWithdrawalService
import net.bobinski.portfolio.api.domain.service.PortfolioWithdrawalSettingsService
import net.bobinski.portfolio.api.domain.service.SaveWithdrawalPlanningSettingsCommand
import net.bobinski.portfolio.api.domain.service.WithdrawalPlanningAccountRule
import net.bobinski.portfolio.api.domain.service.WithdrawalPlanningSettings
import net.bobinski.portfolio.api.domain.service.WithdrawalTaxWrapper

internal fun Route.registerPortfolioWithdrawalPlanRoute(
    portfolioWithdrawalService: PortfolioWithdrawalService
) {
    post("/allocation/withdrawal-plan") {
        val request = call.receive<PortfolioWithdrawalPlanRequest>()
        call.respond(portfolioWithdrawalService.plan(request.toDomain()).toResponse())
    }.documented(
        operationId = "previewPortfolioWithdrawal",
        summary = "Preview a portfolio withdrawal",
        description = "Returns a read-only withdrawal plan using the configured account priority and manual tax buffers. It does not create transactions.",
        tag = "Portfolio"
    )
}

internal fun Route.registerPortfolioWithdrawalSettingsRoutes(
    portfolioWithdrawalSettingsService: PortfolioWithdrawalSettingsService
) {
    get("/withdrawal-settings") {
        call.respond(portfolioWithdrawalSettingsService.settings().toResponse())
    }.documented(
        operationId = "getPortfolioWithdrawalSettings",
        summary = "Get withdrawal planning settings",
        description = "Returns ordered account rules, tax-wrapper labels and user-supplied tax buffer estimates.",
        tag = "Portfolio"
    )

    post("/withdrawal-settings") {
        val request = call.receive<SavePortfolioWithdrawalSettingsRequest>()
        call.respond(portfolioWithdrawalSettingsService.update(request.toDomain()).toResponse())
    }.documented(
        operationId = "savePortfolioWithdrawalSettings",
        summary = "Save withdrawal planning settings",
        description = "Saves account priority, participation, tax-wrapper labels and manual tax buffer estimates.",
        tag = "Portfolio"
    )
}

@Serializable
data class PortfolioWithdrawalPlanRequest(
    val amountPln: String? = null,
    val portfolioPercentagePct: String? = null
)

@Serializable
data class PortfolioWithdrawalPlanResponse(
    val asOf: String,
    val valuationState: String,
    val requestedAmountPln: String?,
    val requestedPortfolioPercentagePct: String?,
    val requestedWithdrawalPln: String,
    val plannedWithdrawalPln: String,
    val feasible: Boolean,
    val shortfallPln: String,
    val cashUsedPln: String,
    val grossSalesPln: String,
    val estimatedTaxBufferPln: String,
    val projectedTotalValuePln: String,
    val accountPlans: List<PortfolioWithdrawalAccountPlanResponse>,
    val buckets: List<PortfolioWithdrawalPlanBucketResponse>,
    val warnings: List<String>
)

@Serializable
data class PortfolioWithdrawalAccountPlanResponse(
    val accountId: String,
    val accountName: String,
    val taxWrapper: WithdrawalTaxWrapper,
    val taxBufferRatePct: String,
    val currentValuePln: String,
    val availableCashPln: String,
    val cashUsedPln: String,
    val grossSalesPln: String,
    val estimatedTaxBufferPln: String,
    val withdrawalPln: String,
    val projectedValuePln: String,
    val sales: List<PortfolioWithdrawalAccountSaleResponse>
)

@Serializable
data class PortfolioWithdrawalAccountSaleResponse(
    val assetClass: String,
    val amountPln: String
)

@Serializable
data class PortfolioWithdrawalPlanBucketResponse(
    val assetClass: String,
    val currentValuePln: String,
    val plannedSalePln: String,
    val projectedValuePln: String,
    val projectedWeightPct: String?,
    val targetWeightPct: String?,
    val projectedDriftPctPoints: String?
)

@Serializable
data class PortfolioWithdrawalSettingsResponse(
    val accountRules: List<PortfolioWithdrawalAccountRuleResponse>
)

@Serializable
data class PortfolioWithdrawalAccountRuleResponse(
    val accountId: String,
    val enabled: Boolean,
    val taxWrapper: WithdrawalTaxWrapper,
    val taxBufferRatePct: String
)

@Serializable
data class SavePortfolioWithdrawalSettingsRequest(
    val accountRules: List<SavePortfolioWithdrawalAccountRuleRequest>
)

@Serializable
data class SavePortfolioWithdrawalAccountRuleRequest(
    val accountId: String,
    val enabled: Boolean,
    val taxWrapper: WithdrawalTaxWrapper,
    val taxBufferRatePct: String
)

private fun PortfolioWithdrawalPlanRequest.toDomain(): PortfolioWithdrawalPlanCommand =
    PortfolioWithdrawalPlanCommand(
        amountPln = amountPln?.toWithdrawalDecimal("amountPln"),
        portfolioPercentagePct = portfolioPercentagePct?.toWithdrawalDecimal("portfolioPercentagePct")
    )

private fun SavePortfolioWithdrawalSettingsRequest.toDomain(): SaveWithdrawalPlanningSettingsCommand =
    SaveWithdrawalPlanningSettingsCommand(
        accountRules = accountRules.map { rule ->
            WithdrawalPlanningAccountRule(
                accountId = runCatching { UUID.fromString(rule.accountId) }.getOrElse {
                    throw IllegalArgumentException("Field accountId must be a valid UUID.")
                },
                enabled = rule.enabled,
                taxWrapper = rule.taxWrapper,
                taxBufferRatePct = rule.taxBufferRatePct.toWithdrawalDecimal("taxBufferRatePct")
            )
        }
    )

private fun WithdrawalPlanningSettings.toResponse(): PortfolioWithdrawalSettingsResponse =
    PortfolioWithdrawalSettingsResponse(
        accountRules = accountRules.map { rule ->
            PortfolioWithdrawalAccountRuleResponse(
                accountId = rule.accountId.toString(),
                enabled = rule.enabled,
                taxWrapper = rule.taxWrapper,
                taxBufferRatePct = rule.taxBufferRatePct.toPlainString()
            )
        }
    )

private fun PortfolioWithdrawalPlan.toResponse(): PortfolioWithdrawalPlanResponse =
    PortfolioWithdrawalPlanResponse(
        asOf = asOf.toString(),
        valuationState = valuationState.name,
        requestedAmountPln = requestedAmountPln?.toPlainString(),
        requestedPortfolioPercentagePct = requestedPortfolioPercentagePct?.toPlainString(),
        requestedWithdrawalPln = requestedWithdrawalPln.toPlainString(),
        plannedWithdrawalPln = plannedWithdrawalPln.toPlainString(),
        feasible = feasible,
        shortfallPln = shortfallPln.toPlainString(),
        cashUsedPln = cashUsedPln.toPlainString(),
        grossSalesPln = grossSalesPln.toPlainString(),
        estimatedTaxBufferPln = estimatedTaxBufferPln.toPlainString(),
        projectedTotalValuePln = projectedTotalValuePln.toPlainString(),
        accountPlans = accountPlans.map { plan ->
            PortfolioWithdrawalAccountPlanResponse(
                accountId = plan.accountId.toString(),
                accountName = plan.accountName,
                taxWrapper = plan.taxWrapper,
                taxBufferRatePct = plan.taxBufferRatePct.toPlainString(),
                currentValuePln = plan.currentValuePln.toPlainString(),
                availableCashPln = plan.availableCashPln.toPlainString(),
                cashUsedPln = plan.cashUsedPln.toPlainString(),
                grossSalesPln = plan.grossSalesPln.toPlainString(),
                estimatedTaxBufferPln = plan.estimatedTaxBufferPln.toPlainString(),
                withdrawalPln = plan.withdrawalPln.toPlainString(),
                projectedValuePln = plan.projectedValuePln.toPlainString(),
                sales = plan.sales.map { sale ->
                    PortfolioWithdrawalAccountSaleResponse(
                        assetClass = sale.assetClass.name,
                        amountPln = sale.amountPln.toPlainString()
                    )
                }
            )
        },
        buckets = buckets.map { bucket ->
            PortfolioWithdrawalPlanBucketResponse(
                assetClass = bucket.assetClass.name,
                currentValuePln = bucket.currentValuePln.toPlainString(),
                plannedSalePln = bucket.plannedSalePln.toPlainString(),
                projectedValuePln = bucket.projectedValuePln.toPlainString(),
                projectedWeightPct = bucket.projectedWeightPct?.toPlainString(),
                targetWeightPct = bucket.targetWeightPct?.toPlainString(),
                projectedDriftPctPoints = bucket.projectedDriftPctPoints?.toPlainString()
            )
        },
        warnings = warnings.map { warning -> warning.name }
    )

private fun String.toWithdrawalDecimal(fieldName: String) =
    toBigDecimalOrNull() ?: throw IllegalArgumentException("Field $fieldName must be a valid number.")
