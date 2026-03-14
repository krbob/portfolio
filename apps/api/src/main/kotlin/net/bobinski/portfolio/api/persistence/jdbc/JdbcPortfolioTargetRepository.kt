package net.bobinski.portfolio.api.persistence.jdbc

import javax.sql.DataSource
import net.bobinski.portfolio.api.domain.model.AssetClass
import net.bobinski.portfolio.api.domain.model.PortfolioTarget
import net.bobinski.portfolio.api.domain.repository.PortfolioTargetRepository
import java.util.UUID

class JdbcPortfolioTargetRepository(
    private val dataSource: DataSource
) : PortfolioTargetRepository {

    override suspend fun list(): List<PortfolioTarget> =
        dataSource.connection.use { connection ->
            connection.prepareStatement(
                """
                select id, asset_class, target_weight, created_at, updated_at
                from portfolio_targets
                order by asset_class asc
                """.trimIndent()
            ).use { statement ->
                statement.executeQuery().use { resultSet ->
                    buildList {
                        while (resultSet.next()) {
                            add(
                                PortfolioTarget(
                                    id = resultSet.uuid("id"),
                                    assetClass = AssetClass.valueOf(resultSet.getString("asset_class")),
                                    targetWeight = resultSet.bigDecimal("target_weight"),
                                    createdAt = resultSet.instant("created_at"),
                                    updatedAt = resultSet.instant("updated_at")
                                )
                            )
                        }
                    }
                }
            }
        }

    override suspend fun replaceAll(targets: List<PortfolioTarget>) {
        dataSource.connection.use { connection ->
            val previousAutoCommit = connection.autoCommit
            connection.autoCommit = false
            try {
                connection.prepareStatement("delete from portfolio_targets").use { statement ->
                    statement.executeUpdate()
                }
                connection.prepareStatement(
                    """
                    insert into portfolio_targets (
                        id, asset_class, target_weight, created_at, updated_at
                    ) values (?, ?, ?, ?, ?)
                    """.trimIndent()
                ).use { statement ->
                    targets.forEach { target ->
                        statement.setUuid(1, target.id)
                        statement.setString(2, target.assetClass.name)
                        statement.setBigDecimal(3, target.targetWeight)
                        statement.setInstant(4, target.createdAt)
                        statement.setInstant(5, target.updatedAt)
                        statement.addBatch()
                    }
                    statement.executeBatch()
                }
                connection.commit()
            } catch (error: Exception) {
                connection.rollback()
                throw error
            } finally {
                connection.autoCommit = previousAutoCommit
            }
        }
    }

    override suspend fun deleteAll() {
        dataSource.connection.use { connection ->
            connection.prepareStatement("delete from portfolio_targets").use { statement ->
                statement.executeUpdate()
            }
        }
    }
}
