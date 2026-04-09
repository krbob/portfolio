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
        val supportedKeys = BenchmarkKey.entries.toSet()
        val customBenchmarks = command.customBenchmarks
            .map { benchmark ->
                CustomBenchmarkDefinition(
                    key = benchmark.key,
                    label = benchmark.label.trim(),
                    symbol = benchmark.symbol.trim().uppercase()
                )
            }
        require(customBenchmarks.size <= MAX_CUSTOM_BENCHMARKS) {
            "Benchmark settings support at most $MAX_CUSTOM_BENCHMARKS custom benchmarks."
        }
        require(customBenchmarks.map(CustomBenchmarkDefinition::key).distinct().size == customBenchmarks.size) {
            "Custom benchmark keys must be unique."
        }
        require(customBenchmarks.all { it.key in CUSTOM_KEYS }) {
            "Custom benchmark settings contain unsupported keys."
        }
        customBenchmarks.forEach { benchmark ->
            require((benchmark.label.isBlank() && benchmark.symbol.isBlank()) || (benchmark.label.isNotBlank() && benchmark.symbol.isNotBlank())) {
                "Custom benchmark label and symbol must either both be set or both be empty."
            }
        }
        val configuredCustomBenchmarks = customBenchmarks.filter { it.label.isNotBlank() && it.symbol.isNotBlank() }
        val configuredCustomKeys = configuredCustomBenchmarks.map(CustomBenchmarkDefinition::key).toSet()
        require(command.enabledKeys.all { it in supportedKeys }) {
            "Benchmark settings contain unsupported keys."
        }
        require(command.pinnedKeys.all { it in command.enabledKeys }) {
            "Pinned benchmarks must be enabled."
        }
        require(command.enabledKeys.none { it in CUSTOM_KEYS && it !in configuredCustomKeys }) {
            "Enabled custom benchmarks must provide both a label and a symbol."
        }
        require(command.pinnedKeys.none { it in CUSTOM_KEYS && it !in configuredCustomKeys }) {
            "Pinned custom benchmarks must provide both a label and a symbol."
        }

        val stored = StoredBenchmarkSettings(
            enabledKeys = command.enabledKeys.map(BenchmarkKey::name).distinct(),
            pinnedKeys = command.pinnedKeys.map(BenchmarkKey::name).distinct(),
            customBenchmarks = configuredCustomBenchmarks.map { benchmark ->
                StoredCustomBenchmark(
                    key = benchmark.key.name,
                    label = benchmark.label,
                    symbol = benchmark.symbol
                )
            }
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
                "customSymbols" to stored.customBenchmarks.joinToString(",") { it.symbol },
                "updatedAt" to java.time.Instant.now(clock).toString()
            )
        )
        return normalize(stored)
    }

    private fun normalize(stored: StoredBenchmarkSettings): PortfolioBenchmarkSettings {
        val configuredCustomBenchmarks = stored.customBenchmarks
            .mapNotNull { benchmark ->
                val key = benchmark.key.toBenchmarkKeyOrNull()
                if (key == null || key !in CUSTOM_KEYS) {
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
        val supportedKeys = BenchmarkKey.entries.toSet()
        val enabledKeys = stored.enabledKeys
            .mapNotNull { raw -> raw.toBenchmarkKeyOrNull() }
            .filterTo(linkedSetOf()) { key ->
                key in supportedKeys && (key !in CUSTOM_KEYS || configuredCustomBenchmarks.any { it.key == key })
            }
            .ifEmpty {
                defaultStoredSettings().enabledKeys
                    .mapNotNull { raw -> raw.toBenchmarkKeyOrNull() }
                    .toCollection(linkedSetOf())
            }
        val pinnedKeys = stored.pinnedKeys
            .mapNotNull { raw -> raw.toBenchmarkKeyOrNull() }
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
            ),
            BenchmarkOptionDefinition(
                key = BenchmarkKey.VAGF,
                label = "VAGF 0/100 benchmark",
                symbol = "VAGF.DE",
                kind = BenchmarkOptionKind.MULTI_ASSET,
                configurable = true,
                defaultEnabled = true,
                defaultPinned = false
            )
        )

        val CUSTOM_KEYS = listOf(
            BenchmarkKey.CUSTOM_1,
            BenchmarkKey.CUSTOM_2,
            BenchmarkKey.CUSTOM_3
        )
        const val MAX_CUSTOM_BENCHMARKS = 3
    }
}

data class PortfolioBenchmarkSettings(
    val enabledKeys: List<BenchmarkKey>,
    val pinnedKeys: List<BenchmarkKey>,
    val customBenchmarks: List<CustomBenchmarkDefinition>,
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
    val customBenchmarks: List<SaveCustomBenchmarkCommand>
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

data class CustomBenchmarkDefinition(
    val key: BenchmarkKey,
    val label: String,
    val symbol: String
)

data class SaveCustomBenchmarkCommand(
    val key: BenchmarkKey,
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
