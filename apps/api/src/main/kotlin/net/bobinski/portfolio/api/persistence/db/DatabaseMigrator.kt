package net.bobinski.portfolio.api.persistence.db

import net.bobinski.portfolio.api.persistence.config.PersistenceConfig
import net.bobinski.portfolio.api.persistence.config.PersistenceMode
import org.flywaydb.core.Flyway
import javax.sql.DataSource

object DatabaseMigrator {
    fun migrate(config: PersistenceConfig, dataSource: DataSource) {
        Flyway.configure()
            .dataSource(dataSource)
            .locations(migrationLocation(config.mode))
            .load()
            .migrate()
    }

    private fun migrationLocation(mode: PersistenceMode): String = when (mode) {
        PersistenceMode.POSTGRES -> "classpath:db/migration"
        PersistenceMode.SQLITE -> "classpath:db/migration-sqlite"
        PersistenceMode.MEMORY -> error("Memory persistence does not run database migrations.")
    }
}
