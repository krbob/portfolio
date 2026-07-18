package net.bobinski.portfolio.api.domain.service

import java.math.BigDecimal
import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import java.util.UUID
import kotlinx.coroutines.runBlocking
import net.bobinski.portfolio.api.domain.model.AssetClass
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryAuditEventRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryPortfolioTargetRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class PortfolioTargetServiceTest {
    private val clock = Clock.fixed(Instant.parse("2026-07-18T10:00:00Z"), ZoneOffset.UTC)
    private val repository = InMemoryPortfolioTargetRepository()
    private val service = PortfolioTargetService(
        portfolioTargetRepository = repository,
        auditLogService = AuditLogService(InMemoryAuditEventRepository(), clock),
        clock = clock
    )

    @Test
    fun `target at date selects the latest effective phase`() = runBlocking {
        service.replaceSchedule(
            ReplacePortfolioTargetScheduleCommand(
                phases = listOf(
                    phase("2026-01-01", "0.80", "0.20"),
                    phase("2031-01-01", "0.75", "0.25"),
                    phase("2036-01-01", "0.60", "0.40")
                )
            )
        )

        assertTrue(service.targetAt(LocalDate.parse("2025-12-31")).isEmpty())
        assertEquals(BigDecimal("0.800000"), service.targetAt(LocalDate.parse("2030-12-31")).equitiesWeight())
        assertEquals(BigDecimal("0.750000"), service.targetAt(LocalDate.parse("2031-01-01")).equitiesWeight())
        assertEquals(BigDecimal("0.600000"), service.targetAt(LocalDate.parse("2040-01-01")).equitiesWeight())
    }

    @Test
    fun `legacy target replacement adds today's phase without deleting future phases`() = runBlocking {
        service.replaceSchedule(
            ReplacePortfolioTargetScheduleCommand(
                phases = listOf(
                    phase("2020-01-01", "0.80", "0.20"),
                    phase("2031-01-01", "0.70", "0.30")
                )
            )
        )

        service.replace(
            ReplacePortfolioTargetsCommand(
                items = allocation("0.75", "0.25")
            )
        )

        assertEquals(
            listOf("2020-01-01", "2026-07-18", "2031-01-01"),
            service.schedule().map { phase -> phase.effectiveFrom.toString() }
        )
        assertEquals(BigDecimal("0.750000"), service.list().equitiesWeight())
        assertEquals(BigDecimal("0.700000"), service.targetAt(LocalDate.parse("2031-01-01")).equitiesWeight())
    }

    @Test
    fun `empty schedule clears target configuration`() = runBlocking {
        service.replaceSchedule(
            ReplacePortfolioTargetScheduleCommand(phases = listOf(phase("2026-01-01", "0.80", "0.20")))
        )

        val saved = service.replaceSchedule(ReplacePortfolioTargetScheduleCommand(phases = emptyList()))

        assertTrue(saved.isEmpty())
        assertTrue(service.list().isEmpty())
    }

    @Test
    fun `new phase on a vacated date does not reuse the id of a moved phase`() = runBlocking {
        val original = service.replaceSchedule(
            ReplacePortfolioTargetScheduleCommand(phases = listOf(phase("2026-01-01", "0.80", "0.20")))
        ).single()

        val saved = service.replaceSchedule(
            ReplacePortfolioTargetScheduleCommand(
                phases = listOf(
                    ReplacePortfolioTargetPhase(
                        effectiveFrom = LocalDate.parse("2026-01-01"),
                        items = allocation("0.75", "0.25")
                    ),
                    ReplacePortfolioTargetPhase(
                        id = original.id,
                        effectiveFrom = LocalDate.parse("2031-01-01"),
                        items = allocation("0.70", "0.30")
                    )
                )
            )
        )

        assertEquals(2, saved.map { phase -> phase.id }.distinct().size)
        assertEquals(original.id, saved.single { phase -> phase.effectiveFrom.year == 2031 }.id)
    }

    private fun phase(
        effectiveFrom: String,
        equities: String,
        bonds: String
    ) = ReplacePortfolioTargetPhase(
        id = UUID.nameUUIDFromBytes(effectiveFrom.toByteArray()),
        effectiveFrom = LocalDate.parse(effectiveFrom),
        items = allocation(equities, bonds)
    )

    private fun allocation(equities: String, bonds: String) = listOf(
        ReplacePortfolioTargetItem(AssetClass.EQUITIES, BigDecimal(equities)),
        ReplacePortfolioTargetItem(AssetClass.BONDS, BigDecimal(bonds))
    )

    private fun List<net.bobinski.portfolio.api.domain.model.PortfolioTarget>.equitiesWeight(): BigDecimal =
        first { target -> target.assetClass == AssetClass.EQUITIES }.targetWeight
}
