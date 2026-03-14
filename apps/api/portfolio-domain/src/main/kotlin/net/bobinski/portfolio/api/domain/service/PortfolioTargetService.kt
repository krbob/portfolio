package net.bobinski.portfolio.api.domain.service

import java.math.BigDecimal
import java.math.RoundingMode
import java.time.Clock
import java.time.Instant
import java.util.UUID
import net.bobinski.portfolio.api.domain.model.AssetClass
import net.bobinski.portfolio.api.domain.model.PortfolioTarget
import net.bobinski.portfolio.api.domain.repository.PortfolioTargetRepository

class PortfolioTargetService(
    private val portfolioTargetRepository: PortfolioTargetRepository,
    private val clock: Clock
) {
    suspend fun list(): List<PortfolioTarget> = portfolioTargetRepository.list()

    suspend fun replace(command: ReplacePortfolioTargetsCommand): List<PortfolioTarget> {
        require(command.items.isNotEmpty()) { "At least one target must be provided." }
        require(command.items.map { it.assetClass }.distinct().size == command.items.size) {
            "Each asset class can only appear once."
        }
        require(command.items.all { it.assetClass in SUPPORTED_ASSET_CLASSES }) {
            "Target allocation currently supports only equities, bonds and cash."
        }

        val normalizedSum = command.items.fold(BigDecimal.ZERO) { total, item ->
            total.add(item.targetWeight)
        }.setScale(6, RoundingMode.HALF_UP)
        require(normalizedSum.compareTo(BigDecimal.ONE.setScale(6, RoundingMode.HALF_UP)) == 0) {
            "Target weights must add up to 1.00."
        }

        val now = Instant.now(clock)
        val targets = command.items.map { item ->
            PortfolioTarget(
                id = UUID.randomUUID(),
                assetClass = item.assetClass,
                targetWeight = item.targetWeight.setScale(6, RoundingMode.HALF_UP),
                createdAt = now,
                updatedAt = now
            )
        }

        portfolioTargetRepository.replaceAll(targets)
        return portfolioTargetRepository.list()
    }

    companion object {
        private val SUPPORTED_ASSET_CLASSES = setOf(
            AssetClass.EQUITIES,
            AssetClass.BONDS,
            AssetClass.CASH
        )
    }
}

data class ReplacePortfolioTargetsCommand(
    val items: List<ReplacePortfolioTargetItem>
)

data class ReplacePortfolioTargetItem(
    val assetClass: AssetClass,
    val targetWeight: BigDecimal
)
