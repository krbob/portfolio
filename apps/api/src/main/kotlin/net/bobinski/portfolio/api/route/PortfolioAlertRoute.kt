package net.bobinski.portfolio.api.route

import io.ktor.http.HttpStatusCode
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import kotlinx.serialization.Serializable
import net.bobinski.portfolio.api.notification.PortfolioAlert
import net.bobinski.portfolio.api.notification.PortfolioAlertDispatchResult
import net.bobinski.portfolio.api.notification.PortfolioAlertService
import net.bobinski.portfolio.api.notification.PortfolioAlertSettings
import net.bobinski.portfolio.api.notification.PortfolioAlertSettingsService
import net.bobinski.portfolio.api.notification.SavePortfolioAlertSettingsCommand
import net.bobinski.portfolio.api.notification.WebPushDispatchResult
import org.koin.ktor.ext.inject

fun Route.portfolioAlertRoute() {
    val alertService: PortfolioAlertService by inject()
    val alertSettingsService: PortfolioAlertSettingsService by inject()

    get("/v1/portfolio/alerts") {
        call.respond(alertService.currentAlerts().map { it.toResponse() })
    }.documented(
        operationId = "listPortfolioAlerts",
        summary = "List active portfolio alerts",
        description = "Returns current portfolio risk, allocation, benchmark and market-data alerts.",
        tag = "Portfolio"
    )

    get("/v1/portfolio/alert-settings") {
        call.respond(alertSettingsService.settings().toResponse())
    }.documented(
        operationId = "getPortfolioAlertSettings",
        summary = "Get portfolio alert settings",
        description = "Returns enabled alert types, alert thresholds and global push delivery preference.",
        tag = "Portfolio"
    )

    post("/v1/portfolio/alert-settings") {
        val request = call.receive<SavePortfolioAlertSettingsRequest>()
        call.respond(alertSettingsService.update(request.toDomain()).toResponse())
    }.documented(
        operationId = "savePortfolioAlertSettings",
        summary = "Save portfolio alert settings",
        description = "Saves enabled alert types, alert thresholds and global push delivery preference.",
        tag = "Portfolio"
    )

    post("/v1/portfolio/alerts/dispatch") {
        call.respond(alertService.dispatchNewAlerts().toResponse())
    }.documented(
        operationId = "dispatchPortfolioAlerts",
        summary = "Dispatch new portfolio alerts",
        description = "Computes current alerts, records the active alert set and sends web push notifications for newly active alerts.",
        tag = "Portfolio"
    )
}

internal fun PortfolioAlert.toResponse(): PortfolioAlertResponse = PortfolioAlertResponse(
    id = id,
    type = type.name,
    severity = severity.name,
    title = title,
    message = message,
    route = route,
    observedAt = observedAt.toString()
)

private fun PortfolioAlertSettings.toResponse(): PortfolioAlertSettingsResponse =
    PortfolioAlertSettingsResponse(
        enabled = enabled,
        pushEnabled = pushEnabled,
        enabledTypes = enabledTypes.map { type -> type.name },
        allocationDriftThresholdPctPoints = allocationDriftThresholdPctPoints.toPlainString(),
        benchmarkUnderperformanceThresholdPctPoints = benchmarkUnderperformanceThresholdPctPoints.toPlainString()
    )

private fun SavePortfolioAlertSettingsRequest.toDomain(): SavePortfolioAlertSettingsCommand =
    SavePortfolioAlertSettingsCommand(
        enabled = enabled,
        pushEnabled = pushEnabled,
        enabledTypes = enabledTypes,
        allocationDriftThresholdPctPoints = allocationDriftThresholdPctPoints.toBigDecimal(),
        benchmarkUnderperformanceThresholdPctPoints = benchmarkUnderperformanceThresholdPctPoints.toBigDecimal()
    )

private fun PortfolioAlertDispatchResult.toResponse(): PortfolioAlertDispatchResponse =
    PortfolioAlertDispatchResponse(
        activeAlertCount = activeAlertCount,
        newAlertCount = newAlertCount,
        push = push.toResponse()
    )

private fun WebPushDispatchResult.toResponse(): WebPushDispatchResponse = WebPushDispatchResponse(
    subscriptionCount = subscriptionCount,
    deliveredCount = deliveredCount,
    failedCount = failedCount,
    removedCount = removedCount,
    enabled = enabled
)

@Serializable
data class PortfolioAlertResponse(
    val id: String,
    val type: String,
    val severity: String,
    val title: String,
    val message: String,
    val route: String,
    val observedAt: String
)

@Serializable
data class PortfolioAlertSettingsResponse(
    val enabled: Boolean,
    val pushEnabled: Boolean,
    val enabledTypes: List<String>,
    val allocationDriftThresholdPctPoints: String,
    val benchmarkUnderperformanceThresholdPctPoints: String
)

@Serializable
data class SavePortfolioAlertSettingsRequest(
    val enabled: Boolean,
    val pushEnabled: Boolean,
    val enabledTypes: List<String>,
    val allocationDriftThresholdPctPoints: String,
    val benchmarkUnderperformanceThresholdPctPoints: String
)

@Serializable
data class PortfolioAlertDispatchResponse(
    val activeAlertCount: Int,
    val newAlertCount: Int,
    val push: WebPushDispatchResponse
)

@Serializable
data class WebPushDispatchResponse(
    val subscriptionCount: Int,
    val deliveredCount: Int,
    val failedCount: Int,
    val removedCount: Int,
    val enabled: Boolean
)
