package net.bobinski.portfolio.api.domain.repository

import net.bobinski.portfolio.api.domain.model.PortfolioTargetPhase

interface PortfolioTargetRepository {
    suspend fun listPhases(): List<PortfolioTargetPhase>
    suspend fun replaceSchedule(phases: List<PortfolioTargetPhase>)
    suspend fun savePhase(phase: PortfolioTargetPhase): PortfolioTargetPhase
    suspend fun deleteAll()
}
