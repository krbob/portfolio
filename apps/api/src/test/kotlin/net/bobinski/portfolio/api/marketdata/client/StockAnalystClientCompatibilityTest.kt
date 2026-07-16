package net.bobinski.portfolio.api.marketdata.client

import com.sun.net.httpserver.HttpExchange
import com.sun.net.httpserver.HttpServer
import java.net.InetSocketAddress
import java.net.http.HttpClient
import java.time.LocalDate
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.CountDownLatch
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.runBlocking
import net.bobinski.portfolio.api.config.AppJsonFactory
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows

class StockAnalystClientCompatibilityTest {

    @Test
    fun `new consumer falls back to legacy quote and history during a mixed rollout`() {
        val requestedPaths = CopyOnWriteArrayList<String>()
        val server = FixtureServer {
            route("/v1/") { exchange ->
                requestedPaths += exchange.requestURI.path
                exchange.respondWithoutBody(status = 404)
            }
            route("/quote/") { exchange ->
                requestedPaths += exchange.requestURI.path
                exchange.respondJson(status = 200, body = legacyQuoteBody("VWRA.L"))
            }
            route("/history/") { exchange ->
                requestedPaths += exchange.requestURI.path
                exchange.respondJson(status = 200, body = legacyHistoryBody())
            }
        }

        try {
            val client = client(server)

            val (quote, history) = runBlocking {
                client.quoteInPln("VWRA.L") to client.historyInPln(
                    symbol = "VWRA.L",
                    from = LocalDate.parse("2026-03-19"),
                    to = LocalDate.parse("2026-03-20")
                )
            }

            assertEquals(123.45, quote.lastPrice)
            assertEquals("YAHOO_FINANCE", quote.provenance.source)
            assertEquals(LocalDate.parse("2026-03-20"), quote.provenance.marketDate)
            assertEquals(2, history.prices.size)
            assertEquals(LocalDate.parse("2026-03-19"), history.provenance.coverageFrom)
            assertEquals(LocalDate.parse("2026-03-20"), history.provenance.coverageTo)
            assertEquals(
                listOf(
                    "/v1/quote/VWRA.L",
                    "/quote/VWRA.L",
                    "/v1/history/VWRA.L",
                    "/history/VWRA.L"
                ),
                requestedPaths
            )
        } finally {
            server.close()
        }
    }

    @Test
    fun `contract route-not-found response activates the legacy alias`() {
        val legacyRequests = AtomicInteger()
        val server = FixtureServer {
            route("/v1/quote/AAPL") { exchange ->
                exchange.respondJson(
                    status = 404,
                    body = errorBody(errorCode = "ROUTE_NOT_FOUND")
                )
            }
            route("/quote/AAPL") { exchange ->
                legacyRequests.incrementAndGet()
                exchange.respondJson(status = 200, body = legacyQuoteBody("AAPL"))
            }
        }

        try {
            val quote = runBlocking { client(server).quote("AAPL") }

            assertEquals("AAPL", quote.symbol)
            assertEquals(1, legacyRequests.get())
        } finally {
            server.close()
        }
    }

    @Test
    fun `symbol-not-found never activates the legacy alias`() {
        val legacyRequests = AtomicInteger()
        val server = FixtureServer {
            route("/v1/quote/MISSING") { exchange ->
                exchange.respondJson(
                    status = 404,
                    body = errorBody(errorCode = "SYMBOL_NOT_FOUND")
                )
            }
            route("/quote/MISSING") { exchange ->
                legacyRequests.incrementAndGet()
                exchange.respondJson(status = 200, body = legacyQuoteBody("MISSING"))
            }
        }

        try {
            val exception = assertThrows<MarketDataClientException> {
                runBlocking { client(server).quote("MISSING") }
            }

            assertEquals("SYMBOL_NOT_FOUND", exception.errorCode)
            assertEquals(0, legacyRequests.get())
        } finally {
            server.close()
        }
    }

