package net.bobinski.portfolio.api.marketdata.client

import com.sun.net.httpserver.HttpExchange
import com.sun.net.httpserver.HttpServer
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.withTimeout
import net.bobinski.portfolio.api.config.AppJsonFactory
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import java.net.InetSocketAddress
import java.net.http.HttpClient
import java.net.URI
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.YearMonth
import java.util.concurrent.atomic.AtomicInteger

class UpstreamClientErrorContractTest {

    @Test
    fun `caller deadline cancels the in-flight upstream request`() {
        val requests = AtomicInteger()
        val server = errorServer("/slow") { exchange ->
            requests.incrementAndGet()
            Thread.sleep(1_000)
            runCatching { exchange.respond(status = 200, body = "{}") }
        }

        try {
            val transport = UpstreamHttpTransport(HttpClient.newHttpClient())
            val startedAt = System.nanoTime()

            assertThrows<TimeoutCancellationException> {
                runBlocking {
                    withTimeout(250) {
                        transport.get(
                            uri = URI.create("${server.baseUrl()}/slow"),
                            timeout = Duration.ofSeconds(5),
                            context = UpstreamRequestContext(
                                upstream = "slow-upstream",
                                operation = "deadline-test",
                                subject = "fixture"
                            ),
                            decodeSuccess = { body -> body },
                            decodeError = { null }
                        )
                    }
                }
            }

            val elapsedMs = Duration.ofNanos(System.nanoTime() - startedAt).toMillis()
            assertTrue(elapsedMs < 900, "Caller deadline took ${elapsedMs} ms to cancel the request.")
            assertEquals(1, requests.get())
        } finally {
            server.stop(0)
        }
    }

    @Test
    fun `stock client exposes history provenance without folding it into price points`() {
        val server = errorServer("/v1/history/AAPL") { exchange ->
            exchange.respond(
                status = 200,
                body = """
                    {
                      "prices": [{"date":"2026-03-20","close":215.25}],
                      "provenance": {
                        "source": "YAHOO_FINANCE",
                        "retrievedAt": "2026-03-20T20:01:02Z",
                        "marketTimestamp": "2026-03-20T20:00:00Z",
                        "marketDate": "2026-03-20",
                        "currency": "USD",
                        "unitScale": 1.0,
                        "adjustment": "SPLIT_ADJUSTED",
                        "coverageFrom": "2026-03-01",
                        "coverageTo": "2026-03-20",
                        "status": "FRESH"
                      }
                    }
                """.trimIndent()
            )
        }

        try {
            val client = StockAnalystClient(
                httpClient = HttpClient.newHttpClient(),
                json = AppJsonFactory.create(),
                baseUrl = server.baseUrl()
            )

            val result = runBlocking {
                client.history(
                    symbol = "AAPL",
                    from = LocalDate.parse("2026-03-01"),
                    to = LocalDate.parse("2026-03-20")
                )
            }

            assertEquals(1, result.prices.size)
            assertEquals("YAHOO_FINANCE", result.provenance.source)
            assertEquals(Instant.parse("2026-03-20T20:01:02Z"), result.provenance.retrievedAt)
            assertEquals(LocalDate.parse("2026-03-01"), result.provenance.coverageFrom)
            assertEquals(LocalDate.parse("2026-03-20"), result.provenance.coverageTo)
            assertEquals(1.0, result.provenance.unitScale)
            assertEquals("FRESH", result.provenance.status)
        } finally {
            server.stop(0)
        }
    }

    @Test
    fun `stock client preserves the common error envelope and never retries an HTTP response`() {
        val requests = AtomicInteger()
        val server = errorServer("/v1/quote/AAPL") { exchange ->
            requests.incrementAndGet()
            exchange.responseHeaders.add("X-Request-ID", "header-request")
            exchange.responseHeaders.add("Retry-After", "3")
            exchange.respond(
                status = 503,
                body = errorBody(
                    error = "Loader capacity exhausted",
                    errorCode = "SERVICE_UNAVAILABLE",
                    retryable = true,
                    requestId = "body-request"
                )
            )
        }

        try {
            val client = StockAnalystClient(
                httpClient = HttpClient.newHttpClient(),
                json = AppJsonFactory.create(),
                baseUrl = server.baseUrl()
            )

            val exception = assertThrows<MarketDataClientException> {
                runBlocking { client.quote("AAPL") }
            }

            assertEquals(503, exception.status)
            assertEquals("SERVICE_UNAVAILABLE", exception.errorCode)
            assertEquals(true, exception.retryable)
            assertEquals("body-request", exception.requestId)
            assertEquals("3", exception.retryAfter)
            assertEquals("Loader capacity exhausted", exception.upstreamError)
            assertTrue(exception.responseBodyPreview!!.contains("SERVICE_UNAVAILABLE"))
            assertEquals(1, requests.get())
        } finally {
            server.stop(0)
        }
    }

    @Test
    fun `edo client exposes provider error metadata and accepts Retry-After when supplied`() {
        val requests = AtomicInteger()
        val server = errorServer("/v1/inflation/monthly") { exchange ->
            requests.incrementAndGet()
            assertEquals(
                "startYear=2025&startMonth=1&endYear=2025&endMonth=3",
                exchange.requestURI.rawQuery
            )
            exchange.responseHeaders.add("X-Request-ID", "edo-request")
            exchange.responseHeaders.add("Retry-After", "1")
            exchange.respond(
                status = 503,
                body = errorBody(
                    error = "CPI provider timeout",
                    errorCode = "CPI_PROVIDER_UNAVAILABLE",
                    retryable = true,
                    requestId = null
                )
            )
        }

        try {
            val client = EdoCalculatorClient(
                httpClient = HttpClient.newHttpClient(),
                json = AppJsonFactory.create(),
                baseUrl = server.baseUrl()
            )

            val exception = assertThrows<MarketDataClientException> {
                runBlocking {
                    client.monthlyInflation(YearMonth.of(2025, 1), YearMonth.of(2025, 3))
                }
            }

            assertEquals(503, exception.statusCode)
            assertEquals("CPI_PROVIDER_UNAVAILABLE", exception.errorCode)
            assertEquals(true, exception.retryable)
            assertEquals("edo-request", exception.requestId)
            assertEquals("1", exception.retryAfter)
            assertFalse(exception.message!!.contains("null"))
            assertEquals(1, requests.get())
        } finally {
            server.stop(0)
        }
    }

    private fun errorServer(path: String, handler: (HttpExchange) -> Unit): HttpServer =
        HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0).apply {
            createContext(path) { exchange -> handler(exchange) }
            start()
        }

    private fun HttpServer.baseUrl(): String = "http://127.0.0.1:${address.port}"

    private fun HttpExchange.respond(status: Int, body: String) {
        val bytes = body.toByteArray()
        responseHeaders.add("Content-Type", "application/json")
        sendResponseHeaders(status, bytes.size.toLong())
        responseBody.use { it.write(bytes) }
    }

    private fun errorBody(
        error: String,
        errorCode: String,
        retryable: Boolean,
        requestId: String?
    ): String = """
        {
          "error": "$error",
          "errorCode": "$errorCode",
          "retryable": $retryable,
          "requestId": ${requestId?.let { "\"$it\"" } ?: "null"}
        }
    """.trimIndent()
}
