package net.bobinski.portfolio.api.notification

import java.math.BigDecimal
import java.math.RoundingMode
import java.time.Clock
import java.time.Instant
import kotlinx.serialization.Serializable
import net.bobinski.portfolio.api.domain.model.AuditEventCategory
import net.bobinski.portfolio.api.domain.service.AppPreferenceService
import net.bobinski.portfolio.api.domain.service.AuditLogService
import net.bobinski.portfolio.api.notification.config.PortfolioAlertConfig

class PortfolioAlertSettingsService(
    private val config: PortfolioAlertConfig,
    private val appPreferenceService: AppPreferenceService,
    private val auditLogService: AuditLogService,
    private val clock: Clock
) {
    suspend fun settings(): PortfolioAlertSettings {
        val stored = appPreferenceService.get(
            key = PREFERENCE_KEY,
            serializer = StoredPortfolioAlertSettings.serializer(),
            defaultValue = ::defaultStoredSettings
        )
        return normalize(stored)
    }

    suspend fun update(command: SavePortfolioAlertSettingsCommand): PortfolioAlertSettings {
        val enabledTypes = command.enabledTypes
            .map(::parseAlertType)
            .distinct()
        val allocationDriftThresholdPctPoints = normalizeThreshold(
            command.allocationDriftThresholdPctPoints,
            "Allocation drift alert threshold must be positive."
        )
        val benchmarkUnderperformanceThresholdPctPoints = normalizeThreshold(
            command.benchmarkUnderperformanceThresholdPctPoints,
            "Benchmark underperformance alert threshold must be positive."
        )

        val stored = StoredPortfolioAlertSettings(
            enabled = command.enabled,
            pushEnabled = command.pushEnabled,
            enabledTypes = enabledTypes.map(PortfolioAlertType::name),
            allocationDriftThresholdPctPoints = allocationDriftThresholdPctPoints.toPlainString(),
            benchmarkUnderperformanceThresholdPctPoints = benchmarkUnderperformanceThresholdPctPoints.toPlainString()
        )
        appPreferenceService.put(
            key = PREFERENCE_KEY,
            serializer = StoredPortfolioAlertSettings.serializer(),
            value = stored
        )
        auditLogService.record(
            category = AuditEventCategory.SYSTEM,
            action = "ALERT_SETTINGS_UPDATED",
            entityType = "ALERT_SETTINGS",
            message = "Updated portfolio alert settings.",
            metadata = mapOf(
                "enabled" to stored.enabled.toString(),
                "pushEnabled" to stored.pushEnabled.toString(),
                "enabledTypes" to stored.enabledTypes.joinToString(","),
                "allocationDriftThresholdPctPoints" to stored.allocationDriftThresholdPctPoints,
                "benchmarkUnderperformanceThresholdPctPoints" to stored.benchmarkUnderperformanceThresholdPctPoints,
                "updatedAt" to Instant.now(clock).toString()
            )
        )
        return normalize(stored)
    }

    private fun normalize(stored: StoredPortfolioAlertSettings): PortfolioAlertSettings {
        val enabledTypes = stored.enabledTypes
            .mapNotNull { value -> runCatching { PortfolioAlertType.valueOf(value.uppercase()) }.getOrNull() }
            .distinct()

        return PortfolioAlertSettings(
            enabled = stored.enabled,
            pushEnabled = stored.pushEnabled,
            enabledTypes = enabledTypes,
            allocationDriftThresholdPctPoints = stored.allocationDriftThresholdPctPoints.toBigDecimalOrNull()
                ?.takeIf { it > BigDecimal.ZERO }
                ?.setScale(2, RoundingMode.HALF_UP)
                ?: config.allocationDriftThresholdPctPoints.setScale(2, RoundingMode.HALF_UP),
            benchmarkUnderperformanceThresholdPctPoints = stored.benchmarkUnderperformanceThresholdPctPoints.toBigDecimalOrNull()
                ?.takeIf { it > BigDecimal.ZERO }
                ?.setScale(2, RoundingMode.HALF_UP)
                ?: config.benchmarkUnderperformanceThresholdPctPoints.setScale(2, RoundingMode.HALF_UP)
        )
    }

    private fun parseAlertType(value: String): PortfolioAlertType =
        runCatching { PortfolioAlertType.valueOf(value.uppercase()) }
            .getOrElse { throw IllegalArgumentException("Unsupported portfolio alert type: $value") }

    private fun normalizeThreshold(value: BigDecimal, message: String): BigDecimal {
        val normalized = value.setScale(2, RoundingMode.HALF_UP)
        require(normalized > BigDecimal.ZERO) { message }
        return normalized
    }

    private fun defaultStoredSettings() = StoredPortfolioAlertSettings(
        enabled = config.enabled,
        pushEnabled = true,
        enabledTypes = PortfolioAlertType.entries.map(PortfolioAlertType::name),
        allocationDriftThresholdPctPoints = config.allocationDriftThresholdPctPoints
            .setScale(2, RoundingMode.HALF_UP)
            .toPlainString(),
        benchmarkUnderperformanceThresholdPctPoints = config.benchmarkUnderperformanceThresholdPctPoints
            .setScale(2, RoundingMode.HALF_UP)
            .toPlainString()
    )

    companion object {
        const val PREFERENCE_KEY = "portfolio.alert-settings"
    }
}

data class PortfolioAlertSettings(
    val enabled: Boolean,
    val pushEnabled: Boolean,
    val enabledTypes: List<PortfolioAlertType>,
    val allocationDriftThresholdPctPoints: BigDecimal,
    val benchmarkUnderperformanceThresholdPctPoints: BigDecimal
) {
    fun typeEnabled(type: PortfolioAlertType): Boolean =
        enabled && type in enabledTypes
}

data class SavePortfolioAlertSettingsCommand(
    val enabled: Boolean,
    val pushEnabled: Boolean,
    val enabledTypes: List<String>,
    val allocationDriftThresholdPctPoints: BigDecimal,
    val benchmarkUnderperformanceThresholdPctPoints: BigDecimal
)

@Serializable
private data class StoredPortfolioAlertSettings(
    val enabled: Boolean = true,
    val pushEnabled: Boolean = true,
    val enabledTypes: List<String> = PortfolioAlertType.entries.map(PortfolioAlertType::name),
    val allocationDriftThresholdPctPoints: String = "5.00",
    val benchmarkUnderperformanceThresholdPctPoints: String = "5.00"
)
