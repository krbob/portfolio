package net.bobinski.portfolio.api.domain.service

import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import java.util.UUID
import kotlinx.coroutines.runBlocking
import net.bobinski.portfolio.api.domain.model.AssetClass
import net.bobinski.portfolio.api.domain.model.Instrument
import net.bobinski.portfolio.api.domain.model.InstrumentKind
import net.bobinski.portfolio.api.domain.model.ValuationSource
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryAuditEventRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryInstrumentRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test

class InstrumentServiceTest {

    private val clock: Clock = Clock.fixed(Instant.parse("2026-03-27T12:00:00Z"), ZoneOffset.UTC)

    @Test
    fun `switching an existing symbol from manual to stock analyst triggers probe`() = runBlocking {
        val instrumentRepository = InMemoryInstrumentRepository()
        val probe = RecordingValuationProbeService()
        val service = instrumentService(instrumentRepository, probe)
        val existing = instrument(valuationSource = ValuationSource.MANUAL)
        instrumentRepository.save(existing)

        val updated = service.update(
            UpdateInstrumentCommand(
                id = existing.id,
                name = existing.name,
                symbol = existing.symbol,
                currency = existing.currency,
                valuationSource = ValuationSource.STOCK_ANALYST
            )
        )

        assertEquals(listOf("VWRA.L"), probe.requestedSymbols)
        assertEquals(ValuationSource.STOCK_ANALYST, updated.valuationSource)
        assertEquals(ValuationSource.STOCK_ANALYST, instrumentRepository.get(existing.id)?.valuationSource)
    }

    @Test
    fun `creating an ordinary instrument with manual valuation is rejected`() = runBlocking {
        val instrumentRepository = InMemoryInstrumentRepository()
        val service = instrumentService(instrumentRepository, RecordingValuationProbeService())

        val exception = assertThrows(IllegalArgumentException::class.java) {
            runBlocking {
                service.create(
                    CreateInstrumentCommand(
                        name = "VWRA",
                        kind = InstrumentKind.ETF,
                        assetClass = AssetClass.EQUITIES,
                        symbol = "VWRA.L",
                        currency = "USD",
                        valuationSource = ValuationSource.MANUAL
                    )
                )
            }
        }

        assertEquals(
            "ETF instruments must use STOCK_ANALYST valuation; MANUAL is not supported.",
            exception.message
        )
        assertEquals(emptyList<Instrument>(), instrumentRepository.list())
    }

    @Test
    fun `creating an ordinary instrument with a different automated source is rejected`() = runBlocking {
        val instrumentRepository = InMemoryInstrumentRepository()
        val service = instrumentService(instrumentRepository, RecordingValuationProbeService())

        val exception = assertThrows(IllegalArgumentException::class.java) {
            runBlocking {
                service.create(
                    CreateInstrumentCommand(
                        name = "VWRA",
                        kind = InstrumentKind.ETF,
                        assetClass = AssetClass.EQUITIES,
                        symbol = "VWRA.L",
                        currency = "USD",
                        valuationSource = ValuationSource.EDO_CALCULATOR
                    )
                )
            }
        }

        assertEquals(
            "ETF instruments must use STOCK_ANALYST valuation; EDO_CALCULATOR is not supported.",
            exception.message
        )
        assertEquals(emptyList<Instrument>(), instrumentRepository.list())
    }

    @Test
    fun `creating a stock analyst instrument without a symbol is rejected`() = runBlocking {
        val instrumentRepository = InMemoryInstrumentRepository()
        val service = instrumentService(instrumentRepository, RecordingValuationProbeService())

        val exception = assertThrows(IllegalArgumentException::class.java) {
            runBlocking {
                service.create(
                    CreateInstrumentCommand(
                        name = "VWRA",
                        kind = InstrumentKind.ETF,
                        assetClass = AssetClass.EQUITIES,
                        symbol = null,
                        currency = "USD",
                        valuationSource = ValuationSource.STOCK_ANALYST
                    )
                )
            }
        }

        assertEquals(
            "ETF instruments using STOCK_ANALYST valuation require a market symbol.",
            exception.message
        )
        assertEquals(emptyList<Instrument>(), instrumentRepository.list())
    }

