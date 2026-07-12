package net.bobinski.portfolio.api.persistence.inmemory

import java.time.Instant
import java.util.concurrent.atomic.AtomicReference
import net.bobinski.portfolio.api.notification.SaveWebPushSubscriptionCommand
import net.bobinski.portfolio.api.notification.WebPushSubscriptionRecord
import net.bobinski.portfolio.api.notification.WebPushSubscriptionRepository

class InMemoryWebPushSubscriptionRepository : WebPushSubscriptionRepository {
    private val state = AtomicReference<Map<String, WebPushSubscriptionRecord>>(emptyMap())

    override suspend fun list(): List<WebPushSubscriptionRecord> = state.get()
        .values
        .sortedWith(compareByDescending<WebPushSubscriptionRecord> { it.updatedAt }.thenBy { it.endpoint })

    override suspend fun save(
        command: SaveWebPushSubscriptionCommand,
        now: Instant
    ): WebPushSubscriptionRecord {
        var saved: WebPushSubscriptionRecord? = null
        state.updateAndGet { current ->
            val existing = current[command.endpoint]
            val record = WebPushSubscriptionRecord(
                endpoint = command.endpoint,
                p256dh = command.p256dh,
                auth = command.auth,
                userAgent = command.userAgent,
                locale = command.locale,
                createdAt = existing?.createdAt ?: now,
                updatedAt = now
            )
            saved = record
            current + (record.endpoint to record)
        }
        return requireNotNull(saved)
    }

    override suspend fun delete(endpoint: String): Boolean {
        var deleted = false
        state.updateAndGet { current ->
            deleted = current.containsKey(endpoint)
            current - endpoint
        }
        return deleted
    }
}
