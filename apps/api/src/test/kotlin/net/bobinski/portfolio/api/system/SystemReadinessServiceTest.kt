package net.bobinski.portfolio.api.system

import com.sun.net.httpserver.HttpExchange
import com.sun.net.httpserver.HttpHandler
import com.sun.net.httpserver.HttpServer
import java.net.InetSocketAddress
import java.net.http.HttpClient
import java.nio.charset.StandardCharsets
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import java.util.concurrent.atomic.AtomicInteger
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.json.Json
import net.bobinski.portfolio.api.auth.config.AuthConfig
import net.bobinski.portfolio.api.backup.config.BackupConfig
import net.bobinski.portfolio.api.marketdata.client.EdoCalculatorClient
import net.bobinski.portfolio.api.marketdata.client.GoldApiClient
import net.bobinski.portfolio.api.marketdata.client.StockAnalystClient
import net.bobinski.portfolio.api.marketdata.client.withStockAnalystProvenance
import net.bobinski.portfolio.api.marketdata.config.MarketDataConfig
import net.bobinski.portfolio.api.persistence.config.JournalMode
import net.bobinski.portfolio.api.persistence.config.PersistenceConfig
import net.bobinski.portfolio.api.persistence.config.SynchronousMode
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class SystemReadinessServiceTest {

    @Test
    fun `readiness degrades when live market data probes fail`() = runBlocking {
        val service = SystemReadinessService(
            persistenceConfig = persistenceConfig(),
            backupConfig = backupConfig(),
            marketDataConfig = marketDataConfig(baseUrl = "http://127.0.0.1:9"),
            authConfig = authConfig(),
            clock = fixedClock(),
            stockAnalystClient = stockAnalystClient("http://127.0.0.1:9"),
            edoCalculatorClient = edoCalculatorClient("http://127.0.0.1:9"),
            goldApiClient = goldApiClient("http://127.0.0.1:9")
        )

        val readiness = service.current()

        assertEquals(SystemReadinessStatus.DEGRADED, readiness.status)
        assertEquals(ReadinessCheckStatus.WARN, readiness.check("stock-analyst").status)
        assertEquals(ReadinessCheckStatus.WARN, readiness.check("edo-calculator").status)
        assertEquals(ReadinessCheckStatus.INFO, readiness.check("gold-market-data").status)
        assertTrue(readiness.check("gold-market-data").message.contains("GC=F"))
    }

    @Test
    fun `readiness reports passing probes when market data upstreams respond`() = runBlocking {
        val server = FakeMarketDataServer()
        server.start()

        try {
            val service = SystemReadinessService(
                persistenceConfig = persistenceConfig(),
                backupConfig = backupConfig(),
                marketDataConfig = marketDataConfig(baseUrl = server.baseUrl),
                authConfig = authConfig(),
                clock = fixedClock(),
                stockAnalystClient = stockAnalystClient(server.baseUrl),
                edoCalculatorClient = edoCalculatorClient(server.baseUrl),
                goldApiClient = goldApiClient(server.baseUrl)
            )

            val readiness = service.current()

            assertEquals(SystemReadinessStatus.READY, readiness.status)
            assertEquals(ReadinessCheckStatus.PASS, readiness.check("stock-analyst").status)
            assertEquals(ReadinessCheckStatus.PASS, readiness.check("edo-calculator").status)
            assertEquals(ReadinessCheckStatus.INFO, readiness.check("gold-market-data").status)
            assertTrue(readiness.check("stock-analyst").message.contains("PLN=X"))
            assertTrue(readiness.check("edo-calculator").message.contains("2025-01..2025-03"))
        } finally {
            server.close()
        }
    }

    @Test
    fun `readiness includes timeout details for timed out probes`() = runBlocking {
        val server = FakeMarketDataServer(stockAnalystDelayMs = 3_000)
        server.start()

        try {
            val service = SystemReadinessService(
                persistenceConfig = persistenceConfig(),
                backupConfig = backupConfig(),
                marketDataConfig = marketDataConfig(baseUrl = server.baseUrl),
                authConfig = authConfig(),
                clock = fixedClock(),
                stockAnalystClient = stockAnalystClient(server.baseUrl),
                edoCalculatorClient = edoCalculatorClient(server.baseUrl),
                goldApiClient = goldApiClient(server.baseUrl)
            )

            val stockAnalystCheck = service.current().check("stock-analyst")

            assertEquals(ReadinessCheckStatus.WARN, stockAnalystCheck.status)
            assertTrue(stockAnalystCheck.message.contains("timed out after 2500 ms"))
            assertEquals("stock-analyst", stockAnalystCheck.details["upstream"])
            assertEquals("history", stockAnalystCheck.details["operation"])
            assertEquals("PLN=X", stockAnalystCheck.details["symbol"])
            assertEquals("2500", stockAnalystCheck.details["timeoutMs"])
        } finally {
            server.close()
        }
    }

    @Test
    fun `readiness probes dependencies on every evaluation`() = runBlocking {
        val server = FakeMarketDataServer()
        server.start()

        try {
            val service = SystemReadinessService(
                persistenceConfig = persistenceConfig(),
                backupConfig = backupConfig(),
                marketDataConfig = marketDataConfig(baseUrl = server.baseUrl),
                authConfig = authConfig(),
                clock = fixedClock(),
                stockAnalystClient = stockAnalystClient(server.baseUrl),
                edoCalculatorClient = edoCalculatorClient(server.baseUrl),
                goldApiClient = goldApiClient(server.baseUrl)
            )

            service.current()
            service.current()

            assertEquals(2, server.stockAnalystRequestCount)
            assertEquals(2, server.edoCalculatorRequestCount)
        } finally {
            server.close()
        }
    }

    @Test
    fun `local readiness does not call market data upstreams`() {
        val server = FakeMarketDataServer()
        server.start()

        try {
            val service = SystemReadinessService(
                persistenceConfig = persistenceConfig(),
                backupConfig = backupConfig(),
                marketDataConfig = marketDataConfig(baseUrl = server.baseUrl),
                authConfig = authConfig(),
                clock = fixedClock(),
                stockAnalystClient = stockAnalystClient(server.baseUrl),
                edoCalculatorClient = edoCalculatorClient(server.baseUrl),
                goldApiClient = goldApiClient(server.baseUrl)
            )

            val readiness = service.currentLocal()

            assertEquals(SystemReadinessStatus.READY, readiness.status)
            assertEquals(0, server.stockAnalystRequestCount)
            assertEquals(0, server.edoCalculatorRequestCount)
            assertTrue(readiness.checks.none { check -> check.key == "market-data" })
            assertTrue(readiness.checks.none { check -> check.key == "stock-analyst" })
            assertTrue(readiness.checks.none { check -> check.key == "edo-calculator" })
            assertTrue(readiness.checks.none { check -> check.key == "gold-market-data" })
        } finally {
            server.close()
        }
    }

    @Test
    fun `detailed readiness preserves caller cancellation`() {
        val server = FakeMarketDataServer(stockAnalystDelayMs = 1_000)
        server.start()

        try {
            val service = SystemReadinessService(
                persistenceConfig = persistenceConfig(),
                backupConfig = backupConfig(),
                marketDataConfig = marketDataConfig(baseUrl = server.baseUrl),
                authConfig = authConfig(),
                clock = fixedClock(),
                stockAnalystClient = stockAnalystClient(server.baseUrl),
                edoCalculatorClient = edoCalculatorClient(server.baseUrl),
                goldApiClient = goldApiClient(server.baseUrl)
            )

            assertThrows(TimeoutCancellationException::class.java) {
                runBlocking {
                    withTimeout(100) {
                        service.current()
                    }
                }
            }
            assertEquals(0, server.edoCalculatorRequestCount)
        } finally {
            server.close()
        }
    }

    private fun persistenceConfig() = PersistenceConfig(
        databasePath = "./data/test.db",
        journalMode = JournalMode.WAL,
        synchronousMode = SynchronousMode.FULL,
        busyTimeoutMs = 5_000
    )

    private fun backupConfig() = BackupConfig(
        enabled = false,
        directory = "./data/backups",
        intervalMinutes = 1_440,
        retentionCount = 30
    )

    private fun marketDataConfig(baseUrl: String) = MarketDataConfig(
        enabled = true,
        stockAnalystApiUrl = baseUrl,
        edoCalculatorApiUrl = baseUrl,
        goldApiUrl = baseUrl,
        goldApiKey = null,
        usdPlnSymbol = "PLN=X",
        goldBenchmarkSymbol = "GC=F",
        equityBenchmarkSymbol = "VWRA.L",
        bondBenchmarkSymbol = "ETFBTBSP.WA"
    )

    private fun authConfig() = AuthConfig(
        enabled = false,
        password = "",
        sessionSecret = "",
        sessionCookieName = "portfolio_session",
        secureCookie = false,
        sessionMaxAgeDays = 30
    )

    private fun fixedClock(): Clock = Clock.fixed(Instant.parse("2026-03-21T12:00:00Z"), ZoneOffset.UTC)

    private fun stockAnalystClient(baseUrl: String) = StockAnalystClient(
        httpClient = HttpClient.newHttpClient(),
        json = Json,
        baseUrl = baseUrl
    )

    private fun edoCalculatorClient(baseUrl: String) = EdoCalculatorClient(
        httpClient = HttpClient.newHttpClient(),
        json = Json,
        baseUrl = baseUrl
    )

    private fun goldApiClient(baseUrl: String) = GoldApiClient(
        httpClient = HttpClient.newHttpClient(),
        json = Json,
        baseUrl = baseUrl
    )

    private fun SystemReadiness.check(key: String): SystemReadinessCheck =
        checks.first { check -> check.key == key }
}

