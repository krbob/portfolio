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

        service.update(
            UpdateInstrumentCommand(
                id = existing.id,
                name = existing.name,
                symbol = existing.symbol,
                currency = existing.currency,
                valuationSource = ValuationSource.STOCK_ANALYST
            )
        )

        assertEquals(listOf("VWRA.L"), probe.requestedSymbols)
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
