package net.bobinski.portfolio.api.marketdata.client

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withTimeoutOrNull
import net.bobinski.portfolio.api.monitoring.PortfolioMetrics
import java.io.IOException
import java.net.http.HttpTimeoutException
import java.time.Instant
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import kotlin.random.Random
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import java.net.URI
import java.net.URLEncoder
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.nio.charset.StandardCharsets
import java.time.Duration
import java.util.concurrent.CompletableFuture
import java.util.concurrent.CompletionException
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

internal object UpstreamTimeoutBudgets {
    // Stock Analyst allows 15 s attempts within an 18.5 s shared backend-operation budget.
    // Portfolio bounds the public request, including any currency conversion, at 20 s.
    val STOCK_ANALYST: Duration = Duration.ofSeconds(20)

    // edo-calculator caps a domain operation at 8 s; Portfolio keeps 2 s for serialization and transfer.
    val EDO_CALCULATOR: Duration = Duration.ofSeconds(10)

    val CONNECT: Duration = Duration.ofSeconds(5)
}

internal data class UpstreamErrorEnvelope(
    val error: String,
    val errorCode: String,
    val retryable: Boolean,
    val requestId: String?
)

internal data class UpstreamRequestContext(
    val upstream: String,
    val operation: String,
    val subject: String
)

internal class UpstreamHttpTransport(
    private val httpClient: HttpClient,
    private val metrics: PortfolioMetrics = PortfolioMetrics()
) {
    suspend fun <T> get(
        uri: URI,
        timeout: Duration,
        context: UpstreamRequestContext,
        decodeSuccess: (String) -> T,
        decodeError: (String) -> UpstreamErrorEnvelope?,
        retryBusy: Boolean = false
    ): T = withContext(Dispatchers.IO) {
        val startedAt = System.nanoTime()
        val result = withTimeoutOrNull(timeout.toMillis()) {
            var retries = 0
            while (true) {
                try {
                    return@withTimeoutOrNull Result.success(
                        request(uri, timeout, context, decodeSuccess, decodeError)
                    )
                } catch (exception: MarketDataClientException) {
                    val remainingMillis = timeout.toMillis() - (System.nanoTime() - startedAt) / 1_000_000
                    val waitMillis = if (retryBusy) busyRetryDelayMillis(exception, retries) else null
                    if (waitMillis == null || waitMillis + MIN_ATTEMPT_MILLIS >= remainingMillis) throw exception
                    // The caller keeps its concurrency permit during backoff, preventing a burst
                    // of subsequent portfolio requests while existing Yahoo loaders finish.
                    delay(waitMillis)
                    metrics.upstreamRetry(context.upstream, context.operation)
                    retries++
                }
            }
            @Suppress("UNREACHABLE_CODE")
            error("Unreachable upstream retry loop")
        }
        if (result == null) {
            metrics.upstreamRequest(context.upstream, context.operation, "timeout")
            throw HttpTimeoutException("${context.upstream} ${context.operation} exceeded its total request budget.")
        }
        result.getOrThrow()
    }

    private suspend fun <T> request(
        uri: URI,
        timeout: Duration,
        context: UpstreamRequestContext,
        decodeSuccess: (String) -> T,
        decodeError: (String) -> UpstreamErrorEnvelope?
    ): T {
        val request = HttpRequest.newBuilder().uri(uri).timeout(timeout)
            .header("Accept", "application/json").GET().build()
        val response = send(request, context)
        val status = response.statusCode()
        metrics.upstreamRequest(context.upstream, context.operation, when {
            status in 200..299 -> "success"
            status == 429 -> "http_429"
            status in 400..499 -> "http_4xx"
            status in 500..599 -> "http_5xx"
            else -> "other"
        })
        if (status !in 200..299) {
            val envelope = runCatching { decodeError(response.body()) }.getOrNull()
            val responseRequestId = response.headers().firstValue(REQUEST_ID_HEADER).orElse(null)
            throw MarketDataClientException(
                message = buildFailureMessage(context, status, envelope?.error),
                upstream = context.upstream,
                operation = context.operation,
                symbol = context.subject,
                statusCode = status,
                upstreamError = envelope?.error,
                errorCode = envelope?.errorCode,
                retryable = envelope?.retryable,
                requestId = envelope?.requestId ?: responseRequestId,
                retryAfter = response.headers().firstValue(RETRY_AFTER_HEADER).orElse(null),
                responseBodyPreview = responseBodyPreview(response.body())
            )
        }
        return decodeSuccess(response.body())
    }

    private suspend fun send(
        request: HttpRequest,
        context: UpstreamRequestContext
    ): HttpResponse<String> = try {
        httpClient.sendAsync(request, HttpResponse.BodyHandlers.ofString()).awaitCancellable()
    } catch (exception: HttpTimeoutException) {
        metrics.upstreamRequest(context.upstream, context.operation, "timeout")
        throw exception
    } catch (exception: IOException) {
        metrics.upstreamRequest(context.upstream, context.operation, "transport_error")
        throw exception
    }

    private fun buildFailureMessage(
        context: UpstreamRequestContext,
        statusCode: Int,
        upstreamError: String?
    ): String = buildString {
        append(context.upstream)
        append(" returned HTTP ")
        append(statusCode)
        append(" for ")
        append(context.operation)
        append(" (")
        append(context.subject)
        append(").")
        if (upstreamError != null) {
            append(" ")
            append(upstreamError)
        }
    }

    private companion object {
        const val MIN_ATTEMPT_MILLIS = 250L
        const val REQUEST_ID_HEADER = "X-Request-ID"
        const val RETRY_AFTER_HEADER = "Retry-After"
    }
}

