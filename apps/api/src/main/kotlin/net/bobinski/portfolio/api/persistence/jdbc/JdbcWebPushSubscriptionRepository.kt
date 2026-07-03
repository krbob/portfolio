package net.bobinski.portfolio.api.persistence.jdbc

import java.time.Instant
import net.bobinski.portfolio.api.notification.SaveWebPushSubscriptionCommand
import net.bobinski.portfolio.api.notification.WebPushSubscriptionRecord
import net.bobinski.portfolio.api.notification.WebPushSubscriptionRepository

class JdbcWebPushSubscriptionRepository(
    private val connectionManager: JdbcConnectionManager
) : WebPushSubscriptionRepository {
    override suspend fun list(): List<WebPushSubscriptionRecord> =
        connectionManager.withConnection { connection ->
            connection.prepareStatement(
                """
                select endpoint, p256dh, auth, user_agent, created_at, updated_at
                from web_push_subscriptions
                order by updated_at desc, endpoint asc
                """.trimIndent()
            ).use { statement ->
                statement.executeQuery().use { resultSet ->
                    buildList {
                        while (resultSet.next()) {
                            add(resultSet.toRecord())
                        }
                    }
                }
            }
        }

    override suspend fun save(
        command: SaveWebPushSubscriptionCommand,
        now: Instant
    ): WebPushSubscriptionRecord {
        connectionManager.withConnection { connection ->
            connection.prepareStatement(
                """
                insert into web_push_subscriptions (
                    endpoint, p256dh, auth, user_agent, created_at, updated_at
                ) values (?, ?, ?, ?, ?, ?)
                on conflict(endpoint) do update set
                    p256dh = excluded.p256dh,
                    auth = excluded.auth,
                    user_agent = excluded.user_agent,
                    updated_at = excluded.updated_at
                """.trimIndent()
            ).use { statement ->
                statement.setString(1, command.endpoint)
                statement.setString(2, command.p256dh)
                statement.setString(3, command.auth)
                statement.setString(4, command.userAgent)
                statement.setInstant(5, now)
                statement.setInstant(6, now)
                statement.executeUpdate()
            }
        }
        return WebPushSubscriptionRecord(
            endpoint = command.endpoint,
            p256dh = command.p256dh,
            auth = command.auth,
            userAgent = command.userAgent,
            createdAt = now,
            updatedAt = now
        )
    }

    override suspend fun delete(endpoint: String): Boolean =
        connectionManager.withConnection { connection ->
            connection.prepareStatement(
                """
                delete from web_push_subscriptions
                where endpoint = ?
                """.trimIndent()
            ).use { statement ->
                statement.setString(1, endpoint)
                statement.executeUpdate() > 0
            }
        }

    private fun java.sql.ResultSet.toRecord(): WebPushSubscriptionRecord = WebPushSubscriptionRecord(
        endpoint = getString("endpoint"),
        p256dh = getString("p256dh"),
        auth = getString("auth"),
        userAgent = getString("user_agent"),
        createdAt = instant("created_at"),
        updatedAt = instant("updated_at")
    )
}
