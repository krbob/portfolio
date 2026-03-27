package net.bobinski.portfolio.api.marketdata.service

import com.sun.net.httpserver.HttpExchange
import com.sun.net.httpserver.HttpHandler
import com.sun.net.httpserver.HttpServer
import java.math.BigDecimal
import java.net.InetSocketAddress
import java.net.http.HttpClient
import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import kotlinx.coroutines.runBlocking
import net.bobinski.portfolio.api.config.AppJsonFactory
import net.bobinski.portfolio.api.domain.model.AuditEventCategory
import net.bobinski.portfolio.api.domain.model.AuditEventOutcome
import net.bobinski.portfolio.api.domain.service.AppPreferenceService
import net.bobinski.portfolio.api.domain.service.AuditLogService
import net.bobinski.portfolio.api.marketdata.client.GoldApiClient
import net.bobinski.portfolio.api.marketdata.client.StockAnalystClient
import net.bobinski.portfolio.api.marketdata.config.MarketDataConfig
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryAuditEventRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryAppPreferenceRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class RemoteReferenceSeriesProviderTest {

    @Test
    fun `gold series falls back to configured benchmark when spot history is unavailable`() = runBlocking {
        val server = FakeReferenceSeriesServer()
        server.start()

        try {
            val auditEventRepository = InMemoryAuditEventRepository()
            val appPreferenceService = AppPreferenceService(
                repository = InMemoryAppPreferenceRepository(),
                json = AppJsonFactory.create(),
                clock = Clock.fixed(Instant.parse("2026-03-26T12:00:00Z"), ZoneOffset.UTC)
            )
            val provider = RemoteReferenceSeriesProvider(
                config = MarketDataConfig(
                    enabled = true,
                    stockAnalystBaseUrl = server.baseUrl,
                    edoCalculatorBaseUrl = "http://127.0.0.1:9",
                    goldApiBaseUrl = server.baseUrl,
                    goldApiKey = "gold-key",
                    usdPlnSymbol = "PLN=X",
                    goldBenchmarkSymbol = "GC=F",
                    equityBenchmarkSymbol = "VWRA.L",
                    bondBenchmarkSymbol = "ETFBTBSP.WA"
                ),
                stockAnalystClient = StockAnalystClient(
                    httpClient = HttpClient.newHttpClient(),
                    json = AppJsonFactory.create(),
                    baseUrl = server.baseUrl
                ),
                goldApiClient = GoldApiClient(
                    httpClient = HttpClient.newHttpClient(),
                    json = AppJsonFactory.create(),
                    baseUrl = server.baseUrl
                ),
                marketDataFailureAuditService = MarketDataFailureAuditService(
                    auditLogService = AuditLogService(
                        auditEventRepository = auditEventRepository,
                        clock = Clock.fixed(Instant.parse("2026-03-26T12:00:00Z"), ZoneOffset.UTC)
                    )
                ),
                snapshotCacheService = MarketDataSnapshotCacheService(appPreferenceService = appPreferenceService)
            )

            val result = provider.goldPln(
                from = LocalDate.parse("2026-03-19"),
                to = LocalDate.parse("2026-03-20")
            )

            assertTrue(result is ReferenceSeriesResult.Success)
            result as ReferenceSeriesResult.Success
            assertEquals(2, result.prices.size)
            assertEquals(LocalDate.parse("2026-03-19"), result.prices[0].date)
            assertEquals(BigDecimal("12000.0"), result.prices[0].closePricePln)
            assertEquals(LocalDate.parse("2026-03-20"), result.prices[1].date)
            assertEquals(BigDecimal("12100.0"), result.prices[1].closePricePln)
        } finally {
            server.close()
        }
    }

    @Test
    fun `reference series failures are recorded in operational audit with upstream details`() = runBlocking {
        val server = FakeReferenceSeriesServer(failUsdHistory = true)
        server.start()

        try {
            val auditEventRepository = InMemoryAuditEventRepository()
            val appPreferenceService = AppPreferenceService(
                repository = InMemoryAppPreferenceRepository(),
                json = AppJsonFactory.create(),
                clock = Clock.fixed(Instant.parse("2026-03-26T12:30:00Z"), ZoneOffset.UTC)
            )
            val provider = RemoteReferenceSeriesProvider(
                config = MarketDataConfig(
                    enabled = true,
                    stockAnalystBaseUrl = server.baseUrl,
                    edoCalculatorBaseUrl = "http://127.0.0.1:9",
                    goldApiBaseUrl = server.baseUrl,
                    goldApiKey = null,
                    usdPlnSymbol = "PLN=X",
                    goldBenchmarkSymbol = "GC=F",
                    equityBenchmarkSymbol = "VWRA.L",
                    bondBenchmarkSymbol = "ETFBTBSP.WA"
                ),
                stockAnalystClient = StockAnalystClient(
                    httpClient = HttpClient.newHttpClient(),
                    json = AppJsonFactory.create(),
                    baseUrl = server.baseUrl
                ),
                goldApiClient = GoldApiClient(
                    httpClient = HttpClient.newHttpClient(),
                    json = AppJsonFactory.create(),
                    baseUrl = server.baseUrl
                ),
                marketDataFailureAuditService = MarketDataFailureAuditService(
                    auditLogService = AuditLogService(
                        auditEventRepository = auditEventRepository,
                        clock = Clock.fixed(Instant.parse("2026-03-26T12:30:00Z"), ZoneOffset.UTC)
                    )
                ),
                snapshotCacheService = MarketDataSnapshotCacheService(appPreferenceService = appPreferenceService)
            )

            val result = provider.usdPln(
                from = LocalDate.parse("2026-03-19"),
                to = LocalDate.parse("2026-03-20")
            )

            assertTrue(result is ReferenceSeriesResult.Failure)

            val events = auditEventRepository.list()
            assertEquals(1, events.size)
            val event = events.single()
            assertEquals(AuditEventCategory.SYSTEM, event.category)
            assertEquals(AuditEventOutcome.FAILURE, event.outcome)
            assertEquals("MARKET_DATA_REQUEST_FAILED", event.action)
            assertEquals("stock-analyst", event.metadata["upstream"])
            assertEquals("reference-history", event.metadata["operation"])
            assertEquals("PLN=X", event.metadata["symbol"])
            assertEquals("429", event.metadata["statusCode"])
            assertTrue(event.metadata["responseBodyPreview"]!!.contains("Too many requests"))
        } finally {
            server.close()
        }
    }

    @Test
    fun `reference series falls back to cached snapshot when upstream later fails`() = runBlocking {
        val cacheClock = Clock.fixed(Instant.parse("2026-03-27T13:00:00Z"), ZoneOffset.UTC)
        val appPreferenceService = AppPreferenceService(
            repository = InMemoryAppPreferenceRepository(),
            json = AppJsonFactory.create(),
            clock = cacheClock
        )
        val snapshotCacheService = MarketDataSnapshotCacheService(appPreferenceService = appPreferenceService)

        val successServer = FakeReferenceSeriesServer()
        successServer.start()

        try {
            val warmProvider = RemoteReferenceSeriesProvider(
                config = MarketDataConfig(
                    enabled = true,
                    stockAnalystBaseUrl = successServer.baseUrl,
                    edoCalculatorBaseUrl = "http://127.0.0.1:9",
                    goldApiBaseUrl = successServer.baseUrl,
                    goldApiKey = null,
                    usdPlnSymbol = "PLN=X",
                    goldBenchmarkSymbol = "GC=F",
                    equityBenchmarkSymbol = "VWRA.L",
                    bondBenchmarkSymbol = "ETFBTBSP.WA"
                ),
                stockAnalystClient = StockAnalystClient(
                    httpClient = HttpClient.newHttpClient(),
                    json = AppJsonFactory.create(),
                    baseUrl = successServer.baseUrl
                ),
                goldApiClient = GoldApiClient(
                    httpClient = HttpClient.newHttpClient(),
                    json = AppJsonFactory.create(),
                    baseUrl = successServer.baseUrl
                ),
                marketDataFailureAuditService = MarketDataFailureAuditService(
                    auditLogService = AuditLogService(
                        auditEventRepository = InMemoryAuditEventRepository(),
                        clock = cacheClock
                    )
                ),
                snapshotCacheService = snapshotCacheService
            )

            val warmResult = warmProvider.usdPln(
                from = LocalDate.parse("2026-03-19"),
                to = LocalDate.parse("2026-03-20")
            )

            assertTrue(warmResult is ReferenceSeriesResult.Success)
        } finally {
            successServer.close()
        }

        val failingServer = FakeReferenceSeriesServer(failUsdHistory = true)
        failingServer.start()

        try {
            val fallbackProvider = RemoteReferenceSeriesProvider(
                config = MarketDataConfig(
                    enabled = true,
                    stockAnalystBaseUrl = failingServer.baseUrl,
                    edoCalculatorBaseUrl = "http://127.0.0.1:9",
                    goldApiBaseUrl = failingServer.baseUrl,
                    goldApiKey = null,
                    usdPlnSymbol = "PLN=X",
                    goldBenchmarkSymbol = "GC=F",
                    equityBenchmarkSymbol = "VWRA.L",
                    bondBenchmarkSymbol = "ETFBTBSP.WA"
                ),
                stockAnalystClient = StockAnalystClient(
                    httpClient = HttpClient.newHttpClient(),
                    json = AppJsonFactory.create(),
                    baseUrl = failingServer.baseUrl
                ),
                goldApiClient = GoldApiClient(
                    httpClient = HttpClient.newHttpClient(),
                    json = AppJsonFactory.create(),
                    baseUrl = failingServer.baseUrl
                ),
                marketDataFailureAuditService = MarketDataFailureAuditService(
                    auditLogService = AuditLogService(
                        auditEventRepository = InMemoryAuditEventRepository(),
                        clock = cacheClock
                    )
                ),
                snapshotCacheService = snapshotCacheService
            )

            val result = fallbackProvider.usdPln(
                from = LocalDate.parse("2026-03-19"),
                to = LocalDate.parse("2026-03-20")
            )

            assertTrue(result is ReferenceSeriesResult.Success)
            result as ReferenceSeriesResult.Success
            assertTrue(result.fromCache)
            assertEquals(2, result.prices.size)
            assertEquals(LocalDate.parse("2026-03-19"), result.prices[0].date)
            assertEquals(BigDecimal("3.85"), result.prices[0].closePricePln)
        } finally {
            failingServer.close()
        }
    }
}