internal suspend fun <T> CompletableFuture<T>.awaitCancellable(): T = suspendCancellableCoroutine { continuation ->
    whenComplete { value, error ->
        if (!continuation.isActive) return@whenComplete
        if (error == null) {
            continuation.resume(value)
        } else {
            continuation.resumeWithException(
                if (error is CompletionException && error.cause != null) error.cause!! else error
            )
        }
    }
    continuation.invokeOnCancellation { cancel(true) }
}

internal fun buildUpstreamUri(
    baseUrl: String,
    pathTemplate: String,
    pathParameters: Map<String, String> = emptyMap(),
    queryParameters: List<Pair<String, String?>> = emptyList()
): URI {
    val path = pathParameters.entries.fold(pathTemplate) { current, (name, value) ->
        current.replace("{$name}", encodeUrlComponent(value))
    }
    require('{' !in path && '}' !in path) { "Missing path parameter for $pathTemplate." }
    val query = queryParameters
        .filter { (_, value) -> value != null }
        .joinToString("&") { (name, value) ->
            "${encodeUrlComponent(name)}=${encodeUrlComponent(requireNotNull(value))}"
        }
    val suffix = if (query.isEmpty()) path else "$path?$query"
    return URI.create("${baseUrl.trimEnd('/')}$suffix")
}

private fun encodeUrlComponent(value: String): String =
    URLEncoder.encode(value, StandardCharsets.UTF_8).replace("+", "%20")

/** Only classified capacity errors qualify; 429, proxy errors and decode failures fail fast. */
internal fun busyRetryDelayMillis(error: MarketDataClientException, retries: Int, now: Instant = Instant.now()): Long? {
    if (retries >= 3) return null
    if (error.statusCode != 503 || error.retryable != true || error.errorCode != "SERVICE_UNAVAILABLE") return null
    val advertisedMillis = retryAfterMillis(error.retryAfter, now) ?: return null
    if (advertisedMillis >= UpstreamTimeoutBudgets.STOCK_ANALYST.toMillis()) return null
    return maxOf(advertisedMillis, 1_000L shl retries) + Random.nextLong(0, 251)
}

internal fun retryAfterMillis(value: String?, now: Instant): Long? {
    if (value == null) return 0
    val seconds = value.trim().toLongOrNull()
    if (seconds != null) return seconds.takeIf { it >= 0 && it <= Long.MAX_VALUE / 1_000 }?.times(1_000)
    return runCatching {
        val at = ZonedDateTime.parse(value, DateTimeFormatter.RFC_1123_DATE_TIME).toInstant()
        Duration.between(now, at).toMillis().coerceAtLeast(0)
    }.getOrNull()
}