    @Test
    fun `switching a supported instrument to manual valuation is rejected without changing it`() = runBlocking {
        val instrumentRepository = InMemoryInstrumentRepository()
        val service = instrumentService(instrumentRepository, RecordingValuationProbeService())
        val existing = instrument(valuationSource = ValuationSource.STOCK_ANALYST)
        instrumentRepository.save(existing)

        val exception = assertThrows(IllegalArgumentException::class.java) {
            runBlocking {
                service.update(
                    UpdateInstrumentCommand(
                        id = existing.id,
                        name = "Changed name",
                        symbol = "V80A.DE",
                        currency = "EUR",
                        valuationSource = ValuationSource.MANUAL
                    )
                )
            }
        }

        assertEquals(
            "ETF instruments must use STOCK_ANALYST valuation; MANUAL is not supported.",
            exception.message
        )
        assertEquals(existing, instrumentRepository.get(existing.id))
    }

    @Test
    fun `legacy manual instrument can be edited without changing valuation source`() = runBlocking {
        val instrumentRepository = InMemoryInstrumentRepository()
        val probe = RecordingValuationProbeService()
        val service = instrumentService(instrumentRepository, probe)
        val existing = instrument(valuationSource = ValuationSource.MANUAL)
        instrumentRepository.save(existing)

        val updated = service.update(
            UpdateInstrumentCommand(
                id = existing.id,
                name = "VWRA renamed",
                symbol = existing.symbol,
                currency = existing.currency,
                valuationSource = ValuationSource.MANUAL
            )
        )

        assertEquals("VWRA renamed", updated.name)
        assertEquals(ValuationSource.MANUAL, updated.valuationSource)
        assertEquals(emptyList<String>(), probe.requestedSymbols)
        assertEquals(updated, instrumentRepository.get(existing.id))
    }

    @Test
    fun `removing the symbol from a supported instrument is rejected without changing it`() = runBlocking {
        val instrumentRepository = InMemoryInstrumentRepository()
        val service = instrumentService(instrumentRepository, RecordingValuationProbeService())
        val existing = instrument(valuationSource = ValuationSource.STOCK_ANALYST)
        instrumentRepository.save(existing)

        val exception = assertThrows(IllegalArgumentException::class.java) {
            runBlocking {
                service.update(
                    UpdateInstrumentCommand(
                        id = existing.id,
                        name = existing.name,
                        symbol = null,
                        currency = existing.currency,
                        valuationSource = ValuationSource.STOCK_ANALYST
                    )
                )
            }
        }

        assertEquals(
            "ETF instruments using STOCK_ANALYST valuation require a market symbol.",
            exception.message
        )
        assertEquals(existing, instrumentRepository.get(existing.id))
    }

    @Test
    fun `legacy stock analyst instrument without a symbol can still be edited`() = runBlocking {
        val instrumentRepository = InMemoryInstrumentRepository()
        val probe = RecordingValuationProbeService()
        val service = instrumentService(instrumentRepository, probe)
        val existing = instrument(valuationSource = ValuationSource.STOCK_ANALYST).copy(symbol = null)
        instrumentRepository.save(existing)

        val updated = service.update(
            UpdateInstrumentCommand(
                id = existing.id,
                name = "Legacy instrument renamed",
                symbol = null,
                currency = existing.currency,
                valuationSource = ValuationSource.STOCK_ANALYST
            )
        )

        assertEquals("Legacy instrument renamed", updated.name)
        assertEquals(null, updated.symbol)
        assertEquals(emptyList<String>(), probe.requestedSymbols)
        assertEquals(updated, instrumentRepository.get(existing.id))
    }

