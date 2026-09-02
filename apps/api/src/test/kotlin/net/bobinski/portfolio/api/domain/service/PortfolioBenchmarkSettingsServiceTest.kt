package net.bobinski.portfolio.api.domain.service

import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import kotlinx.coroutines.runBlocking
import net.bobinski.portfolio.api.domain.model.AppPreference
import net.bobinski.portfolio.api.domain.repository.AppPreferenceRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryAppPreferenceRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryAuditEventRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test

class PortfolioBenchmarkSettingsServiceTest {

    private val clock: Clock = Clock.fixed(Instant.parse("2026-04-09T12:00:00Z"), ZoneOffset.UTC)

    @Test
    fun `stored settings without an equity schedule use the configured default`() = runBlocking {
        val repository = InMemoryAppPreferenceRepository()
        repository.save(
            AppPreference(
                key = PortfolioBenchmarkSettingsService.PREFERENCE_KEY,
                valueJson =
                    """
                    {
                      "enabledKeys": ["VWRA"],
                      "pinnedKeys": ["VWRA"],
                      "customBenchmarks": []
                    }
                    """.trimIndent(),
                updatedAt = clock.instant()
            )
        )

        val settings = benchmarkSettingsService(
            probe = RecordingValuationProbeService(),
            repository = repository,
            defaultEquityBenchmarkSymbol = "default.ex"
        ).settings()

        assertEquals(
            listOf(EquityBenchmarkPhase(effectiveFrom = null, symbol = "DEFAULT.EX")),
            settings.equityBenchmarkSchedule
        )
        assertEquals(null, settings.options.single { option -> option.key == BenchmarkKey.VWRA.name }.symbol)
    }

    @Test
    fun `stored schedule with an invalid date falls back to the configured default`() = runBlocking {
        assertStoredScheduleFallsBack(
            """
            [
              {"effectiveFrom": null, "symbol": "OLD.EX"},
              {"effectiveFrom": "not-a-date", "symbol": "NEW.EX"}
            ]
            """.trimIndent()
        )
    }

    @Test
    fun `stored schedule without a base phase falls back to the configured default`() = runBlocking {
        assertStoredScheduleFallsBack(
            """
            [
              {"effectiveFrom": "2026-08-20", "symbol": "NEW.EX"}
            ]
            """.trimIndent()
        )
    }

    @Test
    fun `stored schedule with out-of-order phases falls back to the configured default`() = runBlocking {
        assertStoredScheduleFallsBack(
            """
            [
              {"effectiveFrom": null, "symbol": "OLD.EX"},
              {"effectiveFrom": "2026-08-21", "symbol": "NEWER.EX"},
              {"effectiveFrom": "2026-08-20", "symbol": "NEW.EX"}
            ]
            """.trimIndent()
        )
    }

    @Test
    fun `saving an equity schedule normalizes and verifies every configured symbol`() = runBlocking {
        val probe = RecordingValuationProbeService()
        val service = benchmarkSettingsService(probe)

        val settings = service.update(
            SavePortfolioBenchmarkSettingsCommand(
                enabledKeys = listOf(BenchmarkKey.VWRA.name),
                pinnedKeys = listOf(BenchmarkKey.VWRA.name),
                customBenchmarks = emptyList(),
                equityBenchmarkSchedule = listOf(
                    SaveEquityBenchmarkPhaseCommand(effectiveFrom = null, symbol = " old.ex "),
                    SaveEquityBenchmarkPhaseCommand(
                        effectiveFrom = LocalDate.parse("2026-08-20"),
                        symbol = " new.ex "
                    )
                )
            )
        )

        assertEquals(
            listOf(
                EquityBenchmarkPhase(effectiveFrom = null, symbol = "OLD.EX"),
                EquityBenchmarkPhase(effectiveFrom = LocalDate.parse("2026-08-20"), symbol = "NEW.EX")
            ),
            settings.equityBenchmarkSchedule
        )
        assertEquals(listOf("OLD.EX", "NEW.EX"), probe.requestedSymbols)
    }

