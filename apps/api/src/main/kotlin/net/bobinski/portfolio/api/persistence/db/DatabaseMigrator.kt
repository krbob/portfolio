package net.bobinski.portfolio.api.persistence.db

import org.flywaydb.core.Flyway
import javax.sql.DataSource

object DatabaseMigrator {
    fun migrate(dataSource: DataSource) {
        Flyway.configure()
            .dataSource(dataSource)
            .locations("classpath:db/migration-sqlite")
            .load()
            .migrate()
    }
}
