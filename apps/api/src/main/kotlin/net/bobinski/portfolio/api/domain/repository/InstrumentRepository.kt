package net.bobinski.portfolio.api.domain.repository

import net.bobinski.portfolio.api.domain.model.Instrument
import java.util.UUID

interface InstrumentRepository {
    suspend fun list(): List<Instrument>
    suspend fun get(id: UUID): Instrument?
    suspend fun save(instrument: Instrument): Instrument
    suspend fun deleteAll()
}