    @Test
    fun `omitted schedule preserves it while an explicit empty schedule restores the default`() = runBlocking {
        val probe = RecordingValuationProbeService()
        val service = benchmarkSettingsService(probe)
        service.update(
            SavePortfolioBenchmarkSettingsCommand(
                enabledKeys = listOf(BenchmarkKey.VWRA.name),
                pinnedKeys = emptyList(),
                customBenchmarks = emptyList(),
                equityBenchmarkSchedule = listOf(
                    SaveEquityBenchmarkPhaseCommand(effectiveFrom = null, symbol = "OLD.EX"),
                    SaveEquityBenchmarkPhaseCommand(
                        effectiveFrom = LocalDate.parse("2026-08-20"),
                        symbol = "NEW.EX"
                    )
                )
            )
        )
        probe.requestedSymbols.clear()

        val preserved = service.update(
            SavePortfolioBenchmarkSettingsCommand(
                enabledKeys = listOf(BenchmarkKey.VWRA.name),
                pinnedKeys = listOf(BenchmarkKey.VWRA.name),
                customBenchmarks = emptyList()
            )
        )

        assertEquals(listOf("OLD.EX", "NEW.EX"), preserved.equityBenchmarkSchedule.map(EquityBenchmarkPhase::symbol))
        assertEquals(emptyList<String>(), probe.requestedSymbols)

        val restored = service.update(
            SavePortfolioBenchmarkSettingsCommand(
                enabledKeys = listOf(BenchmarkKey.VWRA.name),
                pinnedKeys = emptyList(),
                customBenchmarks = emptyList(),
                equityBenchmarkSchedule = emptyList()
            )
        )

        assertEquals(
            listOf(EquityBenchmarkPhase(effectiveFrom = null, symbol = "VWRA.L")),
            restored.equityBenchmarkSchedule
        )
        assertEquals(listOf("VWRA.L"), probe.requestedSymbols)
    }

    @Test
    fun `resaving an unchanged schedule does not re-probe historical phases`() = runBlocking {
        val probe = RecordingValuationProbeService()
        val service = benchmarkSettingsService(probe)
        val schedule = listOf(
            SaveEquityBenchmarkPhaseCommand(effectiveFrom = null, symbol = "VWRA.L"),
            SaveEquityBenchmarkPhaseCommand(
                effectiveFrom = LocalDate.parse("2026-08-20"),
                symbol = "VGLA.DE"
            )
        )
        service.update(
            SavePortfolioBenchmarkSettingsCommand(
                enabledKeys = listOf(BenchmarkKey.VWRA.name),
                pinnedKeys = emptyList(),
                customBenchmarks = emptyList(),
                equityBenchmarkSchedule = schedule
            )
        )
        probe.requestedSymbols.clear()

        service.update(
            SavePortfolioBenchmarkSettingsCommand(
                enabledKeys = listOf(BenchmarkKey.VWRA.name, BenchmarkKey.INFLATION.name),
                pinnedKeys = emptyList(),
                customBenchmarks = emptyList(),
                equityBenchmarkSchedule = schedule
            )
        )

        assertEquals(emptyList<String>(), probe.requestedSymbols)
    }

    @Test
    fun `equity schedule requires one base phase followed by strictly increasing dates`() {
        val invalidSchedules = listOf(
            listOf(
                SaveEquityBenchmarkPhaseCommand(LocalDate.parse("2026-08-20"), "NEW.EX")
            ),
            listOf(
                SaveEquityBenchmarkPhaseCommand(null, "OLD.EX"),
                SaveEquityBenchmarkPhaseCommand(null, "NEW.EX")
            ),
            listOf(
                SaveEquityBenchmarkPhaseCommand(null, "OLD.EX"),
                SaveEquityBenchmarkPhaseCommand(LocalDate.parse("2026-08-21"), "NEW.EX"),
                SaveEquityBenchmarkPhaseCommand(LocalDate.parse("2026-08-20"), "NEWER.EX")
            ),
            listOf(
                SaveEquityBenchmarkPhaseCommand(null, "OLD.EX"),
                SaveEquityBenchmarkPhaseCommand(LocalDate.parse("2026-08-20"), "NEW.EX"),
                SaveEquityBenchmarkPhaseCommand(LocalDate.parse("2026-08-20"), "NEWER.EX")
            ),
            listOf(
                SaveEquityBenchmarkPhaseCommand(null, " ")
            )
        )

        invalidSchedules.forEach { schedule ->
            val service = benchmarkSettingsService(RecordingValuationProbeService())
            assertThrows(IllegalArgumentException::class.java) {
                runBlocking {
                    service.update(
                        SavePortfolioBenchmarkSettingsCommand(
                            enabledKeys = listOf(BenchmarkKey.VWRA.name),
                            pinnedKeys = emptyList(),
                            customBenchmarks = emptyList(),
                            equityBenchmarkSchedule = schedule
                        )
                    )
                }
            }
        }
    }