    @Test
    fun `gold benchmark cannot be created as an instrument`() = runBlocking {
        val instrumentRepository = InMemoryInstrumentRepository()
        val service = instrumentService(instrumentRepository, RecordingValuationProbeService())

        val exception = assertThrows(IllegalArgumentException::class.java) {
            runBlocking {
                service.create(
                    CreateInstrumentCommand(
                        name = "Gold benchmark",
                        kind = InstrumentKind.BENCHMARK_GOLD,
                        assetClass = AssetClass.BENCHMARK,
                        symbol = "GC=F",
                        currency = "USD",
                        valuationSource = ValuationSource.MANUAL
                    )
                )
            }
        }

        assertEquals(
            "Gold benchmarks are configured separately and cannot be created as instruments.",
            exception.message
        )
        assertEquals(emptyList<Instrument>(), instrumentRepository.list())
    }

    @Test
    fun `legacy gold benchmark can be edited without changing valuation source`() = runBlocking {
        val instrumentRepository = InMemoryInstrumentRepository()
        val service = instrumentService(instrumentRepository, RecordingValuationProbeService())
        val existing = instrument(valuationSource = ValuationSource.MANUAL).copy(
            name = "Legacy gold benchmark",
            kind = InstrumentKind.BENCHMARK_GOLD,
            assetClass = AssetClass.BENCHMARK,
            symbol = null,
            currency = "PLN"
        )
        instrumentRepository.save(existing)

        val updated = service.update(
            UpdateInstrumentCommand(
                id = existing.id,
                name = "Legacy gold benchmark renamed",
                symbol = null,
                currency = existing.currency,
                valuationSource = ValuationSource.MANUAL
            )
        )

        assertEquals("Legacy gold benchmark renamed", updated.name)
        assertEquals(ValuationSource.MANUAL, updated.valuationSource)
        assertEquals(updated, instrumentRepository.get(existing.id))
    }

    @Test
    fun `updating stock analyst instrument metadata without symbol change skips probe`() = runBlocking {
        val instrumentRepository = InMemoryInstrumentRepository()
        val probe = RecordingValuationProbeService()
        val service = instrumentService(instrumentRepository, probe)
        val existing = instrument(valuationSource = ValuationSource.STOCK_ANALYST)
        instrumentRepository.save(existing)

        service.update(
            UpdateInstrumentCommand(
                id = existing.id,
                name = "VWRA renamed",
                symbol = existing.symbol,
                currency = existing.currency,
                valuationSource = ValuationSource.STOCK_ANALYST
            )
        )

        assertEquals(emptyList<String>(), probe.requestedSymbols)
    }

    @Test
    fun `updating stock analyst symbol triggers probe`() = runBlocking {
        val instrumentRepository = InMemoryInstrumentRepository()
        val probe = RecordingValuationProbeService()
        val service = instrumentService(instrumentRepository, probe)
        val existing = instrument(valuationSource = ValuationSource.STOCK_ANALYST)
        instrumentRepository.save(existing)

        service.update(
            UpdateInstrumentCommand(
                id = existing.id,
                name = existing.name,
                symbol = "V80A.DE",
                currency = existing.currency,
                valuationSource = ValuationSource.STOCK_ANALYST
            )
        )

        assertEquals(listOf("V80A.DE"), probe.requestedSymbols)
    }

    private fun instrumentService(
        instrumentRepository: InMemoryInstrumentRepository,
        probe: RecordingValuationProbeService
    ) = InstrumentService(
        instrumentRepository = instrumentRepository,
        auditLogService = AuditLogService(InMemoryAuditEventRepository(), clock),
        valuationProbeService = probe,
        clock = clock
    )

    private fun instrument(valuationSource: ValuationSource) = Instrument(
        id = UUID.fromString("10000000-0000-0000-0000-000000000001"),
        name = "VWRA",
        kind = InstrumentKind.ETF,
        assetClass = AssetClass.EQUITIES,
        symbol = "VWRA.L",
        currency = "USD",
        valuationSource = valuationSource,
        edoTerms = null,
        isActive = true,
        createdAt = Instant.parse("2026-03-01T12:00:00Z"),
        updatedAt = Instant.parse("2026-03-01T12:00:00Z")
    )

    private class RecordingValuationProbeService : ValuationProbeService {
        val requestedSymbols = mutableListOf<String>()

        override suspend fun verifyStockAnalystSymbol(symbol: String) {
            requestedSymbols += symbol
        }
    }
}
