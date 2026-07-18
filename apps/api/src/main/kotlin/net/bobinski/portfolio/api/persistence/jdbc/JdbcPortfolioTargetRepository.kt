package net.bobinski.portfolio.api.persistence.jdbc

import java.sql.Connection
import java.util.UUID
import javax.sql.DataSource
import net.bobinski.portfolio.api.domain.model.AssetClass
import net.bobinski.portfolio.api.domain.model.PortfolioTarget
import net.bobinski.portfolio.api.domain.model.PortfolioTargetPhase
import net.bobinski.portfolio.api.domain.repository.PortfolioTargetRepository

class JdbcPortfolioTargetRepository(
    private val connectionManager: JdbcConnectionManager
) : PortfolioTargetRepository {
    constructor(dataSource: DataSource) : this(JdbcConnectionManager(dataSource))

    override suspend fun listPhases(): List<PortfolioTargetPhase> =
        connectionManager.withConnection { connection ->
            connection.prepareStatement(
                """
                select
                    phase.id as phase_id,
                    phase.effective_from,
                    phase.created_at as phase_created_at,
                    phase.updated_at as phase_updated_at,
                    target.id as target_id,
                    target.asset_class,
                    target.target_weight,
                    target.created_at as target_created_at,
                    target.updated_at as target_updated_at
                from portfolio_target_phases phase
                left join portfolio_targets target on target.phase_id = phase.id
                order by phase.effective_from asc, target.asset_class asc
                """.trimIndent()
            ).use { statement ->
                statement.executeQuery().use { resultSet ->
                    val phases = linkedMapOf<UUID, PortfolioTargetPhase>()
                    while (resultSet.next()) {
                        val phaseId = resultSet.uuid("phase_id")
                        val existing = phases[phaseId]
                        val targets = existing?.targets?.toMutableList() ?: mutableListOf()
                        resultSet.getString("target_id")?.let { targetId ->
                            targets += PortfolioTarget(
                                id = UUID.fromString(targetId),
                                assetClass = AssetClass.valueOf(resultSet.getString("asset_class")),
                                targetWeight = resultSet.bigDecimal("target_weight"),
                                createdAt = resultSet.instant("target_created_at"),
                                updatedAt = resultSet.instant("target_updated_at")
                            )
                        }
                        phases[phaseId] = PortfolioTargetPhase(
                            id = phaseId,
                            effectiveFrom = resultSet.localDate("effective_from"),
                            targets = targets,
                            createdAt = resultSet.instant("phase_created_at"),
                            updatedAt = resultSet.instant("phase_updated_at")
                        )
                    }
                    phases.values.toList()
                }
            }
        }

    override suspend fun replaceSchedule(phases: List<PortfolioTargetPhase>) {
        connectionManager.inTransaction {
            connectionManager.withConnection { connection ->
                connection.prepareStatement("delete from portfolio_targets").use { it.executeUpdate() }
                connection.prepareStatement("delete from portfolio_target_phases").use { it.executeUpdate() }
                phases.forEach { phase -> insertPhase(connection, phase) }
            }
        }
    }

    override suspend fun savePhase(phase: PortfolioTargetPhase): PortfolioTargetPhase {
        connectionManager.inTransaction {
            connectionManager.withConnection { connection ->
                connection.prepareStatement(
                    "delete from portfolio_target_phases where effective_from = ? and id <> ?"
                ).use { statement ->
                    statement.setLocalDate(1, phase.effectiveFrom)
                    statement.setUuid(2, phase.id)
                    statement.executeUpdate()
                }
                connection.prepareStatement("delete from portfolio_targets where phase_id = ?").use { statement ->
                    statement.setUuid(1, phase.id)
                    statement.executeUpdate()
                }
                connection.prepareStatement("delete from portfolio_target_phases where id = ?").use { statement ->
                    statement.setUuid(1, phase.id)
                    statement.executeUpdate()
                }
                insertPhase(connection, phase)
            }
        }
        return phase
    }

    override suspend fun deleteAll() {
        connectionManager.inTransaction {
            connectionManager.withConnection { connection ->
                connection.prepareStatement("delete from portfolio_targets").use { it.executeUpdate() }
                connection.prepareStatement("delete from portfolio_target_phases").use { it.executeUpdate() }
            }
        }
    }

    private fun insertPhase(connection: Connection, phase: PortfolioTargetPhase) {
        connection.prepareStatement(
            """
            insert into portfolio_target_phases (id, effective_from, created_at, updated_at)
            values (?, ?, ?, ?)
            """.trimIndent()
        ).use { statement ->
            statement.setUuid(1, phase.id)
            statement.setLocalDate(2, phase.effectiveFrom)
            statement.setInstant(3, phase.createdAt)
            statement.setInstant(4, phase.updatedAt)
            statement.executeUpdate()
        }
        connection.prepareStatement(
            """
            insert into portfolio_targets (
                id, phase_id, asset_class, target_weight, created_at, updated_at
            ) values (?, ?, ?, ?, ?, ?)
            """.trimIndent()
        ).use { statement ->
            phase.targets.forEach { target ->
                statement.setUuid(1, target.id)
                statement.setUuid(2, phase.id)
                statement.setString(3, target.assetClass.name)
                statement.setBigDecimal(4, target.targetWeight)
                statement.setInstant(5, target.createdAt)
                statement.setInstant(6, target.updatedAt)
                statement.addBatch()
            }
            statement.executeBatch()
        }
    }
}
