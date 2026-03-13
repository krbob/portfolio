package net.bobinski.portfolio.api.persistence.db

import com.zaxxer.hikari.HikariConfig
import com.zaxxer.hikari.HikariDataSource
import net.bobinski.portfolio.api.persistence.config.PersistenceConfig
import javax.sql.DataSource

object DataSourceFactory {
    fun create(config: PersistenceConfig): DataSource {
        val hikariConfig = HikariConfig().apply {
            jdbcUrl = config.jdbcUrl
            username = config.username
            password = config.password
            driverClassName = "org.postgresql.Driver"
            maximumPoolSize = 8
            minimumIdle = 1
            isAutoCommit = true
            validate()
        }

        return HikariDataSource(hikariConfig)
    }
}
