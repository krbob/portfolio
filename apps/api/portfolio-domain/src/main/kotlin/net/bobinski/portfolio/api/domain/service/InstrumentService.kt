package net.bobinski.portfolio.api.domain.service

import net.bobinski.portfolio.api.domain.error.ResourceNotFoundException
import net.bobinski.portfolio.api.domain.model.AssetClass
import net.bobinski.portfolio.api.domain.model.AuditEventCategory
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
    private val auditLogService: AuditLogService,
    private val valuationProbeService: ValuationProbeService,
    private val clock: Clock
) {
    suspend fun list(): List<Instrument> = instrumentRepository.list()

    suspend fun create(command: CreateInstrumentCommand): Instrument {
        val symbol = command.symbol?.trim()?.takeIf { it.isNotEmpty() }
        validateValuationConfiguration(
            kind = command.kind,
            requested = command.valuationSource,
            symbol = symbol,
            existing = null
        )
        if (command.valuationSource == ValuationSource.STOCK_ANALYST && symbol != null) {
            valuationProbeService.verifyStockAnalystSymbol(symbol)
        }

        val now = Instant.now(clock)
        val instrument = instrumentRepository.save(
            Instrument(
                id = UUID.randomUUID(),
                name = command.name.trim(),
                kind = command.kind,
                assetClass = command.assetClass,
                symbol = symbol,
                currency = command.currency.uppercase(),
                valuationSource = command.valuationSource,
                edoTerms = command.edoTerms,
                isActive = true,
                createdAt = now,
                updatedAt = now
            )
        )
        auditLogService.record(
            category = AuditEventCategory.INSTRUMENTS,
            action = "INSTRUMENT_CREATED",
            entityType = "INSTRUMENT",
            entityId = instrument.id.toString(),
            message = "Created instrument ${instrument.name}.",
            metadata = buildMap {
                put("kind", instrument.kind.name)
                put("assetClass", instrument.assetClass.name)
                put("currency", instrument.currency)
                instrument.symbol?.let { put("symbol", it) }
            }
        )
        return instrument
    }

    suspend fun update(command: UpdateInstrumentCommand): Instrument {
        val existing = instrumentRepository.get(command.id)
            ?: throw ResourceNotFoundException("Instrument not found: ${command.id}")

        val symbol = command.symbol?.trim()?.takeIf { it.isNotEmpty() }
        validateValuationConfiguration(
            kind = existing.kind,
            requested = command.valuationSource,
            symbol = symbol,
            existing = existing
        )
        if (shouldVerifySymbol(command.valuationSource, symbol, existing)) {
            valuationProbeService.verifyStockAnalystSymbol(symbol!!)
        }

        val now = Instant.now(clock)
        val updated = instrumentRepository.save(
            existing.copy(
                name = command.name.trim(),
                symbol = symbol,
                currency = command.currency.uppercase(),
                valuationSource = command.valuationSource,
                edoTerms = command.edoTerms,
                updatedAt = now
            )
        )
        auditLogService.record(
            category = AuditEventCategory.INSTRUMENTS,
            action = "INSTRUMENT_UPDATED",
            entityType = "INSTRUMENT",
            entityId = updated.id.toString(),
            message = "Updated instrument ${updated.name}.",
            metadata = buildMap {
                put("currency", updated.currency)
                updated.symbol?.let { put("symbol", it) }
            }
        )
        return updated
    }

    private fun validateValuationConfiguration(
        kind: InstrumentKind,
        requested: ValuationSource,
        symbol: String?,
        existing: Instrument?
    ) {
        if (kind == InstrumentKind.BENCHMARK_GOLD) {
            require(existing != null && requested == existing.valuationSource) {
                "Gold benchmarks are configured separately and cannot be created as instruments."
            }
            return
        }

        val supported = when (kind) {
            InstrumentKind.BOND_EDO -> ValuationSource.EDO_CALCULATOR
            else -> ValuationSource.STOCK_ANALYST
        }
        if (requested == existing?.valuationSource && requested != supported) return
        require(requested == supported) {
            "${kind.name} instruments must use ${supported.name} valuation; " +
                "${requested.name} is not supported."
        }
        if (supported == ValuationSource.STOCK_ANALYST) {
            val retainsLegacyMissingSymbol = existing?.valuationSource == ValuationSource.STOCK_ANALYST &&
                existing.symbol == null && symbol == null
            require(symbol != null || retainsLegacyMissingSymbol) {
                "${kind.name} instruments using STOCK_ANALYST valuation require a market symbol."
            }
        }
    }

    private fun shouldVerifySymbol(
        valuationSource: ValuationSource,
        symbol: String?,
        existing: Instrument
    ): Boolean {
        if (valuationSource != ValuationSource.STOCK_ANALYST || symbol == null) return false
        return symbol != existing.symbol || existing.valuationSource != ValuationSource.STOCK_ANALYST
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

data class UpdateInstrumentCommand(
    val id: UUID,
    val name: String,
    val symbol: String?,
    val currency: String,
    val valuationSource: ValuationSource,
    val edoTerms: EdoTerms? = null
)
