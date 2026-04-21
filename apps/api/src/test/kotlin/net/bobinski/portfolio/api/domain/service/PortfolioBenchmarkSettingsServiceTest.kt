package net.bobinski.portfolio.api.domain.service

import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import kotlinx.coroutines.runBlocking
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryAppPreferenceRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryAuditEventRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test

class PortfolioBenchmarkSettingsServiceTest {

    private val clock: Clock = Clock.fixed(Instant.parse("2026-04-09T12:00:00Z"), ZoneOffset.UTC)

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

    private fun benchmarkSettingsService(probe: ValuationProbeService) = PortfolioBenchmarkSettingsService(
        appPreferenceService = AppPreferenceService(
            repository = InMemoryAppPreferenceRepository(),
            json = net.bobinski.portfolio.api.config.AppJsonFactory.create(),
            clock = clock
        ),
        auditLogService = AuditLogService(InMemoryAuditEventRepository(), clock),
        clock = clock,
        valuationProbeService = probe
    )

    private class RecordingValuationProbeService : ValuationProbeService {
        val requestedSymbols = mutableListOf<String>()

        override suspend fun verifyStockAnalystSymbol(symbol: String) {
            requestedSymbols += symbol
        }
    }
}
