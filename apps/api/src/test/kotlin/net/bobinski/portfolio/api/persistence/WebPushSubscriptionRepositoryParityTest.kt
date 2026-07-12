package net.bobinski.portfolio.api.persistence

import java.time.Instant
import kotlin.io.path.createTempDirectory
import kotlin.io.path.deleteIfExists
import kotlin.io.path.div
import kotlinx.coroutines.runBlocking
import net.bobinski.portfolio.api.notification.PortfolioLocale
import net.bobinski.portfolio.api.notification.SaveWebPushSubscriptionCommand
import net.bobinski.portfolio.api.notification.WebPushSubscriptionRepository
import net.bobinski.portfolio.api.persistence.config.JournalMode
import net.bobinski.portfolio.api.persistence.config.PersistenceConfig
import net.bobinski.portfolio.api.persistence.config.SynchronousMode
import net.bobinski.portfolio.api.persistence.db.PersistenceResources
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryWebPushSubscriptionRepository
import net.bobinski.portfolio.api.persistence.jdbc.JdbcConnectionManager
import net.bobinski.portfolio.api.persistence.jdbc.JdbcWebPushSubscriptionRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

class WebPushSubscriptionRepositoryParityTest {
    @Test
    fun `in-memory and sqlite repositories preserve locale and original creation time`() = runBlocking {
        assertRepository(InMemoryWebPushSubscriptionRepository())
        sqliteRepository { repository -> assertRepository(repository) }
    }

    private suspend fun assertRepository(repository: WebPushSubscriptionRepository) {
        val createdAt = Instant.parse("2026-07-13T10:00:00Z")
        val updatedAt = Instant.parse("2026-07-13T10:05:00Z")
        val endpoint = "https://push.example.test/subscription"

        repository.save(
            command = command(endpoint = endpoint, locale = PortfolioLocale.PL, auth = "auth-1"),
            now = createdAt
        )
        val updated = repository.save(
            command = command(endpoint = endpoint, locale = PortfolioLocale.EN, auth = "auth-2"),
            now = updatedAt
        )

        assertEquals(PortfolioLocale.EN, updated.locale)
        assertEquals("auth-2", updated.auth)
        assertEquals(createdAt, updated.createdAt)
        assertEquals(updatedAt, updated.updatedAt)
        assertEquals(listOf(updated), repository.list())
    }

    private fun command(endpoint: String, locale: PortfolioLocale, auth: String) =
        SaveWebPushSubscriptionCommand(
            endpoint = endpoint,
            p256dh = "public-key",
            auth = auth,
            userAgent = "test-agent",
            locale = locale
        )

    private suspend fun sqliteRepository(block: suspend (WebPushSubscriptionRepository) -> Unit) {
        val directory = createTempDirectory("portfolio-web-push-repository-test")
        val databasePath = directory.resolve("portfolio.db")

        try {
            PersistenceResources(persistenceConfig(databasePath.toString())).use { resources ->
                block(JdbcWebPushSubscriptionRepository(JdbcConnectionManager(resources.dataSource)))
            }
        } finally {
            (directory / "portfolio.db").deleteIfExists()
            (directory / "portfolio.db-shm").deleteIfExists()
            (directory / "portfolio.db-wal").deleteIfExists()
            directory.deleteIfExists()
        }
    }

    private fun persistenceConfig(databasePath: String) = PersistenceConfig(
        databasePath = databasePath,
        journalMode = JournalMode.WAL,
        synchronousMode = SynchronousMode.FULL,
        busyTimeoutMs = 5_000
    )
}
