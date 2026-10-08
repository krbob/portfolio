package net.bobinski.portfolio.api.marketdata.client

import com.sun.net.httpserver.HttpServer
import java.net.InetSocketAddress
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpTimeoutException
import java.time.Duration
import java.time.Instant
import java.util.concurrent.atomic.AtomicInteger
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import net.bobinski.portfolio.api.monitoring.PortfolioMetrics
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows

class BusyUpstreamRetryTest {
    @Test
    fun `busy response recovers and keeps separate attempt retry and final result counts`() = fixture { server, requests ->
        val metrics = PortfolioMetrics()
        val start = System.nanoTime()
        val result = runBlocking { fetch(server, metrics) }
        assertEquals("ok", result)
        assertEquals(2, requests.get())
        assertTrue(Duration.ofNanos(System.nanoTime() - start).toMillis() >= 1_000)
        val text = metrics.scrape()
        assertTrue(text.contains("portfolio_upstream_requests_total{upstream=\"stock-analyst\",operation=\"quote\",outcome=\"http_5xx\"} 1"))
        assertTrue(text.contains("portfolio_upstream_requests_total{upstream=\"stock-analyst\",operation=\"quote\",outcome=\"success\"} 1"))
        assertTrue(text.contains("portfolio_upstream_retries_total{upstream=\"stock-analyst\",operation=\"quote\"} 1"))
    }

    @Test
    fun `persistent busy responses stop after three retries`() = fixture(alwaysBusy = true) { server, requests ->
        val error = assertThrows<MarketDataClientException> { runBlocking { fetch(server) } }
        assertEquals(503, error.statusCode)
        assertEquals("request-4", error.requestId)
        assertEquals(4, requests.get())
    }

    @Test
    fun `caller cancellation during backoff never sends a retry`() = fixture { server, requests ->
        assertThrows<TimeoutCancellationException> { runBlocking { withTimeout(300) { fetch(server) } } }
        assertEquals(1, requests.get())
    }

    @Test
    fun `a retry cannot multiply the total request budget`() = fixture(slowSuccess = true) { server, requests ->
        val start = System.nanoTime()
        assertThrows<HttpTimeoutException> {
            runBlocking { fetch(server, budget = Duration.ofMillis(1600)) }
        }
        assertEquals(2, requests.get())
        assertTrue(Duration.ofNanos(System.nanoTime() - start).toMillis() < 2300)
    }

    @Test
    fun `invalid long and noncapacity retry responses fail fast`() {
        for ((status, code, header) in listOf(
            Triple(429, "RATE_LIMITED", "1"), Triple(502, "UPSTREAM_ERROR", "1"),
            Triple(503, "SERVICE_UNAVAILABLE", "120"), Triple(503, "SERVICE_UNAVAILABLE", "bad")
        )) {
            fixture(alwaysBusy = true, status = status, header = header, code = code) { server, requests ->
                val error = assertThrows<MarketDataClientException> { runBlocking { fetch(server, code = code) } }
                assertEquals(status, error.statusCode)
                assertEquals(header, error.retryAfter)
                assertEquals(1, requests.get())
            }
        }
    }

    @Test
    fun `retry after supports HTTP dates and rejects negative or overflowing values`() {
        val now = Instant.parse("2026-10-08T08:00:00Z")
        assertEquals(3000L, retryAfterMillis("Thu, 08 Oct 2026 08:00:03 GMT", now))
        assertEquals(0L, retryAfterMillis("Thu, 08 Oct 2026 07:00:00 GMT", now))
        assertNull(retryAfterMillis("-1", now))
        assertNull(retryAfterMillis(Long.MAX_VALUE.toString(), now))
    }

    private suspend fun fetch(
        server: HttpServer, metrics: PortfolioMetrics = PortfolioMetrics(),
        budget: Duration = Duration.ofSeconds(20), code: String = "SERVICE_UNAVAILABLE"
    ): String = UpstreamHttpTransport(HttpClient.newHttpClient(), metrics).get(
        uri = URI.create("http://127.0.0.1:${server.address.port}/quote"), timeout = budget,
        context = UpstreamRequestContext("stock-analyst", "quote", "private-symbol"),
        decodeSuccess = { it },
        decodeError = { body -> UpstreamErrorEnvelope("busy", code, true, body) }, retryBusy = true
    )

    private fun fixture(
        alwaysBusy: Boolean = false, slowSuccess: Boolean = false,
        status: Int = 503, header: String = "1", code: String = "SERVICE_UNAVAILABLE",
        block: (HttpServer, AtomicInteger) -> Unit
    ) {
        val requests = AtomicInteger()
        val server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        server.createContext("/quote") { exchange ->
            val count = requests.incrementAndGet()
            val busy = alwaysBusy || count == 1
            if (!busy && slowSuccess) Thread.sleep(2000)
            val body = (if (busy) "request-$count" else "ok").toByteArray()
            exchange.responseHeaders.add("Retry-After", header)
            exchange.responseHeaders.add("X-Test-Error-Code", code)
            runCatching {
                exchange.sendResponseHeaders(if (busy) status else 200, body.size.toLong())
                exchange.responseBody.use { it.write(body) }
            }
        }
        server.start()
        try { block(server, requests) } finally { server.stop(0) }
    }
}
