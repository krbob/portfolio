package net.bobinski.portfolio.api.persistence.db

import com.zaxxer.hikari.HikariConfig
import com.zaxxer.hikari.HikariDataSource
import net.bobinski.portfolio.api.persistence.config.PersistenceConfig
import net.bobinski.portfolio.api.persistence.config.PersistenceMode
import java.nio.file.Files
import java.nio.file.Path
import javax.sql.DataSource
import org.sqlite.SQLiteConfig

object DataSourceFactory {
    fun create(config: PersistenceConfig): DataSource {
        val hikariConfig = when (config.mode) {
            PersistenceMode.POSTGRES -> createPostgresConfig(config)
            PersistenceMode.SQLITE -> createSqliteConfig(config)
            PersistenceMode.MEMORY -> error("Memory persistence does not create a JDBC datasource.")
        }
        return HikariDataSource(hikariConfig)
    }

    private fun createPostgresConfig(config: PersistenceConfig): HikariConfig = HikariConfig().apply {
        jdbcUrl = config.jdbcUrl
        username = config.username
        password = config.password
        driverClassName = "org.postgresql.Driver"
        maximumPoolSize = 8
        minimumIdle = 1
        isAutoCommit = true
        validate()
    }

    private fun createSqliteConfig(config: PersistenceConfig): HikariConfig {
        val databasePath = Path.of(config.sqlite.databasePath).toAbsolutePath().normalize()
        databasePath.parent?.let(Files::createDirectories)

        val sqliteConfig = SQLiteConfig().apply {
            enforceForeignKeys(true)
            setJournalMode(SQLiteConfig.JournalMode.valueOf(config.sqlite.journalMode.name))
            setSynchronous(SQLiteConfig.SynchronousMode.valueOf(config.sqlite.synchronousMode.name))
            setBusyTimeout(config.sqlite.busyTimeoutMs)
        }

        return HikariConfig().apply {
            jdbcUrl = "jdbc:sqlite:$databasePath"
            driverClassName = "org.sqlite.JDBC"
            maximumPoolSize = 1
            minimumIdle = 1
            isAutoCommit = true
            connectionTestQuery = "select 1"
            sqliteConfig.toProperties().forEach { key, value ->
                addDataSourceProperty(key.toString(), value)
            }
            validate()
        }
    }
}
