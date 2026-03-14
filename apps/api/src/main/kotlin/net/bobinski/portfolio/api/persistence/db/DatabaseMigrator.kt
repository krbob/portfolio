package net.bobinski.portfolio.api.persistence.db

import net.bobinski.portfolio.api.persistence.config.PersistenceConfig
import org.flywaydb.core.Flyway
import javax.sql.DataSource

object DatabaseMigrator {
    fun migrate(config: PersistenceConfig, dataSource: DataSource) {
        require(config.isSqliteEnabled) {
            "Database migrations are only available for SQLite persistence."
        }
        Flyway.configure()
            .dataSource(dataSource)
            .locations("classpath:db/migration-sqlite")
            .load()
            .migrate()
    }
}
