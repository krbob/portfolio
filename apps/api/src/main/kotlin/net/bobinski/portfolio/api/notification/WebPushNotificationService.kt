package net.bobinski.portfolio.api.notification

import java.nio.charset.StandardCharsets
import java.security.KeyFactory
import java.security.PrivateKey
import java.security.Security
import java.security.spec.PKCS8EncodedKeySpec
import java.time.Clock
import java.time.Instant
import java.util.Base64
import java.util.concurrent.TimeUnit
import java.util.concurrent.TimeoutException
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import net.bobinski.portfolio.api.notification.config.PortfolioAlertConfig
import nl.martijndwars.webpush.Encoding
import nl.martijndwars.webpush.Notification
import nl.martijndwars.webpush.PushService
import nl.martijndwars.webpush.Utils
import org.apache.http.client.config.RequestConfig
import org.apache.http.impl.nio.client.HttpAsyncClients
import org.bouncycastle.jce.provider.BouncyCastleProvider
import org.slf4j.LoggerFactory

interface PortfolioPushNotifier {
    suspend fun send(alerts: List<PortfolioAlert>): WebPushDispatchResult
}

class WebPushNotificationService(
    private val config: PortfolioAlertConfig,
    private val subscriptionRepository: WebPushSubscriptionRepository,
    private val json: Json,
    private val clock: Clock
) : PortfolioPushNotifier {
    private val logger = LoggerFactory.getLogger(WebPushNotificationService::class.java)

    override suspend fun send(alerts: List<PortfolioAlert>): WebPushDispatchResult = withContext(Dispatchers.IO) {
        val subscriptions = subscriptionRepository.list()
        if (!config.webPushEnabled || alerts.isEmpty() || subscriptions.isEmpty()) {
            return@withContext WebPushDispatchResult(
                subscriptionCount = subscriptions.size,
                deliveredCount = 0,
                failedCount = 0,
                removedCount = 0,
                enabled = config.webPushEnabled
            )
        }

        val pushService = buildPushService()
        var delivered = 0
        var failed = 0
        var removed = 0

        subscriptions.forEach { subscription ->
            val payload = json.encodeToString(
                alerts.toPushPayload(locale = subscription.locale, timestamp = Instant.now(clock))
            )
            val statusCode = runCatching {
                sendWithTimeout(pushService, subscription, payload)
            }.getOrElse { error ->
                if (error is CancellationException) {
                    throw error
                }
                logger.warn("Web push failed for endpoint={}", subscription.endpoint, error)
                failed += 1
                return@forEach
            }

            when (statusCode) {
                in 200..299 -> delivered += 1
                404, 410 -> {
                    if (subscriptionRepository.delete(subscription.endpoint)) {
                        removed += 1
                    }
                }
                else -> {
                    failed += 1
                    logger.warn("Web push returned HTTP {} for endpoint={}", statusCode, subscription.endpoint)
                }
            }
        }

        return@withContext WebPushDispatchResult(
            subscriptionCount = subscriptions.size,
            deliveredCount = delivered,
            failedCount = failed,
            removedCount = removed,
            enabled = true
        )
    }

    private fun sendWithTimeout(
        pushService: PushService,
        subscription: WebPushSubscriptionRecord,
        payload: String
    ): Int {
        val request = pushService.preparePost(
            Notification(subscription.endpoint, subscription.p256dh, subscription.auth, payload),
            Encoding.AESGCM
        ).also { httpPost ->
            httpPost.config = webPushRequestConfig
        }

        HttpAsyncClients.custom()
            .setDefaultRequestConfig(webPushRequestConfig)
            .build()
            .use { client ->
                client.start()
                val future = client.execute(request, null)
                return try {
                    future.get(WEB_PUSH_TOTAL_TIMEOUT_SECONDS, TimeUnit.SECONDS).statusLine.statusCode
                } catch (error: TimeoutException) {
                    future.cancel(true)
                    throw error
                }
            }
    }

    private fun buildPushService(): PushService {
        ensureBouncyCastleProvider()
        return PushService()
            .setPublicKey(requireNotNull(config.webPushVapidPublicKey))
            .setPrivateKey(loadPrivateKey(requireNotNull(config.webPushVapidPrivateKey)))
            .setSubject(requireNotNull(config.webPushVapidSubject))
    }

    private fun loadPrivateKey(value: String): PrivateKey {
        val trimmed = value.trim()
        loadPemOrPkcs8PrivateKey(trimmed)?.let { return it }
        return Utils.loadPrivateKey(trimmed)
    }

    private fun loadPemOrPkcs8PrivateKey(value: String): PrivateKey? {
        val decoded = runCatching { Base64.getDecoder().decode(value) }.getOrNull()
        val candidates = buildList {
            decoded?.let { bytes ->
                add(bytes)
                val decodedText = bytes.toString(StandardCharsets.UTF_8)
                if (decodedText.contains("BEGIN PRIVATE KEY")) {
                    add(extractPemBody(decodedText))
                }
            }
            if (value.contains("BEGIN PRIVATE KEY")) {
                add(extractPemBody(value))
            }
        }

        return candidates.firstNotNullOfOrNull { bytes ->
            runCatching {
                KeyFactory.getInstance("EC").generatePrivate(PKCS8EncodedKeySpec(bytes))
            }.getOrNull()
        }
    }

    private fun extractPemBody(pem: String): ByteArray {
        val body = pem
            .lineSequence()
            .filterNot { line -> line.startsWith("-----") }
            .joinToString(separator = "")
            .replace("\\s".toRegex(), "")
        return Base64.getDecoder().decode(body)
    }

    private fun ensureBouncyCastleProvider() {
        if (Security.getProvider(BouncyCastleProvider.PROVIDER_NAME) == null) {
            Security.addProvider(BouncyCastleProvider())
        }
    }

    private companion object {
        const val WEB_PUSH_CONNECT_TIMEOUT_MS = 5_000
        const val WEB_PUSH_REQUEST_TIMEOUT_MS = 5_000
        const val WEB_PUSH_SOCKET_TIMEOUT_MS = 10_000
        const val WEB_PUSH_TOTAL_TIMEOUT_SECONDS = 12L

        val webPushRequestConfig: RequestConfig = RequestConfig.custom()
            .setConnectTimeout(WEB_PUSH_CONNECT_TIMEOUT_MS)
            .setConnectionRequestTimeout(WEB_PUSH_REQUEST_TIMEOUT_MS)
            .setSocketTimeout(WEB_PUSH_SOCKET_TIMEOUT_MS)
            .build()
    }
}