    @Test
    fun `saving custom benchmarks verifies distinct stock-analyst symbols`() = runBlocking {
        val probe = RecordingValuationProbeService()
        val service = benchmarkSettingsService(probe)

        service.update(
            SavePortfolioBenchmarkSettingsCommand(
                enabledKeys = listOf(BenchmarkKey.VWRA.name, "EUROPE_600", "WORLD_SMALL_CAP"),
                pinnedKeys = listOf(BenchmarkKey.VWRA.name),
                customBenchmarks = listOf(
                    SaveCustomBenchmarkCommand(
                        key = "EUROPE_600",
                        label = "Europe 600",
                        symbol = " exsa.de "
                    ),
                    SaveCustomBenchmarkCommand(
                        key = "WORLD_SMALL_CAP",
                        label = "World Small Cap",
                        symbol = "EXUS.DE"
                    )
                )
            )
        )

        assertEquals(listOf("EXSA.DE", "EXUS.DE"), probe.requestedSymbols)
    }

    @Test
    fun `saving invalid custom benchmark symbol fails before persisting`() = runBlocking {
        val service = benchmarkSettingsService(
            object : ValuationProbeService {
                override suspend fun verifyStockAnalystSymbol(symbol: String) {
                    throw IllegalArgumentException("Symbol '$symbol' could not be verified against stock-analyst.")
                }
            }
        )

        assertThrows(IllegalArgumentException::class.java) {
            runBlocking {
                service.update(
                    SavePortfolioBenchmarkSettingsCommand(
                        enabledKeys = listOf("BROKEN_BENCHMARK"),
                        pinnedKeys = emptyList(),
                        customBenchmarks = listOf(
                            SaveCustomBenchmarkCommand(
                                key = "BROKEN_BENCHMARK",
                                label = "Broken benchmark",
                                symbol = "BAD.SYMBOL"
                            )
                        )
                    )
                )
            }
        }

        assertEquals(emptyList<CustomBenchmarkDefinition>(), service.settings().customBenchmarks)
    }

    private fun benchmarkSettingsService(
        probe: ValuationProbeService,
        repository: AppPreferenceRepository = InMemoryAppPreferenceRepository(),
        defaultEquityBenchmarkSymbol: String = "VWRA.L"
    ) = PortfolioBenchmarkSettingsService(
        appPreferenceService = AppPreferenceService(
            repository = repository,
            json = net.bobinski.portfolio.api.config.AppJsonFactory.create(),
            clock = clock
        ),
        auditLogService = AuditLogService(InMemoryAuditEventRepository(), clock),
        clock = clock,
        defaultEquityBenchmarkSymbol = defaultEquityBenchmarkSymbol,
        valuationProbeService = probe
    )

    private suspend fun assertStoredScheduleFallsBack(scheduleJson: String) {
        val repository = InMemoryAppPreferenceRepository()
        repository.save(
            AppPreference(
                key = PortfolioBenchmarkSettingsService.PREFERENCE_KEY,
                valueJson =
                    """
                    {
                      "enabledKeys": ["VWRA"],
                      "pinnedKeys": ["VWRA"],
                      "customBenchmarks": [],
                      "equityBenchmarkSchedule": $scheduleJson
                    }
                    """.trimIndent(),
                updatedAt = clock.instant()
            )
        )

        val settings = benchmarkSettingsService(
            probe = RecordingValuationProbeService(),
            repository = repository,
            defaultEquityBenchmarkSymbol = "default.ex"
        ).settings()

        assertEquals(
            listOf(EquityBenchmarkPhase(effectiveFrom = null, symbol = "DEFAULT.EX")),
            settings.equityBenchmarkSchedule
        )
    }

    private class RecordingValuationProbeService : ValuationProbeService {
        val requestedSymbols = mutableListOf<String>()

        override suspend fun verifyStockAnalystSymbol(symbol: String) {
            requestedSymbols += symbol
        }
    }
}
