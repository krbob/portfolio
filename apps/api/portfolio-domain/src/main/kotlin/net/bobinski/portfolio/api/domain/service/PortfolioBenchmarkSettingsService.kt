package net.bobinski.portfolio.api.domain.service

import java.time.Clock
import kotlinx.serialization.Serializable
import net.bobinski.portfolio.api.domain.model.AuditEventCategory

class PortfolioBenchmarkSettingsService(
    private val appPreferenceService: AppPreferenceService,
    private val auditLogService: AuditLogService,
    private val clock: Clock,
    private val valuationProbeService: ValuationProbeService = object : ValuationProbeService {
        override suspend fun verifyStockAnalystSymbol(symbol: String) = Unit
    }
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
        val normalized = normalize(command)
        validateCustomBenchmarks(normalized.customBenchmarks)

        val configuredCustomBenchmarks = normalized.customBenchmarks
            .filter { it.label.isNotBlank() && it.symbol.isNotBlank() }
        verifyCustomSymbols(configuredCustomBenchmarks)
        validateSelections(
            enabledKeys = normalized.enabledKeys,
            pinnedKeys = normalized.pinnedKeys,
            configuredCustomBenchmarks = configuredCustomBenchmarks
        )

        val stored = storedSettings(
            enabledKeys = normalized.enabledKeys,
            pinnedKeys = normalized.pinnedKeys,
            customBenchmarks = configuredCustomBenchmarks
        )
        appPreferenceService.put(
            key = PREFERENCE_KEY,
            serializer = StoredBenchmarkSettings.serializer(),
            value = stored
        )
        recordUpdate(stored)
        return normalize(stored)
    }

    private fun normalize(stored: StoredBenchmarkSettings): PortfolioBenchmarkSettings {
        val configuredCustomBenchmarks = stored.customBenchmarks
            .mapNotNull { benchmark ->
                val key = normalizeKey(benchmark.key)
                if (key.isBlank() || key in BUILT_IN_KEYS) {
                    return@mapNotNull null
                }
                val label = benchmark.label.trim()
                val symbol = benchmark.symbol.trim().uppercase()
                if (label.isBlank() || symbol.isBlank()) {
                    return@mapNotNull null
                }
                CustomBenchmarkDefinition(
                    key = key,
                    label = label,
                    symbol = symbol
                )
            }
        val configuredCustomKeys = configuredCustomBenchmarks.map(CustomBenchmarkDefinition::key).toSet()
        val supportedKeys = BUILT_IN_KEYS + configuredCustomKeys
        val enabledKeys = stored.enabledKeys
            .map(::normalizeKey)
            .filterTo(linkedSetOf()) { key -> key in supportedKeys }
            .ifEmpty {
                defaultStoredSettings().enabledKeys
                    .map(::normalizeKey)
                    .toCollection(linkedSetOf())
            }
        val pinnedKeys = stored.pinnedKeys
            .map(::normalizeKey)
            .filterTo(linkedSetOf()) { key -> key in enabledKeys }

        return PortfolioBenchmarkSettings(
            enabledKeys = enabledKeys.toList(),
            pinnedKeys = pinnedKeys.toList(),
            customBenchmarks = configuredCustomBenchmarks,
            options = DEFAULT_OPTIONS + configuredCustomBenchmarks.map { benchmark ->
                BenchmarkOptionDefinition(
                    key = benchmark.key,
                    label = benchmark.label,
                    symbol = benchmark.symbol,
                    kind = BenchmarkOptionKind.CUSTOM,
                    configurable = true,
                    defaultEnabled = false,
                    defaultPinned = false
                )
            }
        )
    }

    private fun normalizeKey(key: String): String = key.trim().uppercase()

    private fun normalize(command: SavePortfolioBenchmarkSettingsCommand): NormalizedBenchmarkSettingsCommand = NormalizedBenchmarkSettingsCommand(
        enabledKeys = command.enabledKeys
            .map(::normalizeKey)
            .distinct(),
        pinnedKeys = command.pinnedKeys
            .map(::normalizeKey)
            .distinct(),
        customBenchmarks = command.customBenchmarks.map { benchmark ->
            CustomBenchmarkDefinition(
                key = normalizeKey(benchmark.key),
                label = benchmark.label.trim(),
                symbol = benchmark.symbol.trim().uppercase()
            )
        }
    )

    private fun validateCustomBenchmarks(customBenchmarks: List<CustomBenchmarkDefinition>) {
        require(customBenchmarks.map(CustomBenchmarkDefinition::key).distinct().size == customBenchmarks.size) {
            "Custom benchmark keys must be unique."
        }
        require(customBenchmarks.none { it.key.isBlank() }) {
            "Custom benchmark keys must not be blank."
        }
        require(customBenchmarks.none { it.key in BUILT_IN_KEYS }) {
            "Custom benchmark keys must not reuse built-in benchmark keys."
        }
        require(customBenchmarks.all { CUSTOM_KEY_PATTERN.matches(it.key) }) {
            "Custom benchmark keys must use only letters, digits, underscores or hyphens."
        }
        customBenchmarks.forEach { benchmark ->
            require((benchmark.label.isBlank() && benchmark.symbol.isBlank()) || (benchmark.label.isNotBlank() && benchmark.symbol.isNotBlank())) {
                "Custom benchmark label and symbol must either both be set or both be empty."
            }
        }
    }

    private suspend fun verifyCustomSymbols(customBenchmarks: List<CustomBenchmarkDefinition>) {
        customBenchmarks
            .map(CustomBenchmarkDefinition::symbol)
            .distinct()
            .forEach { symbol ->
                valuationProbeService.verifyStockAnalystSymbol(symbol)
            }
    }

    private fun validateSelections(
        enabledKeys: List<String>,
        pinnedKeys: List<String>,
        configuredCustomBenchmarks: List<CustomBenchmarkDefinition>
    ) {
        val configuredCustomKeys = configuredCustomBenchmarks.map(CustomBenchmarkDefinition::key).toSet()
        val supportedKeys = BUILT_IN_KEYS + configuredCustomKeys
        require(enabledKeys.all { it in supportedKeys }) {
            "Benchmark settings contain unsupported keys."
        }
        require(pinnedKeys.all { it in enabledKeys }) {
            "Pinned benchmarks must be enabled."
        }
        require(enabledKeys.none { it !in BUILT_IN_KEYS && it !in configuredCustomKeys }) {
            "Enabled custom benchmarks must provide both a label and a symbol."
        }
        require(pinnedKeys.none { it !in BUILT_IN_KEYS && it !in configuredCustomKeys }) {
            "Pinned custom benchmarks must provide both a label and a symbol."
        }
    }

    private fun storedSettings(
        enabledKeys: List<String>,
        pinnedKeys: List<String>,
        customBenchmarks: List<CustomBenchmarkDefinition>
    ): StoredBenchmarkSettings = StoredBenchmarkSettings(
        enabledKeys = enabledKeys,
        pinnedKeys = pinnedKeys,
        customBenchmarks = customBenchmarks.map { benchmark ->
            StoredCustomBenchmark(
                key = benchmark.key,
                label = benchmark.label,
                symbol = benchmark.symbol
            )
        }
    )

    private suspend fun recordUpdate(stored: StoredBenchmarkSettings) {
        auditLogService.record(
            category = AuditEventCategory.SYSTEM,
            action = "BENCHMARK_SETTINGS_UPDATED",
            entityType = "BENCHMARK_SETTINGS",
            message = "Updated benchmark configuration.",
            metadata = mapOf(
                "enabledKeys" to stored.enabledKeys.joinToString(","),
                "pinnedKeys" to stored.pinnedKeys.joinToString(","),
                "customSymbols" to stored.customBenchmarks.joinToString(",") { it.symbol },
                "updatedAt" to java.time.Instant.now(clock).toString()
            )
        )
    }

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
                BenchmarkKey.V20A.name,
                BenchmarkKey.VAGF.name
            ),
            pinnedKeys = listOf(
                BenchmarkKey.VWRA.name,
                BenchmarkKey.INFLATION.name,
                BenchmarkKey.TARGET_MIX.name
            ),
            customBenchmarks = emptyList()
        )

        private val DEFAULT_OPTIONS = listOf(
            BenchmarkOptionDefinition(
                key = BenchmarkKey.VWRA.name,
                label = "VWRA benchmark",
                symbol = "VWRA.L",
                kind = BenchmarkOptionKind.SYSTEM,
                configurable = true,
                defaultEnabled = true,
                defaultPinned = true
            ),
            BenchmarkOptionDefinition(
                key = BenchmarkKey.INFLATION.name,
                label = "Inflation benchmark",
                symbol = null,
                kind = BenchmarkOptionKind.SYSTEM,
                configurable = true,
                defaultEnabled = true,
                defaultPinned = true
            ),
            BenchmarkOptionDefinition(
                key = BenchmarkKey.TARGET_MIX.name,
                label = "Configured target mix",
                symbol = null,
                kind = BenchmarkOptionKind.SYSTEM,
                configurable = true,
                defaultEnabled = true,
                defaultPinned = true
            ),
            BenchmarkOptionDefinition(
                key = BenchmarkKey.V80A.name,
                label = "V80A 80/20 benchmark",
                symbol = "V80A.DE",
                kind = BenchmarkOptionKind.MULTI_ASSET,
                configurable = true,
                defaultEnabled = true,
                defaultPinned = false
            ),
            BenchmarkOptionDefinition(
                key = BenchmarkKey.V60A.name,
                label = "V60A 60/40 benchmark",
                symbol = "V60A.DE",
                kind = BenchmarkOptionKind.MULTI_ASSET,
                configurable = true,
                defaultEnabled = true,
                defaultPinned = false
            ),
            BenchmarkOptionDefinition(
                key = BenchmarkKey.V40A.name,
                label = "V40A 40/60 benchmark",
                symbol = "V40A.DE",
                kind = BenchmarkOptionKind.MULTI_ASSET,
                configurable = true,
                defaultEnabled = true,
                defaultPinned = false
            ),
            BenchmarkOptionDefinition(
                key = BenchmarkKey.V20A.name,
                label = "V20A 20/80 benchmark",
                symbol = "V20A.DE",
                kind = BenchmarkOptionKind.MULTI_ASSET,
                configurable = true,
                defaultEnabled = true,
                defaultPinned = false
            ),
            BenchmarkOptionDefinition(
                key = BenchmarkKey.VAGF.name,
                label = "VAGF 0/100 benchmark",
                symbol = "VAGF.DE",
                kind = BenchmarkOptionKind.MULTI_ASSET,
                configurable = true,
                defaultEnabled = true,
                defaultPinned = false
            )
        )

        private val BUILT_IN_KEYS = DEFAULT_OPTIONS.map(BenchmarkOptionDefinition::key).toSet()
        private val CUSTOM_KEY_PATTERN = Regex("[A-Z0-9_-]+")
        private val SYSTEM_REFERENCE_KEYS = setOf(
            BenchmarkKey.VWRA.name,
            BenchmarkKey.INFLATION.name,
            BenchmarkKey.TARGET_MIX.name
        )
    }
}

