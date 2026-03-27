package net.bobinski.portfolio.api.domain.service

import java.math.BigDecimal
import java.math.RoundingMode
import java.time.Clock
import java.time.Instant
import java.util.UUID
import net.bobinski.portfolio.api.domain.model.AuditEventCategory
import net.bobinski.portfolio.api.domain.model.AssetClass
import net.bobinski.portfolio.api.domain.model.PortfolioTarget
import net.bobinski.portfolio.api.domain.repository.PortfolioTargetRepository

class PortfolioTargetService(
    private val portfolioTargetRepository: PortfolioTargetRepository,
    private val auditLogService: AuditLogService,
    private val clock: Clock
) {
    suspend fun list(): List<PortfolioTarget> = portfolioTargetRepository.list()

    suspend fun replace(command: ReplacePortfolioTargetsCommand): List<PortfolioTarget> {
        val normalizedSum = command.items.fold(BigDecimal.ZERO) { total, item ->
            total.add(item.targetWeight)
        }.setScale(6, RoundingMode.HALF_UP)

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
        validateTargets(targets)

        val previousTargets = portfolioTargetRepository.list()
        portfolioTargetRepository.replaceAll(targets)
        val savedTargets = portfolioTargetRepository.list()
        auditLogService.record(
            category = AuditEventCategory.TARGETS,
            action = "PORTFOLIO_TARGETS_REPLACED",
            entityType = "PORTFOLIO_TARGETS",
            message = "Replaced portfolio target allocation.",
            metadata = mapOf(
                "previousMix" to mixSummary(previousTargets),
                "newMix" to mixSummary(savedTargets),
                "targetSum" to normalizedSum.toPlainString(),
                "assetClasses" to savedTargets.joinToString(",") { it.assetClass.name }
            )
        )
        return savedTargets
    }

    companion object {
        private val SUPPORTED_ASSET_CLASSES = setOf(
            AssetClass.EQUITIES,
            AssetClass.BONDS,
            AssetClass.CASH
        )

        fun validateTargets(targets: List<PortfolioTarget>) {
            require(targets.isNotEmpty()) { "At least one target must be provided." }
            require(targets.map(PortfolioTarget::assetClass).distinct().size == targets.size) {
                "Each asset class can only appear once."
            }
            require(targets.all { it.assetClass in SUPPORTED_ASSET_CLASSES }) {
                "Target allocation currently supports only equities, bonds and cash."
            }

            val normalizedSum = targets.fold(BigDecimal.ZERO) { total, item ->
                total.add(item.targetWeight)
            }.setScale(6, RoundingMode.HALF_UP)
            require(normalizedSum.compareTo(BigDecimal.ONE.setScale(6, RoundingMode.HALF_UP)) == 0) {
                "Target weights must add up to 1.00."
            }
        }

        private fun mixSummary(targets: List<PortfolioTarget>): String = targets
            .sortedBy(PortfolioTarget::assetClass)
            .joinToString(",") { target -> "${target.assetClass.name}=${target.targetWeight.toPlainString()}" }
    }
}

data class ReplacePortfolioTargetsCommand(
    val items: List<ReplacePortfolioTargetItem>
)

data class ReplacePortfolioTargetItem(
    val assetClass: AssetClass,
    val targetWeight: BigDecimal
)
