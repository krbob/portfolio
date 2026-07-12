package net.bobinski.portfolio.api.persistence.db

import kotlin.io.path.createTempDirectory
import kotlin.io.path.deleteIfExists
import kotlin.io.path.div
import net.bobinski.portfolio.api.persistence.config.JournalMode
import net.bobinski.portfolio.api.persistence.config.PersistenceConfig
import net.bobinski.portfolio.api.persistence.config.SynchronousMode
import org.flywaydb.core.Flyway
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class SqliteMigrationTest {

    @Test
    fun `sqlite migrations create the expected schema`() {
        val directory = createTempDirectory("portfolio-sqlite-migration-test")
        val databasePath = directory.resolve("portfolio.db")

        try {
            PersistenceResources(sqlitePersistenceConfig(databasePath.toString())).use { resources ->
                resources.dataSource.connection.use { connection ->
                    assertEquals(12, appliedMigrationCount(connection))
                    assertTrue(tableExists(connection, "accounts"))
                    assertTrue(tableExists(connection, "instruments"))
                    assertTrue(tableExists(connection, "edo_terms"))
                    assertTrue(tableExists(connection, "transactions"))
                    assertTrue(tableExists(connection, "portfolio_targets"))
                    assertTrue(tableExists(connection, "audit_events"))
                    assertTrue(tableExists(connection, "read_model_snapshots"))
                    assertTrue(tableExists(connection, "transaction_import_profiles"))
                    assertTrue(tableExists(connection, "app_preferences"))
                    assertTrue(tableExists(connection, "web_push_subscriptions"))
                    assertTrue(tableExists(connection, "operational_state"))
                }
            }
        } finally {
            (directory / "portfolio.db").deleteIfExists()
            (directory / "portfolio.db-shm").deleteIfExists()
            (directory / "portfolio.db-wal").deleteIfExists()
            directory.deleteIfExists()
        }
    }

    @Test
    fun `operational state migration moves legacy runtime keys out of user preferences`() {
        val directory = createTempDirectory("portfolio-operational-state-migration-test")
        val databasePath = directory.resolve("portfolio.db")
        val dataSource = DataSourceFactory.create(sqlitePersistenceConfig(databasePath.toString()))

        try {
            migrateToVersion10(dataSource)
            seedLegacyPreferences(dataSource)
            DatabaseMigrator.migrate(dataSource)
            assertOperationalStateMigration(dataSource)
        } finally {
            (dataSource as? AutoCloseable)?.close()
            (directory / "portfolio.db").deleteIfExists()
            (directory / "portfolio.db-shm").deleteIfExists()
            (directory / "portfolio.db-wal").deleteIfExists()
            directory.deleteIfExists()
        }
    }

    @Test
    fun `web push locale migration preserves existing subscriptions with Polish fallback`() {
        val directory = createTempDirectory("portfolio-web-push-locale-migration-test")
        val databasePath = directory.resolve("portfolio.db")
        val dataSource = DataSourceFactory.create(sqlitePersistenceConfig(databasePath.toString()))

        try {
            migrateToVersion11(dataSource)
            dataSource.connection.use { connection ->
                connection.prepareStatement(
                    """
                    insert into web_push_subscriptions (
                        endpoint, p256dh, auth, user_agent, created_at, updated_at
                    ) values (?, ?, ?, ?, ?, ?)
                    """.trimIndent()
                ).use { statement ->
                    statement.setString(1, "https://push.example.test/legacy")
                    statement.setString(2, "p256dh")
                    statement.setString(3, "auth")
                    statement.setString(4, "legacy-agent")
                    statement.setString(5, "2026-07-12T10:00:00Z")
                    statement.setString(6, "2026-07-12T10:00:00Z")
                    statement.executeUpdate()
                }
            }

            DatabaseMigrator.migrate(dataSource)

            dataSource.connection.use { connection ->
                assertEquals(12, appliedMigrationCount(connection))
                connection.prepareStatement(
                    "select locale from web_push_subscriptions where endpoint = ?"
                ).use { statement ->
                    statement.setString(1, "https://push.example.test/legacy")
                    statement.executeQuery().use { resultSet ->
                        assertTrue(resultSet.next())
                        assertEquals("pl", resultSet.getString("locale"))
                    }
                }
            }
        } finally {
            (dataSource as? AutoCloseable)?.close()
            (directory / "portfolio.db").deleteIfExists()
            (directory / "portfolio.db-shm").deleteIfExists()
            (directory / "portfolio.db-wal").deleteIfExists()
            directory.deleteIfExists()
        }
    }

    private fun migrateToVersion10(dataSource: javax.sql.DataSource) {
        Flyway.configure()
            .dataSource(dataSource)
            .locations("classpath:db/migration")
            .target("10")
            .load()
            .migrate()
    }

    private fun migrateToVersion11(dataSource: javax.sql.DataSource) {
        Flyway.configure()
            .dataSource(dataSource)
            .locations("classpath:db/migration")
            .target("11")
            .load()
            .migrate()
    }

    private fun seedLegacyPreferences(dataSource: javax.sql.DataSource) {
        dataSource.connection.use { connection ->
            connection.prepareStatement(
                """
                insert into app_preferences (preference_key, value_json, updated_at)
                values (?, ?, ?)
                """.trimIndent()
            ).use { statement ->
                listOf(
                    "portfolio.benchmark-settings" to "{\"enabled\":true}",
                    "portfolio.alerts.active" to "{\"activeAlertIds\":[]}",
                    "portfolio.market-data.quote.hash" to "{\"price\":\"101.00\"}",
                    "market-data.snapshot.quote.hash" to "{\"price\":\"100.00\"}",
                    "market-data.snapshot-meta.quote.hash" to "{\"status\":\"FRESH\"}"
                ).forEach { (key, valueJson) ->
                    statement.setString(1, key)
                    statement.setString(2, valueJson)
                    statement.setString(3, "2026-03-27T12:00:00Z")
                    statement.addBatch()
                }
                statement.executeBatch()
            }
        }
    }

    private fun assertOperationalStateMigration(dataSource: javax.sql.DataSource) {
        dataSource.connection.use { connection ->
            assertEquals(12, appliedMigrationCount(connection))
            assertEquals(
                listOf("portfolio.benchmark-settings"),
                storedKeys(connection, table = "app_preferences", keyColumn = "preference_key")
            )
            assertEquals(
                listOf(
                    "market-data.snapshot-meta.quote.hash",
                    "market-data.snapshot.quote.hash",
                    "portfolio.alerts.active",
                    "portfolio.market-data.quote.hash"
                ),
                storedKeys(connection, table = "operational_state", keyColumn = "state_key")
            )
        }
    }

    private fun appliedMigrationCount(connection: java.sql.Connection): Int =
        connection.prepareStatement("select count(*) from flyway_schema_history where success = 1").use { statement ->
            statement.executeQuery().use { resultSet ->
                resultSet.next()
                resultSet.getInt(1)
            }
        }

    private fun tableExists(connection: java.sql.Connection, tableName: String): Boolean =
        connection.prepareStatement(
            "select count(*) from sqlite_master where type = 'table' and name = ?"
        ).use { statement ->
            statement.setString(1, tableName)
            statement.executeQuery().use { resultSet ->
                resultSet.next()
                resultSet.getInt(1) == 1
            }
        }

    private fun storedKeys(
        connection: java.sql.Connection,
        table: String,
        keyColumn: String
    ): List<String> = connection.prepareStatement(
        "select $keyColumn from $table order by $keyColumn"
    ).use { statement ->
        statement.executeQuery().use { resultSet ->
            buildList {
                while (resultSet.next()) {
                    add(resultSet.getString(1))
                }
            }
        }
    }

    private fun sqlitePersistenceConfig(databasePath: String) = PersistenceConfig(
        databasePath = databasePath,
        journalMode = JournalMode.WAL,
        synchronousMode = SynchronousMode.FULL,
        busyTimeoutMs = 5_000
    )
}
