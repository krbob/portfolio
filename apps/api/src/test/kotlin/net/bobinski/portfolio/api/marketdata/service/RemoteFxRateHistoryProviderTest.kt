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
import net.bobinski.portfolio.api.domain.service.AppPreferenceService
import net.bobinski.portfolio.api.marketdata.client.StockAnalystClient
import net.bobinski.portfolio.api.marketdata.config.MarketDataConfig
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryAppPreferenceRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class RemoteFxRateHistoryProviderTest {

    @Test
    fun `successful fetch caches FX rates and returns Success`() = runBlocking {
        val server = FakeFxServer()
        server.start()

        try {
            val provider = buildProvider(server.baseUrl)

            val result = provider.dailyRateToPln(
                currency = "USD",
                from = LocalDate.parse("2026-03-19"),
                to = LocalDate.parse("2026-03-20")
            )

            assertTrue(result is FxRateHistoryResult.Success)
            result as FxRateHistoryResult.Success
            assertFalse(result.fromCache)
            assertEquals(2, result.prices.size)
            assertEquals(LocalDate.parse("2026-03-19"), result.prices[0].date)
            assertEquals(BigDecimal("3.85"), result.prices[0].closePricePln)
            assertEquals(LocalDate.parse("2026-03-20"), result.prices[1].date)
            assertEquals(BigDecimal("3.86"), result.prices[1].closePricePln)
        } finally {
            server.close()
        }
    }

    @Test
    fun `failure with cached data returns Success with fromCache true`() = runBlocking {
        val snapshotCacheService = buildSnapshotCacheService()

        val successServer = FakeFxServer()
        successServer.start()

        try {
            val warmProvider = buildProvider(successServer.baseUrl, snapshotCacheService)
            val warmResult = warmProvider.dailyRateToPln(
                currency = "USD",
                from = LocalDate.parse("2026-03-19"),
                to = LocalDate.parse("2026-03-20")
            )
            assertTrue(warmResult is FxRateHistoryResult.Success)
        } finally {
            successServer.close()
        }

        val failServer = FakeFxServer(fail = true)
        failServer.start()

        try {
            val failProvider = buildProvider(failServer.baseUrl, snapshotCacheService)
            val result = failProvider.dailyRateToPln(
                currency = "USD",
                from = LocalDate.parse("2026-03-19"),
                to = LocalDate.parse("2026-03-20")
            )

            assertTrue(result is FxRateHistoryResult.Success)
            result as FxRateHistoryResult.Success
            assertTrue(result.fromCache)
            assertEquals(2, result.prices.size)
            assertEquals(BigDecimal("3.85"), result.prices[0].closePricePln)
        } finally {
            failServer.close()
        }
    }

    @Test
    fun `failure without cached data returns Failure`() = runBlocking {
        val server = FakeFxServer(fail = true)
        server.start()

        try {
            val provider = buildProvider(server.baseUrl)
            val result = provider.dailyRateToPln(
                currency = "USD",
                from = LocalDate.parse("2026-03-19"),
                to = LocalDate.parse("2026-03-20")
            )

            assertTrue(result is FxRateHistoryResult.Failure)
        } finally {
            server.close()
        }
    }

    @Test
    fun `PLN currency returns Success with empty prices without hitting remote`() = runBlocking {
        val provider = buildProvider("http://127.0.0.1:9")
        val result = provider.dailyRateToPln(
            currency = "PLN",
            from = LocalDate.parse("2026-03-19"),
            to = LocalDate.parse("2026-03-20")
        )

        assertTrue(result is FxRateHistoryResult.Success)
        result as FxRateHistoryResult.Success
        assertTrue(result.prices.isEmpty())
        assertFalse(result.fromCache)
    }

    private fun buildSnapshotCacheService(): MarketDataSnapshotCacheService {
        val appPreferenceService = AppPreferenceService(
            repository = InMemoryAppPreferenceRepository(),
            json = AppJsonFactory.create(),
            clock = Clock.fixed(Instant.parse("2026-03-27T12:00:00Z"), ZoneOffset.UTC)
        )
        return MarketDataSnapshotCacheService(appPreferenceService = appPreferenceService)
    }

    private fun buildProvider(
        baseUrl: String,
        snapshotCacheService: MarketDataSnapshotCacheService = buildSnapshotCacheService()
    ): RemoteFxRateHistoryProvider {
        return RemoteFxRateHistoryProvider(
            config = MarketDataConfig(
                enabled = true,
                stockAnalystApiUrl = baseUrl,
                edoCalculatorApiUrl = "http://127.0.0.1:9",
                goldApiUrl = "http://127.0.0.1:9",
                goldApiKey = null,
                usdPlnSymbol = "PLN=X",
                goldBenchmarkSymbol = "GC=F",
                equityBenchmarkSymbol = "VWRA.L",
                bondBenchmarkSymbol = "ETFBTBSP.WA"
            ),
            stockAnalystClient = StockAnalystClient(
                httpClient = HttpClient.newHttpClient(),
                json = AppJsonFactory.create(),
                baseUrl = baseUrl
            ),
            snapshotCacheService = snapshotCacheService
        )
    }
}

private class FakeFxServer(
    private val fail: Boolean = false
) : AutoCloseable {
    private val server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0).apply {
        createContext("/history", FxHistoryHandler(fail))
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

    private class FxHistoryHandler(private val fail: Boolean) : HttpHandler {
        override fun handle(exchange: HttpExchange) {
            if (fail) {
                val body = """{"error":"Service unavailable"}"""
                val bytes = body.toByteArray()
                exchange.responseHeaders.add("Content-Type", "application/json")
                exchange.sendResponseHeaders(503, bytes.size.toLong())
                exchange.responseBody.use { it.write(bytes) }
                return
            }

            val body = """{"prices":[{"date":"2026-03-19","close":3.85},{"date":"2026-03-20","close":3.86}]}"""
            val bytes = body.toByteArray()
            exchange.responseHeaders.add("Content-Type", "application/json")
            exchange.sendResponseHeaders(200, bytes.size.toLong())
            exchange.responseBody.use { it.write(bytes) }
        }
    }
}
