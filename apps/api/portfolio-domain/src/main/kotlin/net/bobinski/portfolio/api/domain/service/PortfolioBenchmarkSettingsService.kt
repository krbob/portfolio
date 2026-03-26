package net.bobinski.portfolio.api.domain.service

import java.time.Clock
import kotlinx.serialization.Serializable
import net.bobinski.portfolio.api.domain.model.AuditEventCategory

class PortfolioBenchmarkSettingsService(
    private val appPreferenceService: AppPreferenceService,
    private val auditLogService: AuditLogService,
    private val clock: Clock
) {
    suspend fun settings(): PortfolioBenchmarkSettings {
        val stored = appPreferenceService.get(
            key = PREFERENCE_KEY,
            serializer = StoredBenchmarkSettings.serializer(),
            defaultValue = ::defaultStoredSettings
        )
        return normalize(stored)
    }

    suspend fun update(command: SavePortfolioBenchmarkSettingsCommand): PortfolioBenchmarkSettings {
        val customLabel = command.customLabel?.trim().orEmpty().ifBlank { null }
        val customSymbol = command.customSymbol?.trim().orEmpty().ifBlank { null }
        require((customLabel == null) == (customSymbol == null)) {
            "Custom benchmark label and symbol must either both be set or both be empty."
        }

        val supportedKeys = BenchmarkKey.entries.toSet()
        require(command.enabledKeys.all { it in supportedKeys }) {
            "Benchmark settings contain unsupported keys."
        }
        require(command.pinnedKeys.all { it in command.enabledKeys }) {
            "Pinned benchmarks must be enabled."
        }
        if (BenchmarkKey.CUSTOM in command.enabledKeys || BenchmarkKey.CUSTOM in command.pinnedKeys) {
            require(customLabel != null && customSymbol != null) {
                "Custom benchmark requires both a label and a symbol."
            }
        }

        val stored = StoredBenchmarkSettings(
            enabledKeys = command.enabledKeys.map(BenchmarkKey::name).distinct(),
            pinnedKeys = command.pinnedKeys.map(BenchmarkKey::name).distinct(),
            customLabel = customLabel,
            customSymbol = customSymbol
        )
        appPreferenceService.put(
            key = PREFERENCE_KEY,
            serializer = StoredBenchmarkSettings.serializer(),
            value = stored
        )
        auditLogService.record(
            category = AuditEventCategory.SYSTEM,
            action = "BENCHMARK_SETTINGS_UPDATED",
            entityType = "BENCHMARK_SETTINGS",
            message = "Updated benchmark configuration.",
            metadata = mapOf(
                "enabledKeys" to stored.enabledKeys.joinToString(","),
                "pinnedKeys" to stored.pinnedKeys.joinToString(","),
                "customSymbol" to (stored.customSymbol ?: ""),
                "updatedAt" to java.time.Instant.now(clock).toString()
            )
        )
        return normalize(stored)
    }

    private fun normalize(stored: StoredBenchmarkSettings): PortfolioBenchmarkSettings {
        val customConfigured = !stored.customLabel.isNullOrBlank() && !stored.customSymbol.isNullOrBlank()
        val supportedKeys = BenchmarkKey.entries.toSet()
        val enabledKeys = stored.enabledKeys
            .mapNotNull { raw -> raw.toBenchmarkKeyOrNull() }
            .filterTo(linkedSetOf()) { key ->
                key in supportedKeys && (key != BenchmarkKey.CUSTOM || customConfigured)
            }
            .ifEmpty {
                defaultStoredSettings().enabledKeys
                    .mapNotNull { raw -> raw.toBenchmarkKeyOrNull() }
                    .toCollection(linkedSetOf())
            }
        val pinnedKeys = stored.pinnedKeys
            .mapNotNull { raw -> raw.toBenchmarkKeyOrNull() }
            .filterTo(linkedSetOf()) { key -> key in enabledKeys }

        val customDefinition = if (customConfigured) {
            BenchmarkOptionDefinition(
                key = BenchmarkKey.CUSTOM,
                label = stored.customLabel,
                symbol = stored.customSymbol,
                kind = BenchmarkOptionKind.CUSTOM,
                configurable = true,
                defaultEnabled = false,
                defaultPinned = false
            )
        } else {
            BenchmarkOptionDefinition(
                key = BenchmarkKey.CUSTOM,
                label = "Custom benchmark",
                symbol = null,
                kind = BenchmarkOptionKind.CUSTOM,
                configurable = true,
                defaultEnabled = false,
                defaultPinned = false
            )
        }

        return PortfolioBenchmarkSettings(
            enabledKeys = enabledKeys.toList(),
            pinnedKeys = pinnedKeys.toList(),
            customLabel = stored.customLabel?.takeIf { it.isNotBlank() },
            customSymbol = stored.customSymbol?.takeIf { it.isNotBlank() },
            options = DEFAULT_OPTIONS + customDefinition
        )
    }

    private fun String.toBenchmarkKeyOrNull(): BenchmarkKey? = runCatching {
        BenchmarkKey.valueOf(this)
    }.getOrNull()

    companion object {
        const val PREFERENCE_KEY = "portfolio.benchmark-settings"

        private fun defaultStoredSettings() = StoredBenchmarkSettings(
            enabledKeys = listOf(
                BenchmarkKey.VWRA.name,
                BenchmarkKey.INFLATION.name,
                BenchmarkKey.TARGET_MIX.name,
                BenchmarkKey.V80A.name,
                BenchmarkKey.V60A.name,
                BenchmarkKey.V40A.name,
                BenchmarkKey.V20A.name
            ),
            pinnedKeys = listOf(
                BenchmarkKey.VWRA.name,
                BenchmarkKey.INFLATION.name,
                BenchmarkKey.TARGET_MIX.name
            ),
            customLabel = null,
            customSymbol = null
        )

        private val DEFAULT_OPTIONS = listOf(
            BenchmarkOptionDefinition(
                key = BenchmarkKey.VWRA,
                label = "VWRA benchmark",
                symbol = "VWRA.L",
                kind = BenchmarkOptionKind.SYSTEM,
                configurable = true,
                defaultEnabled = true,
                defaultPinned = true
            ),
            BenchmarkOptionDefinition(
                key = BenchmarkKey.INFLATION,
                label = "Inflation benchmark",
                symbol = null,
                kind = BenchmarkOptionKind.SYSTEM,
                configurable = true,
                defaultEnabled = true,
                defaultPinned = true
            ),
            BenchmarkOptionDefinition(
                key = BenchmarkKey.TARGET_MIX,
                label = "Configured target mix",
                symbol = null,
                kind = BenchmarkOptionKind.SYSTEM,
                configurable = true,
                defaultEnabled = true,
                defaultPinned = true
            ),
            BenchmarkOptionDefinition(
                key = BenchmarkKey.V80A,
                label = "V80A 80/20 benchmark",
                symbol = "V80A.DE",
                kind = BenchmarkOptionKind.MULTI_ASSET,
                configurable = true,
                defaultEnabled = true,
                defaultPinned = false
            ),
            BenchmarkOptionDefinition(
                key = BenchmarkKey.V60A,
                label = "V60A 60/40 benchmark",
                symbol = "V60A.DE",
                kind = BenchmarkOptionKind.MULTI_ASSET,
                configurable = true,
                defaultEnabled = true,
                defaultPinned = false
            ),
            BenchmarkOptionDefinition(
                key = BenchmarkKey.V40A,
                label = "V40A 40/60 benchmark",
                symbol = "V40A.DE",
                kind = BenchmarkOptionKind.MULTI_ASSET,
                configurable = true,
                defaultEnabled = true,
                defaultPinned = false
            ),
            BenchmarkOptionDefinition(
                key = BenchmarkKey.V20A,
                label = "V20A 20/80 benchmark",
                symbol = "V20A.DE",
                kind = BenchmarkOptionKind.MULTI_ASSET,
                configurable = true,
                defaultEnabled = true,
                defaultPinned = false
            )
        )
    }
}

