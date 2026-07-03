package net.bobinski.portfolio.api.route

import io.ktor.http.HttpStatusCode
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.delete
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import java.time.Clock
import java.time.Instant
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import net.bobinski.portfolio.api.notification.SaveWebPushSubscriptionCommand
import net.bobinski.portfolio.api.notification.WebPushSubscriptionRecord
import net.bobinski.portfolio.api.notification.WebPushSubscriptionRepository
import net.bobinski.portfolio.api.notification.config.PortfolioAlertConfig
import org.koin.ktor.ext.inject

fun Route.pushRoute() {
    val config: PortfolioAlertConfig by inject()
    val repository: WebPushSubscriptionRepository by inject()
    val clock: Clock by inject()

    get("/v1/push/config") {
        call.respond(
            PushConfigResponse(
                enabled = config.webPushEnabled,
                vapidPublicKey = config.webPushVapidPublicKey.takeIf { config.webPushEnabled }
            )
        )
    }.documented(
        operationId = "getPushConfig",
        summary = "Get web push configuration",
        description = "Returns whether web push is configured and the public VAPID key for browser subscriptions.",
        tag = "System"
    )

    post("/v1/push/subscriptions") {
        val request = call.receive<PushSubscriptionRequest>()
        request.validate()
        val record = repository.save(
            command = request.toCommand(),
            now = Instant.now(clock)
        )
        call.respond(HttpStatusCode.Created, record.toResponse())
    }.documented(
        operationId = "createPushSubscription",
        summary = "Create or update a web push subscription",
        description = "Stores the current browser push subscription endpoint and encryption keys.",
        tag = "System"
    )

    delete("/v1/push/subscriptions") {
        val request = call.receive<PushSubscriptionDeleteRequest>()
        request.validate()
        repository.delete(request.endpoint)
        call.respond(HttpStatusCode.NoContent)
    }.documented(
        operationId = "deletePushSubscription",
        summary = "Delete a web push subscription",
        description = "Removes a browser push subscription by endpoint.",
        tag = "System"
    )
}

private fun PushSubscriptionRequest.validate() {
    require(endpoint.isNotBlank()) { "Push endpoint must not be blank." }
    require(keys.p256dh.isNotBlank()) { "Push p256dh key must not be blank." }
    require(keys.auth.isNotBlank()) { "Push auth key must not be blank." }
}

private fun PushSubscriptionDeleteRequest.validate() {
    require(endpoint.isNotBlank()) { "Push endpoint must not be blank." }
}

private fun PushSubscriptionRequest.toCommand(): SaveWebPushSubscriptionCommand = SaveWebPushSubscriptionCommand(
    endpoint = endpoint,
    p256dh = keys.p256dh,
    auth = keys.auth,
    userAgent = userAgent
)

private fun WebPushSubscriptionRecord.toResponse(): PushSubscriptionResponse = PushSubscriptionResponse(
    endpoint = endpoint,
    createdAt = createdAt.toString(),
    updatedAt = updatedAt.toString()
)

@Serializable
data class PushConfigResponse(
    val enabled: Boolean,
    val vapidPublicKey: String? = null
)

@Serializable
data class PushSubscriptionKeysRequest(
    val p256dh: String,
    val auth: String
)

@Serializable
data class PushSubscriptionRequest(
    val endpoint: String,
    val expirationTime: Long? = null,
    val keys: PushSubscriptionKeysRequest,
    @SerialName("user_agent")
    val userAgent: String? = null
)

@Serializable
data class PushSubscriptionDeleteRequest(
    val endpoint: String
)

@Serializable
data class PushSubscriptionResponse(
    val endpoint: String,
    val createdAt: String,
    val updatedAt: String
)
