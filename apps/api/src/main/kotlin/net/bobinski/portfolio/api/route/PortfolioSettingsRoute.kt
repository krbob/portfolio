package net.bobinski.portfolio.api.route

import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.route
import kotlinx.serialization.Serializable
import net.bobinski.portfolio.api.domain.model.AssetClass
import net.bobinski.portfolio.api.domain.service.BenchmarkOptionKind
import net.bobinski.portfolio.api.domain.service.PortfolioBenchmarkSettingsService
import net.bobinski.portfolio.api.domain.service.PortfolioRebalancingSettingsService
import net.bobinski.portfolio.api.domain.service.PortfolioTargetService
import net.bobinski.portfolio.api.domain.service.RebalancingMode
import net.bobinski.portfolio.api.domain.service.ReplacePortfolioTargetItem
import net.bobinski.portfolio.api.domain.service.ReplacePortfolioTargetsCommand
import net.bobinski.portfolio.api.domain.service.SavePortfolioBenchmarkSettingsCommand
import net.bobinski.portfolio.api.domain.service.SavePortfolioRebalancingSettingsCommand
import org.koin.ktor.ext.inject

fun Route.portfolioSettingsRoute() {
    val portfolioTargetService: PortfolioTargetService by inject()
    val portfolioBenchmarkSettingsService: PortfolioBenchmarkSettingsService by inject()
    val portfolioRebalancingSettingsService: PortfolioRebalancingSettingsService by inject()

    route("/v1/portfolio") {
        get("/targets") {
            call.respond(portfolioTargetService.list().map { it.toResponse() })
        }.documented(
            operationId = "listPortfolioTargets",
            summary = "List target allocation weights",
            description = "Returns the saved portfolio target allocation weights.",
            tag = "Portfolio"
        )

        post("/targets") {
            val request = call.receive<ReplacePortfolioTargetsRequest>()
            call.respond(portfolioTargetService.replace(request.toDomain()).map { it.toResponse() })
        }.documented(
            operationId = "replacePortfolioTargets",
            summary = "Replace target allocation weights",
            description = "Replaces the saved portfolio target allocation with the provided set of weights.",
            tag = "Portfolio"
        )

        get("/benchmark-settings") {
            call.respond(portfolioBenchmarkSettingsService.settings().toResponse())
        }.documented(
            operationId = "getPortfolioBenchmarkSettings",
            summary = "Get benchmark settings",
            description = "Returns enabled, pinned and custom benchmark settings for the portfolio.",
            tag = "Portfolio"
        )

        post("/benchmark-settings") {
            val request = call.receive<SavePortfolioBenchmarkSettingsRequest>()
            call.respond(portfolioBenchmarkSettingsService.update(request.toDomain()).toResponse())
        }.documented(
            operationId = "savePortfolioBenchmarkSettings",
            summary = "Save benchmark settings",
            description = "Saves enabled, pinned and optional custom benchmark configuration.",
            tag = "Portfolio"
        )

        get("/rebalancing-settings") {
            call.respond(portfolioRebalancingSettingsService.settings().toResponse())
        }.documented(
            operationId = "getPortfolioRebalancingSettings",
            summary = "Get rebalancing settings",
            description = "Returns current tolerance band and rebalancing mode settings.",
            tag = "Portfolio"
        )

        post("/rebalancing-settings") {
            val request = call.receive<SavePortfolioRebalancingSettingsRequest>()
            call.respond(portfolioRebalancingSettingsService.update(request.toDomain()).toResponse())
        }.documented(
            operationId = "savePortfolioRebalancingSettings",
            summary = "Save rebalancing settings",
            description = "Saves the portfolio tolerance band and rebalancing mode configuration.",
            tag = "Portfolio"
        )
    }
}

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
data class PortfolioBenchmarkSettingsResponse(
    val enabledKeys: List<String>,
    val pinnedKeys: List<String>,
    val customBenchmarks: List<CustomBenchmarkResponse>,
    val options: List<BenchmarkOptionResponse>
)

@Serializable
data class CustomBenchmarkResponse(
    val key: String,
    val label: String,
    val symbol: String
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
    val customBenchmarks: List<SaveCustomBenchmarkRequest> = emptyList()
)

@Serializable
data class SaveCustomBenchmarkRequest(
    val key: String,
    val label: String,
    val symbol: String
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

private fun net.bobinski.portfolio.api.domain.service.PortfolioBenchmarkSettings.toResponse(): PortfolioBenchmarkSettingsResponse =
    PortfolioBenchmarkSettingsResponse(
        enabledKeys = enabledKeys,
        pinnedKeys = pinnedKeys,
        customBenchmarks = customBenchmarks.map { benchmark ->
            CustomBenchmarkResponse(
                key = benchmark.key,
                label = benchmark.label,
                symbol = benchmark.symbol
            )
        },
        options = options.map { option ->
            BenchmarkOptionResponse(
                key = option.key,
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
        enabledKeys = enabledKeys,
        pinnedKeys = pinnedKeys,
        customBenchmarks = customBenchmarks.map { benchmark ->
            net.bobinski.portfolio.api.domain.service.SaveCustomBenchmarkCommand(
                key = benchmark.key,
                label = benchmark.label,
                symbol = benchmark.symbol
            )
        }
    )

private fun parseRebalancingMode(value: String): RebalancingMode = try {
    RebalancingMode.valueOf(value.uppercase())
} catch (_: IllegalArgumentException) {
    throw IllegalArgumentException("Unsupported rebalancing mode: $value")
}