data class PortfolioBenchmarkSettings(
    val enabledKeys: List<BenchmarkKey>,
    val pinnedKeys: List<BenchmarkKey>,
    val customLabel: String?,
    val customSymbol: String?,
    val options: List<BenchmarkOptionDefinition>
) {
    fun isEnabled(key: BenchmarkKey): Boolean = key in enabledKeys

    fun isPinned(key: BenchmarkKey): Boolean = key in pinnedKeys

    fun activeReferenceBenchmarks(): List<ReferenceBenchmarkDefinition> = buildList {
        options.forEach { option ->
            val symbol = option.symbol
            if (option.key in SYSTEM_REFERENCE_KEYS || option.key !in enabledKeys || symbol == null) {
                return@forEach
            }
            add(
                ReferenceBenchmarkDefinition(
                    key = option.key,
                    label = option.label,
                    symbol = symbol
                )
            )
        }
    }

    companion object {
        private val SYSTEM_REFERENCE_KEYS = setOf(
            BenchmarkKey.VWRA,
            BenchmarkKey.INFLATION,
            BenchmarkKey.TARGET_MIX
        )
    }
}

data class SavePortfolioBenchmarkSettingsCommand(
    val enabledKeys: List<BenchmarkKey>,
    val pinnedKeys: List<BenchmarkKey>,
    val customLabel: String?,
    val customSymbol: String?
)

data class BenchmarkOptionDefinition(
    val key: BenchmarkKey,
    val label: String,
    val symbol: String?,
    val kind: BenchmarkOptionKind,
    val configurable: Boolean,
    val defaultEnabled: Boolean,
    val defaultPinned: Boolean
)

enum class BenchmarkOptionKind {
    SYSTEM,
    MULTI_ASSET,
    CUSTOM
}

data class ReferenceBenchmarkDefinition(
    val key: BenchmarkKey,
    val label: String,
    val symbol: String
)

@Serializable
private data class StoredBenchmarkSettings(
    val enabledKeys: List<String>,
    val pinnedKeys: List<String>,
    val customLabel: String?,
    val customSymbol: String?
)