internal fun List<PortfolioAlert>.toPushPayload(
    locale: PortfolioLocale,
    timestamp: Instant
): PortfolioPushPayload {
    val localizedAlerts = map { alert -> alert.localize(locale) }
    val count = localizedAlerts.size
    val firstAlert = localizedAlerts.first()
    val title = if (count == 1) {
        firstAlert.title
    } else {
        when (locale) {
            PortfolioLocale.PL -> "Portfolio: $count nowe alerty"
            PortfolioLocale.EN -> "Portfolio: $count new alerts"
        }
    }
    val body = if (count == 1) {
        firstAlert.message
    } else {
        localizedAlerts.take(2).joinToString(separator = ", ") { alert -> alert.title } +
            if (count > 2) " +${count - 2}" else ""
    }

    return PortfolioPushPayload(
        title = title,
        body = body,
        tag = "portfolio-alerts",
        url = firstAlert.route,
        icon = "/favicon.svg",
        badge = "/favicon.svg",
        timestamp = timestamp.toString()
    )
}

data class WebPushDispatchResult(
    val subscriptionCount: Int,
    val deliveredCount: Int,
    val failedCount: Int,
    val removedCount: Int,
    val enabled: Boolean
) {
    companion object {
        fun empty(): WebPushDispatchResult = WebPushDispatchResult(
            subscriptionCount = 0,
            deliveredCount = 0,
            failedCount = 0,
            removedCount = 0,
            enabled = false
        )
    }
}

@Serializable
internal data class PortfolioPushPayload(
    val title: String,
    val body: String,
    val tag: String,
    val url: String,
    val icon: String,
    val badge: String,
    val timestamp: String
)
