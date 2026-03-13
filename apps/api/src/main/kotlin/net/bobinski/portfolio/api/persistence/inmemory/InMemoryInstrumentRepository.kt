package net.bobinski.portfolio.api.persistence.inmemory

import net.bobinski.portfolio.api.domain.model.Instrument
import net.bobinski.portfolio.api.domain.repository.InstrumentRepository
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

class InMemoryInstrumentRepository : InstrumentRepository {
    private val instruments = ConcurrentHashMap<UUID, Instrument>()

    override suspend fun list(): List<Instrument> = instruments.values.sortedByDescending { it.createdAt }

    override suspend fun get(id: UUID): Instrument? = instruments[id]

    override suspend fun save(instrument: Instrument): Instrument {
        instruments[instrument.id] = instrument
        return instrument
    }

    override suspend fun deleteAll() {
        instruments.clear()
    }
}