private data class NormalizedBenchmarkSettingsCommand(
    val enabledKeys: List<String>,
    val pinnedKeys: List<String>,
    val customBenchmarks: List<CustomBenchmarkDefinition>
)

data class PortfolioBenchmarkSettings(
    val enabledKeys: List<String>,
    val pinnedKeys: List<String>,
    val customBenchmarks: List<CustomBenchmarkDefinition>,
    val options: List<BenchmarkOptionDefinition>
) {
    fun isEnabled(key: BenchmarkKey): Boolean = isEnabled(key.name)

    fun isEnabled(key: String): Boolean = key in enabledKeys

    fun isPinned(key: BenchmarkKey): Boolean = isPinned(key.name)

    fun isPinned(key: String): Boolean = key in pinnedKeys

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
            BenchmarkKey.VWRA.name,
            BenchmarkKey.INFLATION.name,
            BenchmarkKey.TARGET_MIX.name
        )
    }
}

data class SavePortfolioBenchmarkSettingsCommand(
    val enabledKeys: List<String>,
    val pinnedKeys: List<String>,
    val customBenchmarks: List<SaveCustomBenchmarkCommand>
)

data class BenchmarkOptionDefinition(
    val key: String,
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
    val key: String,
    val label: String,
    val symbol: String
)

data class CustomBenchmarkDefinition(
    val key: String,
    val label: String,
    val symbol: String
)

data class SaveCustomBenchmarkCommand(
    val key: String,
    val label: String,
    val symbol: String
)

@Serializable
private data class StoredBenchmarkSettings(
    val enabledKeys: List<String>,
    val pinnedKeys: List<String>,
    val customBenchmarks: List<StoredCustomBenchmark>
)

@Serializable
private data class StoredCustomBenchmark(
    val key: String,
    val label: String,
    val symbol: String
)
