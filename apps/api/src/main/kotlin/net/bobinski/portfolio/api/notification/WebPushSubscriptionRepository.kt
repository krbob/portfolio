package net.bobinski.portfolio.api.notification

import java.time.Instant

data class WebPushSubscriptionRecord(
    val endpoint: String,
    val p256dh: String,
    val auth: String,
    val userAgent: String?,
    val locale: PortfolioLocale,
    val createdAt: Instant,
    val updatedAt: Instant
)

data class SaveWebPushSubscriptionCommand(
    val endpoint: String,
    val p256dh: String,
    val auth: String,
    val userAgent: String?,
    val locale: PortfolioLocale
)

interface WebPushSubscriptionRepository {
    suspend fun list(): List<WebPushSubscriptionRecord>
    suspend fun save(command: SaveWebPushSubscriptionCommand, now: Instant): WebPushSubscriptionRecord
    suspend fun delete(endpoint: String): Boolean
}
