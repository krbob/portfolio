package net.bobinski.portfolio.api.domain.service

import java.math.BigDecimal
import java.math.RoundingMode
import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.util.UUID
import net.bobinski.portfolio.api.domain.model.AuditEventCategory
import net.bobinski.portfolio.api.domain.model.AssetClass
import net.bobinski.portfolio.api.domain.model.PortfolioTarget
import net.bobinski.portfolio.api.domain.model.PortfolioTargetPhase
import net.bobinski.portfolio.api.domain.repository.PortfolioTargetRepository

class PortfolioTargetService(
    private val portfolioTargetRepository: PortfolioTargetRepository,
    private val auditLogService: AuditLogService,
    private val clock: Clock,
    private val readModelCacheService: ReadModelCacheService? = null
) {
    suspend fun list(): List<PortfolioTarget> = targetAt(LocalDate.now(clock))

    suspend fun targetAt(date: LocalDate): List<PortfolioTarget> = schedule()
        .lastOrNull { phase -> !phase.effectiveFrom.isAfter(date) }
        ?.targets
        .orEmpty()

    suspend fun schedule(): List<PortfolioTargetPhase> = portfolioTargetRepository.listPhases()
        .sortedBy(PortfolioTargetPhase::effectiveFrom)

    suspend fun replace(command: ReplacePortfolioTargetsCommand): List<PortfolioTarget> {
        val normalizedSum = command.items.fold(BigDecimal.ZERO) { total, item ->
            total.add(item.targetWeight)
        }.setScale(6, RoundingMode.HALF_UP)

        val now = Instant.now(clock)
        val today = LocalDate.now(clock)
        val existingPhase = schedule().find { phase -> phase.effectiveFrom == today }
        val targets = command.items.toTargets(now)
        validateTargets(targets)

        val previousTargets = targetAt(today)
        portfolioTargetRepository.savePhase(
            PortfolioTargetPhase(
                id = existingPhase?.id ?: UUID.randomUUID(),
                effectiveFrom = today,
                targets = targets,
                createdAt = existingPhase?.createdAt ?: now,
                updatedAt = now
            )
        )
        readModelCacheService?.clearAll()
        val savedTargets = targetAt(today)
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

    suspend fun replaceSchedule(command: ReplacePortfolioTargetScheduleCommand): List<PortfolioTargetPhase> {
        require(command.phases.map(ReplacePortfolioTargetPhase::effectiveFrom).distinct().size == command.phases.size) {
            "Each target phase must have a unique effective date."
        }
        val explicitIds = command.phases.mapNotNull(ReplacePortfolioTargetPhase::id)
        require(explicitIds.distinct().size == explicitIds.size) { "Each target phase id must be unique." }

        val now = Instant.now(clock)
        val existing = schedule()
        val existingById = existing.associateBy(PortfolioTargetPhase::id)
        val existingByDate = existing.associateBy(PortfolioTargetPhase::effectiveFrom)
        val claimedIds = explicitIds.toMutableSet()
        val phases = command.phases.map { item ->
            val previous = item.id?.let(existingById::get)
                ?: existingByDate[item.effectiveFrom]?.takeUnless { phase -> phase.id in claimedIds }
            val targets = item.items.toTargets(now)
            validateTargets(targets)
            val phaseId = item.id ?: previous?.id ?: UUID.randomUUID()
            claimedIds += phaseId
            PortfolioTargetPhase(
                id = phaseId,
                effectiveFrom = item.effectiveFrom,
                targets = targets,
                createdAt = previous?.createdAt ?: now,
                updatedAt = now
            )
        }.sortedBy(PortfolioTargetPhase::effectiveFrom)
        validateSchedule(phases)

        portfolioTargetRepository.replaceSchedule(phases)
        readModelCacheService?.clearAll()
        val saved = schedule()
        auditLogService.record(
            category = AuditEventCategory.TARGETS,
            action = "PORTFOLIO_TARGET_SCHEDULE_REPLACED",
            entityType = "PORTFOLIO_TARGET_SCHEDULE",
            message = "Replaced portfolio target schedule.",
            metadata = mapOf(
                "previousPhaseCount" to existing.size.toString(),
                "newPhaseCount" to saved.size.toString(),
                "effectiveDates" to saved.joinToString(",") { phase -> phase.effectiveFrom.toString() }
            )
        )
        return saved
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

        fun validateSchedule(phases: List<PortfolioTargetPhase>) {
            require(phases.map(PortfolioTargetPhase::id).distinct().size == phases.size) {
                "Each target phase id must be unique."
            }
            require(phases.map(PortfolioTargetPhase::effectiveFrom).distinct().size == phases.size) {
                "Each target phase must have a unique effective date."
            }
            phases.forEach { phase -> validateTargets(phase.targets) }
        }

        private fun mixSummary(targets: List<PortfolioTarget>): String = targets
            .sortedBy(PortfolioTarget::assetClass)
            .joinToString(",") { target -> "${target.assetClass.name}=${target.targetWeight.toPlainString()}" }
    }

    private fun List<ReplacePortfolioTargetItem>.toTargets(now: Instant): List<PortfolioTarget> = map { item ->
        PortfolioTarget(
            id = UUID.randomUUID(),
            assetClass = item.assetClass,
            targetWeight = item.targetWeight.setScale(6, RoundingMode.HALF_UP),
            createdAt = now,
            updatedAt = now
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

data class ReplacePortfolioTargetScheduleCommand(
    val phases: List<ReplacePortfolioTargetPhase>
)

data class ReplacePortfolioTargetPhase(
    val id: UUID? = null,
    val effectiveFrom: LocalDate,
    val items: List<ReplacePortfolioTargetItem>
)
