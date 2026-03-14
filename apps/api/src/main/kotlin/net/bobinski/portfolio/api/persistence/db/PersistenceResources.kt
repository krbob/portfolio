package net.bobinski.portfolio.api.persistence.db

import com.zaxxer.hikari.HikariDataSource
import net.bobinski.portfolio.api.persistence.config.PersistenceConfig
import javax.sql.DataSource

class PersistenceResources(
    config: PersistenceConfig
) : AutoCloseable {
    val dataSource: DataSource = DataSourceFactory.create(config).also { dataSource ->
        DatabaseMigrator.migrate(config, dataSource)
    }

    override fun close() {
        (dataSource as? HikariDataSource)?.close()
    }
}
