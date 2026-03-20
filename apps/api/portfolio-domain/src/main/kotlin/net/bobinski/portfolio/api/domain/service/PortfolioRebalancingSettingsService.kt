package net.bobinski.portfolio.api.domain.service

import java.math.BigDecimal
import java.math.RoundingMode
import java.time.Clock
import java.time.Instant
import kotlinx.serialization.Serializable
import net.bobinski.portfolio.api.domain.model.AuditEventCategory

class PortfolioRebalancingSettingsService(
    private val appPreferenceService: AppPreferenceService,
    private val auditLogService: AuditLogService,
    private val clock: Clock
) {
    suspend fun settings(): PortfolioRebalancingSettings {
        val stored = appPreferenceService.get(
            key = PREFERENCE_KEY,
            serializer = StoredRebalancingSettings.serializer(),
            defaultValue = ::defaultStoredSettings
        )
        return normalize(stored)
    }

    suspend fun update(command: SavePortfolioRebalancingSettingsCommand): PortfolioRebalancingSettings {
        val toleranceBandPctPoints = command.toleranceBandPctPoints
            .setScale(2, RoundingMode.HALF_UP)
        require(toleranceBandPctPoints >= BigDecimal.ZERO) {
            "Tolerance band must be zero or greater."
        }
        require(toleranceBandPctPoints <= BigDecimal("25.00")) {
            "Tolerance band cannot exceed 25 percentage points."
        }

        val stored = StoredRebalancingSettings(
            toleranceBandPctPoints = toleranceBandPctPoints.toPlainString(),
            mode = command.mode.name
        )
        appPreferenceService.put(
            key = PREFERENCE_KEY,
            serializer = StoredRebalancingSettings.serializer(),
            value = stored
        )
        auditLogService.record(
            category = AuditEventCategory.SYSTEM,
            action = "REBALANCING_SETTINGS_UPDATED",
            entityType = "REBALANCING_SETTINGS",
            message = "Updated rebalancing settings.",
            metadata = mapOf(
                "toleranceBandPctPoints" to toleranceBandPctPoints.toPlainString(),
                "mode" to command.mode.name,
                "updatedAt" to Instant.now(clock).toString()
            )
        )
        return normalize(stored)
    }

    private fun normalize(stored: StoredRebalancingSettings): PortfolioRebalancingSettings {
        val toleranceBandPctPoints = stored.toleranceBandPctPoints.toBigDecimalOrNull()
            ?.setScale(2, RoundingMode.HALF_UP)
            ?.coerceIn(BigDecimal.ZERO, BigDecimal("25.00"))
            ?: DEFAULT_TOLERANCE_BAND_PCT_POINTS
        val mode = stored.mode.toRebalancingModeOrNull() ?: RebalancingMode.CONTRIBUTIONS_ONLY
        return PortfolioRebalancingSettings(
            toleranceBandPctPoints = toleranceBandPctPoints,
            mode = mode
        )
    }

    private fun String.toRebalancingModeOrNull(): RebalancingMode? = runCatching {
        RebalancingMode.valueOf(this)
    }.getOrNull()

    companion object {
        const val PREFERENCE_KEY = "portfolio.rebalancing-settings"
        val DEFAULT_TOLERANCE_BAND_PCT_POINTS: BigDecimal = BigDecimal("5.00")

        private fun defaultStoredSettings() = StoredRebalancingSettings(
            toleranceBandPctPoints = DEFAULT_TOLERANCE_BAND_PCT_POINTS.toPlainString(),
            mode = RebalancingMode.CONTRIBUTIONS_ONLY.name
        )
    }
}

data class PortfolioRebalancingSettings(
    val toleranceBandPctPoints: BigDecimal,
    val mode: RebalancingMode
)

data class SavePortfolioRebalancingSettingsCommand(
    val toleranceBandPctPoints: BigDecimal,
    val mode: RebalancingMode
)

enum class RebalancingMode {
    CONTRIBUTIONS_ONLY,
    ALLOW_TRIMS
}

@Serializable
private data class StoredRebalancingSettings(
    val toleranceBandPctPoints: String,
    val mode: String
)

private fun BigDecimal.coerceIn(minimum: BigDecimal, maximum: BigDecimal): BigDecimal = when {
    this < minimum -> minimum
    this > maximum -> maximum
    else -> this
}