private class FakeReferenceSeriesServer(
    private val failUsdHistory: Boolean = false
) : AutoCloseable {
    private val server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0).apply {
        createContext("/history", HistoryHandler(failUsdHistory))
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

    private class HistoryHandler(
        private val failUsdHistory: Boolean
    ) : HttpHandler {
        override fun handle(exchange: HttpExchange) {
            val path = exchange.requestURI.path
            when {
                path == "/history" -> {
                    respond(exchange, """{"error":"Rate limit exceeded. Maximum 10 requests per hour."}""", status = 429)
                    return
                }

                failUsdHistory && (path.contains("/history/PLN%3DX") || path.contains("/history/PLN=X")) -> {
                    respond(exchange, """{"error":"Too many requests","retryAfterSeconds":60}""", status = 429)
                    return
                }

                path.contains("/history/GC%3DF") || path.contains("/history/GC=F") ->
                    respond(exchange, """{"prices":[{"date":"2026-03-19","close":12000.0},{"date":"2026-03-20","close":12100.0}]}""")

                path.contains("/history/PLN%3DX") || path.contains("/history/PLN=X") ->
                    respond(exchange, """{"prices":[{"date":"2026-03-19","close":3.85},{"date":"2026-03-20","close":3.86}]}""")

                else -> respond(exchange, """{"prices":[]}""")
            }
        }
    }
}

private fun respond(exchange: HttpExchange, body: String, status: Int = 200) {
    val bytes = body.toByteArray()
    exchange.responseHeaders.add("Content-Type", "application/json")
    exchange.sendResponseHeaders(status, bytes.size.toLong())
    exchange.responseBody.use { output ->
        output.write(bytes)
    }
}
