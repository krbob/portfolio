package net.bobinski.portfolio.api.persistence.inmemory

import java.util.concurrent.atomic.AtomicReference
import net.bobinski.portfolio.api.domain.model.PortfolioTarget
import net.bobinski.portfolio.api.domain.repository.PortfolioTargetRepository

class InMemoryPortfolioTargetRepository : PortfolioTargetRepository {
    private val state = AtomicReference<List<PortfolioTarget>>(emptyList())

    override suspend fun list(): List<PortfolioTarget> = state.get()
        .sortedBy { it.assetClass.name }

    override suspend fun replaceAll(targets: List<PortfolioTarget>) {
        state.set(targets)
    }

    override suspend fun deleteAll() {
        state.set(emptyList())
    }
}
