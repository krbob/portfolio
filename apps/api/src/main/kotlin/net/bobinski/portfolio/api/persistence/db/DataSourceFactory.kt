package net.bobinski.portfolio.api.persistence.db

import com.zaxxer.hikari.HikariConfig
import com.zaxxer.hikari.HikariDataSource
import net.bobinski.portfolio.api.persistence.config.PersistenceConfig
import java.nio.file.Files
import java.nio.file.Path
import javax.sql.DataSource
import org.sqlite.SQLiteConfig

object DataSourceFactory {
    fun create(config: PersistenceConfig): DataSource {
        return HikariDataSource(createDataSourceConfig(config))
    }

    private fun createDataSourceConfig(config: PersistenceConfig): HikariConfig {
        val databasePath = Path.of(config.databasePath).toAbsolutePath().normalize()
        databasePath.parent?.let(Files::createDirectories)

        val sqliteConfig = SQLiteConfig().apply {
            enforceForeignKeys(true)
            setJournalMode(SQLiteConfig.JournalMode.valueOf(config.journalMode.name))
            setSynchronous(SQLiteConfig.SynchronousMode.valueOf(config.synchronousMode.name))
            setBusyTimeout(config.busyTimeoutMs)
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
