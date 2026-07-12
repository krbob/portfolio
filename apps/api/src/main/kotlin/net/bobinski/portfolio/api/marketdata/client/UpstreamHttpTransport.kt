package net.bobinski.portfolio.api.marketdata.client

import kotlinx.coroutines.Dispatchers
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
    // stock-analyst has a 15 s backend request budget; Portfolio keeps 5 s for serialization and transfer.
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
    private val httpClient: HttpClient
) {
    suspend fun <T> get(
        uri: URI,
        timeout: Duration,
        context: UpstreamRequestContext,
        decodeSuccess: (String) -> T,
        decodeError: (String) -> UpstreamErrorEnvelope?
    ): T = withContext(Dispatchers.IO) {
        val request = HttpRequest.newBuilder()
            .uri(uri)
            .timeout(timeout)
            .header("Accept", "application/json")
            .GET()
            .build()
        val response = httpClient.sendAsync(request, HttpResponse.BodyHandlers.ofString()).awaitCancellable()
        if (response.statusCode() !in 200..299) {
            val envelope = runCatching { decodeError(response.body()) }.getOrNull()
            val responseRequestId = response.headers().firstValue(REQUEST_ID_HEADER).orElse(null)
            throw MarketDataClientException(
                message = buildFailureMessage(context, response.statusCode(), envelope?.error),
                upstream = context.upstream,
                operation = context.operation,
                symbol = context.subject,
                statusCode = response.statusCode(),
                upstreamError = envelope?.error,
                errorCode = envelope?.errorCode,
                retryable = envelope?.retryable,
                requestId = envelope?.requestId ?: responseRequestId,
                retryAfter = response.headers().firstValue(RETRY_AFTER_HEADER).orElse(null),
                responseBodyPreview = responseBodyPreview(response.body())
            )
        }
        decodeSuccess(response.body())
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
