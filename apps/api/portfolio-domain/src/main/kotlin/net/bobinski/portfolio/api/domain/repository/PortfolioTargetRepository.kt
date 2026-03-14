package net.bobinski.portfolio.api.domain.repository

import net.bobinski.portfolio.api.domain.model.PortfolioTarget

interface PortfolioTargetRepository {
    suspend fun list(): List<PortfolioTarget>
    suspend fun replaceAll(targets: List<PortfolioTarget>)
    suspend fun deleteAll()
}
