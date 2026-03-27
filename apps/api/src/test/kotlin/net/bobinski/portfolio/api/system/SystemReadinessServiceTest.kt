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
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import net.bobinski.portfolio.api.auth.config.AuthConfig
import net.bobinski.portfolio.api.backup.config.BackupConfig
import net.bobinski.portfolio.api.marketdata.client.EdoCalculatorClient
import net.bobinski.portfolio.api.marketdata.client.GoldApiClient
import net.bobinski.portfolio.api.marketdata.client.StockAnalystClient
import net.bobinski.portfolio.api.marketdata.config.MarketDataConfig
import net.bobinski.portfolio.api.persistence.config.JournalMode
import net.bobinski.portfolio.api.persistence.config.PersistenceConfig
import net.bobinski.portfolio.api.persistence.config.SynchronousMode
import org.junit.jupiter.api.Assertions.assertEquals
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

private class FakeMarketDataServer : AutoCloseable {
    private val server = HttpServer.create(InetSocketAddress(0), 0).apply {
        createContext("/history", HistoryHandler)
        createContext("/inflation/monthly", InflationHandler)
        executor = null
    }

    val baseUrl: String
        get() = "http://127.0.0.1:${server.address.port}"

    fun start() {
        server.start()
    }

    override fun close() {
        server.stop(0)
    }

    private object HistoryHandler : HttpHandler {
        override fun handle(exchange: HttpExchange) {
            val path = exchange.requestURI.path
            val body = when {
                path.contains("/history/PLN%3DX") || path.contains("/history/PLN=X") ->
                    """{"prices":[{"date":"2025-01-02","close":4.0123},{"date":"2025-01-03","close":4.0088}]}"""

                else -> """{"prices":[]}"""
            }
            respond(exchange, 200, body)
        }
    }

    private object InflationHandler : HttpHandler {
        override fun handle(exchange: HttpExchange) {
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
