package net.bobinski.portfolio.api.marketdata.client

import com.sun.net.httpserver.HttpServer
import kotlinx.coroutines.async
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.yield
import net.bobinski.portfolio.api.config.AppJsonFactory
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.math.BigDecimal
import java.net.Authenticator
import java.net.CookieHandler
import java.net.InetSocketAddress
import java.net.ProxySelector
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Duration
import java.time.LocalDate
import java.util.Optional
import java.util.concurrent.CompletableFuture
import java.util.concurrent.Executor
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference
import javax.net.ssl.SSLContext
import javax.net.ssl.SSLParameters

class GoldApiClientTest {

    @Test
    fun `historyUsd parses day buckets and sends api key`() = runBlocking {
        val requestPath = AtomicReference<String>()
        val apiKeyHeader = AtomicReference<String?>()
        val responseBody = """
            [
              {"day":"2026-03-19 00:00:00","avg_price":3025.15},
              {"day":"2026-03-20T00:00:00Z","avg_price":3031.40}
            ]
        """.trimIndent()
        val server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        server.createContext("/history") { exchange ->
            requestPath.set(exchange.requestURI.toString())
            apiKeyHeader.set(exchange.requestHeaders.getFirst("x-api-key"))
            val bytes = responseBody.toByteArray()
            exchange.sendResponseHeaders(200, bytes.size.toLong())
            exchange.responseBody.use { it.write(bytes) }
        }
        server.start()

        try {
            val client = GoldApiClient(
                httpClient = HttpClient.newBuilder().build(),
                json = AppJsonFactory.create(),
                baseUrl = "http://127.0.0.1:${server.address.port}"
            )

            val points = client.historyUsd(
                apiKey = "test-key",
                from = LocalDate.parse("2026-03-19"),
                to = LocalDate.parse("2026-03-20")
            )

            assertEquals("test-key", apiKeyHeader.get())
            assertEquals(
                "/history?symbol=XAU&groupBy=day&aggregation=avg&orderBy=asc&startTimestamp=1773878400&endTimestamp=1774051199",
                requestPath.get()
            )
            assertEquals(2, points.size)
            assertEquals(LocalDate.parse("2026-03-19"), points[0].date)
            assertEquals(BigDecimal("3025.15"), points[0].closePriceUsd)
            assertEquals(LocalDate.parse("2026-03-20"), points[1].date)
            assertEquals(BigDecimal("3031.40"), points[1].closePriceUsd)
        } finally {
            server.stop(0)
        }
    }

    @Test
    fun `historyUsd cancellation cancels the upstream request future`() = runBlocking {
        val responseFuture = TrackingResponseFuture()
        val httpClient = PendingHttpClient(responseFuture)
        val client = GoldApiClient(
            httpClient = httpClient,
            json = AppJsonFactory.create(),
            baseUrl = "http://gold.test"
        )

        val request = async {
            client.historyUsd(
                apiKey = "test-key",
                from = LocalDate.parse("2026-03-19"),
                to = LocalDate.parse("2026-03-20")
            )
        }
        while (!httpClient.requestStarted.get()) yield()

        request.cancelAndJoin()

        assertTrue(responseFuture.cancelledWithInterrupt.get())
        assertTrue(responseFuture.isCancelled)
    }
}

private class TrackingResponseFuture : CompletableFuture<HttpResponse<String>>() {
    val cancelledWithInterrupt = AtomicBoolean(false)

    override fun cancel(mayInterruptIfRunning: Boolean): Boolean {
        cancelledWithInterrupt.set(mayInterruptIfRunning)
        return super.cancel(mayInterruptIfRunning)
    }
}

private class PendingHttpClient(
    private val responseFuture: CompletableFuture<HttpResponse<String>>,
    private val delegate: HttpClient = HttpClient.newHttpClient()
) : HttpClient() {
    val requestStarted = AtomicBoolean(false)

    override fun cookieHandler(): Optional<CookieHandler> = delegate.cookieHandler()
    override fun connectTimeout(): Optional<Duration> = delegate.connectTimeout()
    override fun followRedirects(): Redirect = delegate.followRedirects()
    override fun proxy(): Optional<ProxySelector> = delegate.proxy()
    override fun sslContext(): SSLContext = delegate.sslContext()
    override fun sslParameters(): SSLParameters = delegate.sslParameters()
    override fun authenticator(): Optional<Authenticator> = delegate.authenticator()
    override fun version(): Version = delegate.version()
    override fun executor(): Optional<Executor> = delegate.executor()

    override fun <T : Any?> send(
        request: HttpRequest,
        responseBodyHandler: HttpResponse.BodyHandler<T>
    ): HttpResponse<T> = error("GoldApiClient must use the cancellable asynchronous transport.")

    @Suppress("UNCHECKED_CAST")
    override fun <T : Any?> sendAsync(
        request: HttpRequest,
        responseBodyHandler: HttpResponse.BodyHandler<T>
    ): CompletableFuture<HttpResponse<T>> {
        requestStarted.set(true)
        return responseFuture as CompletableFuture<HttpResponse<T>>
    }

    override fun <T : Any?> sendAsync(
        request: HttpRequest,
        responseBodyHandler: HttpResponse.BodyHandler<T>,
        pushPromiseHandler: HttpResponse.PushPromiseHandler<T>
    ): CompletableFuture<HttpResponse<T>> = sendAsync(request, responseBodyHandler)
}
