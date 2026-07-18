package net.bobinski.portfolio.api.persistence.inmemory

import java.util.concurrent.atomic.AtomicReference
import net.bobinski.portfolio.api.domain.model.PortfolioTargetPhase
import net.bobinski.portfolio.api.domain.repository.PortfolioTargetRepository

class InMemoryPortfolioTargetRepository : PortfolioTargetRepository {
    private val state = AtomicReference<List<PortfolioTargetPhase>>(emptyList())

    override suspend fun listPhases(): List<PortfolioTargetPhase> = state.get()
        .sortedWith(compareBy(PortfolioTargetPhase::effectiveFrom, PortfolioTargetPhase::id))
        .map { phase -> phase.copy(targets = phase.targets.sortedBy { it.assetClass.name }) }

    override suspend fun replaceSchedule(phases: List<PortfolioTargetPhase>) {
        state.set(phases)
    }

    override suspend fun savePhase(phase: PortfolioTargetPhase): PortfolioTargetPhase {
        state.updateAndGet { phases ->
            phases.filterNot { existing -> existing.id == phase.id || existing.effectiveFrom == phase.effectiveFrom } + phase
        }
        return phase
    }

    override suspend fun deleteAll() {
        state.set(emptyList())
    }
}