    @Test
    fun `all client instances share a two-request concurrency limit`() {
        val activeRequests = AtomicInteger()
        val maximumActiveRequests = AtomicInteger()
        val totalRequests = AtomicInteger()
        val firstBatchStarted = CountDownLatch(2)
        val releaseRequests = CountDownLatch(1)
        val server = FixtureServer {
            route("/v1/quote/") { exchange ->
                totalRequests.incrementAndGet()
                val active = activeRequests.incrementAndGet()
                maximumActiveRequests.updateAndGet { current -> maxOf(current, active) }
                firstBatchStarted.countDown()
                try {
                    check(releaseRequests.await(5, TimeUnit.SECONDS)) {
                        "Timed out waiting to release concurrent Stock Analyst requests."
                    }
                    val symbol = exchange.requestURI.path.substringAfterLast('/')
                    exchange.respondJson(status = 200, body = currentQuoteBody(symbol))
                } finally {
                    activeRequests.decrementAndGet()
                }
            }
        }

        try {
            val clients = List(3) { client(server) }
            val quotes = runBlocking {
                val requests = (1..9).map { index ->
                    async(Dispatchers.Default) {
                        clients[index % clients.size].quote("STOCK$index")
                    }
                }
                try {
                    assertTrue(firstBatchStarted.await(5, TimeUnit.SECONDS))
                    Thread.sleep(150)
                    assertEquals(2, activeRequests.get())
                    assertEquals(2, totalRequests.get())
                } finally {
                    releaseRequests.countDown()
                }
                requests.awaitAll()
            }

            assertEquals(9, quotes.size)
            assertEquals(9, totalRequests.get())
            assertEquals(2, maximumActiveRequests.get())
        } finally {
            releaseRequests.countDown()
            server.close()
        }
    }

    private fun client(server: FixtureServer): StockAnalystClient = StockAnalystClient(
        httpClient = HttpClient.newHttpClient(),
        json = AppJsonFactory.create(),
        baseUrl = server.baseUrl
    )
}

private class FixtureServer(configure: FixtureServer.() -> Unit) : AutoCloseable {
    private val executor: ExecutorService = Executors.newCachedThreadPool()
    private val server: HttpServer = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)

    val baseUrl: String
        get() = "http://127.0.0.1:${server.address.port}"

    init {
        configure()
        server.executor = executor
        server.start()
    }

    fun route(path: String, handler: (HttpExchange) -> Unit) {
        server.createContext(path) { exchange -> handler(exchange) }
    }

    override fun close() {
        server.stop(0)
        executor.shutdownNow()
        executor.awaitTermination(5, TimeUnit.SECONDS)
    }
}

private fun HttpExchange.respondWithoutBody(status: Int) {
    sendResponseHeaders(status, -1)
    close()
}

private fun HttpExchange.respondJson(status: Int, body: String) {
    val bytes = body.toByteArray()
    responseHeaders.add("Content-Type", "application/json")
    sendResponseHeaders(status, bytes.size.toLong())
    responseBody.use { it.write(bytes) }
}

private fun legacyQuoteBody(symbol: String): String = """
    {
      "symbol": "$symbol",
      "currency": "PLN",
      "date": "2026-03-20",
      "lastPrice": 123.45,
      "previousClose": 122.00
    }
""".trimIndent()

private fun legacyHistoryBody(): String = """
    {
      "prices": [
        {"date":"2026-03-19","close":122.00},
        {"date":"2026-03-20","close":123.45}
      ]
    }
""".trimIndent()

private fun currentQuoteBody(symbol: String): String = legacyQuoteBody(symbol).withStockAnalystProvenance()

private fun errorBody(errorCode: String): String = """
    {
      "error": "Fixture error",
      "errorCode": "$errorCode",
      "retryable": false,
      "requestId": "fixture-request"
    }
""".trimIndent()
