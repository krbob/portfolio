package net.bobinski.portfolio.api.domain.service

import java.time.Clock
import java.time.LocalDate
import java.time.format.DateTimeParseException
import kotlinx.serialization.Serializable
import net.bobinski.portfolio.api.domain.model.AuditEventCategory

class PortfolioBenchmarkSettingsService(
    private val appPreferenceService: AppPreferenceService,
    private val auditLogService: AuditLogService,
    private val clock: Clock,
    defaultEquityBenchmarkSymbol: String = DEFAULT_EQUITY_BENCHMARK_SYMBOL,
    private val valuationProbeService: ValuationProbeService = object : ValuationProbeService {
        override suspend fun verifyStockAnalystSymbol(symbol: String) = Unit
    }
) {
    private val normalizedDefaultEquityBenchmarkSymbol = defaultEquityBenchmarkSymbol.trim().uppercase().also { symbol ->
        require(symbol.isNotBlank()) { "Default equity benchmark symbol must not be blank." }
    }

    suspend fun settings(): PortfolioBenchmarkSettings {
        val stored = appPreferenceService.get(
            key = PREFERENCE_KEY,
            serializer = StoredBenchmarkSettings.serializer(),
            defaultValue = ::defaultStoredSettings
        )
        return normalize(stored)
    }

    suspend fun update(command: SavePortfolioBenchmarkSettingsCommand): PortfolioBenchmarkSettings {
        val current = settings()
        val normalized = normalize(
            command = command,
            existingEquityBenchmarkSchedule = current.equityBenchmarkSchedule
        )
        validateCustomBenchmarks(normalized.customBenchmarks)
        validateEquityBenchmarkSchedule(normalized.equityBenchmarkSchedule)

        val configuredCustomBenchmarks = normalized.customBenchmarks
            .filter { it.label.isNotBlank() && it.symbol.isNotBlank() }
        verifyCustomSymbols(configuredCustomBenchmarks)
        if (command.equityBenchmarkSchedule != null) {
            verifyChangedEquityBenchmarkPhases(
                schedule = normalized.equityBenchmarkSchedule,
                existingSchedule = current.equityBenchmarkSchedule
            )
        }
        validateSelections(
            enabledKeys = normalized.enabledKeys,
            pinnedKeys = normalized.pinnedKeys,
            configuredCustomBenchmarks = configuredCustomBenchmarks
        )

        val stored = storedSettings(
            enabledKeys = normalized.enabledKeys,
            pinnedKeys = normalized.pinnedKeys,
            customBenchmarks = configuredCustomBenchmarks,
            equityBenchmarkSchedule = normalized.equityBenchmarkSchedule
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
        val equityBenchmarkSchedule = normalizeStoredEquityBenchmarkSchedule(stored.equityBenchmarkSchedule)

        return PortfolioBenchmarkSettings(
            enabledKeys = enabledKeys.toList(),
            pinnedKeys = pinnedKeys.toList(),
            customBenchmarks = configuredCustomBenchmarks,
            equityBenchmarkSchedule = equityBenchmarkSchedule,
            options = defaultOptions() + configuredCustomBenchmarks.map { benchmark ->
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

    private fun normalize(
        command: SavePortfolioBenchmarkSettingsCommand,
        existingEquityBenchmarkSchedule: List<EquityBenchmarkPhase>
    ): NormalizedBenchmarkSettingsCommand = NormalizedBenchmarkSettingsCommand(
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
        },
        equityBenchmarkSchedule = command.equityBenchmarkSchedule
            ?.map { phase ->
                EquityBenchmarkPhase(
                    effectiveFrom = phase.effectiveFrom,
                    symbol = phase.symbol.trim().uppercase()
                )
            }
            ?.ifEmpty(::defaultEquityBenchmarkSchedule)
            ?: existingEquityBenchmarkSchedule
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

    private fun validateEquityBenchmarkSchedule(schedule: List<EquityBenchmarkPhase>) {
        require(schedule.isNotEmpty()) {
            "Equity benchmark schedule must contain a base phase."
        }
        require(schedule.first().effectiveFrom == null && schedule.drop(1).none { it.effectiveFrom == null }) {
            "Equity benchmark schedule must start with exactly one undated base phase."
        }
        require(schedule.all { phase -> phase.symbol.isNotBlank() && phase.symbol == phase.symbol.uppercase() }) {
            "Equity benchmark schedule symbols must be non-blank and uppercase."
        }
        val effectiveDates = schedule.drop(1).map { phase -> requireNotNull(phase.effectiveFrom) }
        require(effectiveDates.zipWithNext().all { (previous, current) -> previous < current }) {
            "Equity benchmark schedule dates must be unique and strictly increasing."
        }
    }

    private fun normalizeStoredEquityBenchmarkSchedule(
        storedSchedule: List<StoredEquityBenchmarkPhase>
    ): List<EquityBenchmarkPhase> {
        if (storedSchedule.isEmpty()) {
            return defaultEquityBenchmarkSchedule()
        }
        val schedule = try {
            storedSchedule.map { phase ->
                EquityBenchmarkPhase(
                    effectiveFrom = phase.effectiveFrom?.let(LocalDate::parse),
                    symbol = phase.symbol.trim().uppercase()
                )
            }
        } catch (_: DateTimeParseException) {
            return defaultEquityBenchmarkSchedule()
        }

        return try {
            validateEquityBenchmarkSchedule(schedule)
            schedule
        } catch (_: IllegalArgumentException) {
            defaultEquityBenchmarkSchedule()
        }
    }

    private suspend fun verifyChangedEquityBenchmarkPhases(
        schedule: List<EquityBenchmarkPhase>,
        existingSchedule: List<EquityBenchmarkPhase>
    ) {
        schedule
            .filterNot(existingSchedule::contains)
            .distinct()
            .forEach { phase ->
                valuationProbeService.verifyStockAnalystBenchmarkPhase(
                    symbol = phase.symbol,
                    effectiveFrom = phase.effectiveFrom
                )
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
        customBenchmarks: List<CustomBenchmarkDefinition>,
        equityBenchmarkSchedule: List<EquityBenchmarkPhase>
    ): StoredBenchmarkSettings = StoredBenchmarkSettings(
        enabledKeys = enabledKeys,
        pinnedKeys = pinnedKeys,
        customBenchmarks = customBenchmarks.map { benchmark ->
            StoredCustomBenchmark(
                key = benchmark.key,
                label = benchmark.label,
                symbol = benchmark.symbol
            )
        },
        equityBenchmarkSchedule = equityBenchmarkSchedule.map { phase ->
            StoredEquityBenchmarkPhase(
                effectiveFrom = phase.effectiveFrom?.toString(),
                symbol = phase.symbol
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
                "equityBenchmarkSchedule" to stored.equityBenchmarkSchedule.joinToString(",") { phase ->
                    "${phase.effectiveFrom ?: "BASE"}:${phase.symbol}"
                },
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
            customBenchmarks = emptyList(),
            equityBenchmarkSchedule = emptyList()
        )

        private val BUILT_IN_KEYS = setOf(
            BenchmarkKey.VWRA.name,
            BenchmarkKey.INFLATION.name,
            BenchmarkKey.TARGET_MIX.name,
            BenchmarkKey.V80A.name,
            BenchmarkKey.V60A.name,
            BenchmarkKey.V40A.name,
            BenchmarkKey.V20A.name,
            BenchmarkKey.VAGF.name
        )
        private val CUSTOM_KEY_PATTERN = Regex("[A-Z0-9_-]+")
        private const val DEFAULT_EQUITY_BENCHMARK_SYMBOL = "VWRA.L"
    }

    private fun defaultEquityBenchmarkSchedule() = listOf(
        EquityBenchmarkPhase(
            effectiveFrom = null,
            symbol = normalizedDefaultEquityBenchmarkSymbol
        )
    )

    private fun defaultOptions() = listOf(
        BenchmarkOptionDefinition(
            key = BenchmarkKey.VWRA.name,
            label = "Global equity benchmark",
            symbol = null,
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
}

private data class NormalizedBenchmarkSettingsCommand(
    val enabledKeys: List<String>,
    val pinnedKeys: List<String>,
    val customBenchmarks: List<CustomBenchmarkDefinition>,
    val equityBenchmarkSchedule: List<EquityBenchmarkPhase>
)

data class PortfolioBenchmarkSettings(
    val enabledKeys: List<String>,
    val pinnedKeys: List<String>,
    val customBenchmarks: List<CustomBenchmarkDefinition>,
    val equityBenchmarkSchedule: List<EquityBenchmarkPhase>,
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
    val customBenchmarks: List<SaveCustomBenchmarkCommand>,
    val equityBenchmarkSchedule: List<SaveEquityBenchmarkPhaseCommand>? = null
)

data class EquityBenchmarkPhase(
    val effectiveFrom: LocalDate?,
    val symbol: String
)

data class SaveEquityBenchmarkPhaseCommand(
    val effectiveFrom: LocalDate?,
    val symbol: String
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
    val customBenchmarks: List<StoredCustomBenchmark>,
    val equityBenchmarkSchedule: List<StoredEquityBenchmarkPhase> = emptyList()
)

@Serializable
private data class StoredCustomBenchmark(
    val key: String,
    val label: String,
    val symbol: String
)

@Serializable
private data class StoredEquityBenchmarkPhase(
    val effectiveFrom: String?,
    val symbol: String
)