private class FakeMarketDataServer(
    private val stockAnalystDelayMs: Long = 0
) : AutoCloseable {
    private val stockAnalystRequests = AtomicInteger()
    private val edoCalculatorRequests = AtomicInteger()
    private val server = HttpServer.create(InetSocketAddress(0), 0).apply {
        createContext("/v1/history", HistoryHandler(stockAnalystDelayMs, stockAnalystRequests))
        createContext("/v1/inflation/monthly", InflationHandler(edoCalculatorRequests))
        executor = null
    }

    val baseUrl: String
        get() = "http://127.0.0.1:${server.address.port}"

    val stockAnalystRequestCount: Int
        get() = stockAnalystRequests.get()

    val edoCalculatorRequestCount: Int
        get() = edoCalculatorRequests.get()

    fun start() {
        server.start()
    }

    override fun close() {
        server.stop(0)
    }

    private class HistoryHandler(
        private val stockAnalystDelayMs: Long,
        private val requestCount: AtomicInteger
    ) : HttpHandler {
        override fun handle(exchange: HttpExchange) {
            requestCount.incrementAndGet()
            val path = exchange.requestURI.path
            if (stockAnalystDelayMs > 0 && (path.contains("/v1/history/PLN%3DX") || path.contains("/v1/history/PLN=X"))) {
                Thread.sleep(stockAnalystDelayMs)
            }
            val body = when {
                path.contains("/v1/history/PLN%3DX") || path.contains("/v1/history/PLN=X") ->
                    """{"prices":[{"date":"2025-01-02","close":4.0123},{"date":"2025-01-03","close":4.0088}]}"""
                        .withStockAnalystProvenance()

                else -> """{"prices":[]}""".withStockAnalystProvenance()
            }
            respond(exchange, 200, body)
        }
    }

    private class InflationHandler(
        private val requestCount: AtomicInteger
    ) : HttpHandler {
        override fun handle(exchange: HttpExchange) {
            requestCount.incrementAndGet()
            val body =
                """{"from":"2025-01","until":"2025-03","points":[{"month":"2025-01","multiplier":"1.0120"},{"month":"2025-02","multiplier":"1.0080"}]}"""
            respond(exchange, 200, body)
        }
    }
}

private fun respond(exchange: HttpExchange, status: Int, body: String) {
    val bytes = body.toByteArray(StandardCharsets.UTF_8)
    exchange.responseHeaders.add("Content-Type", "application/json")
    exchange.sendResponseHeaders(status, bytes.size.toLong())
    exchange.responseBody.use { output ->
        output.write(bytes)
    }
}
