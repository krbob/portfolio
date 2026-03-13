package net.bobinski.portfolio.api.domain.service

import net.bobinski.portfolio.api.domain.model.AssetClass
import net.bobinski.portfolio.api.domain.model.EdoTerms
import net.bobinski.portfolio.api.domain.model.Instrument
import net.bobinski.portfolio.api.domain.model.InstrumentKind
import net.bobinski.portfolio.api.domain.model.ValuationSource
import net.bobinski.portfolio.api.domain.repository.InstrumentRepository
import java.time.Clock
import java.time.Instant
import java.util.UUID

class InstrumentService(
    private val instrumentRepository: InstrumentRepository,
    private val clock: Clock
) {
    suspend fun list(): List<Instrument> = instrumentRepository.list()

    suspend fun create(command: CreateInstrumentCommand): Instrument {
        val now = Instant.now(clock)
        return instrumentRepository.save(
            Instrument(
                id = UUID.randomUUID(),
                name = command.name.trim(),
                kind = command.kind,
                assetClass = command.assetClass,
                symbol = command.symbol?.trim()?.takeIf { it.isNotEmpty() },
                currency = command.currency.uppercase(),
                valuationSource = command.valuationSource,
                edoTerms = command.edoTerms,
                isActive = true,
                createdAt = now,
                updatedAt = now
            )
        )
    }
}

data class CreateInstrumentCommand(
    val name: String,
    val kind: InstrumentKind,
    val assetClass: AssetClass,
    val symbol: String?,
    val currency: String,
    val valuationSource: ValuationSource,
    val edoTerms: EdoTerms? = null
)
