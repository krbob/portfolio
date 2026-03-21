package net.bobinski.portfolio.api.marketdata.service

import com.sun.net.httpserver.HttpExchange
import com.sun.net.httpserver.HttpHandler
import com.sun.net.httpserver.HttpServer
import java.math.BigDecimal
import java.net.InetSocketAddress
import java.net.http.HttpClient
import java.time.LocalDate
import kotlinx.coroutines.runBlocking
import net.bobinski.portfolio.api.config.AppJsonFactory
import net.bobinski.portfolio.api.marketdata.client.GoldApiClient
import net.bobinski.portfolio.api.marketdata.client.StockAnalystClient
import net.bobinski.portfolio.api.marketdata.config.MarketDataConfig
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class RemoteReferenceSeriesProviderTest {

    @Test
    fun `gold series falls back to configured benchmark when spot history is unavailable`() = runBlocking {
        val server = FakeReferenceSeriesServer()
        server.start()

        try {
            val provider = RemoteReferenceSeriesProvider(
                config = MarketDataConfig(
                    enabled = true,
                    stockAnalystBaseUrl = server.baseUrl,
                    edoCalculatorBaseUrl = "http://127.0.0.1:9",
                    goldApiBaseUrl = server.baseUrl,
                    goldApiKey = "gold-key",
                    usdPlnSymbol = "USDPLN=X",
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
                )
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
}

private class FakeReferenceSeriesServer : AutoCloseable {
    private val server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0).apply {
        createContext("/history", HistoryHandler)
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
            val body = when {
                exchange.requestURI.path == "/history" ->
                    """{"error":"Rate limit exceeded. Maximum 10 requests per hour."}"""

                exchange.requestURI.path.contains("/history/GC%3DF") || exchange.requestURI.path.contains("/history/GC=F") ->
                    """{"prices":[{"date":"2026-03-19","close":12000.0},{"date":"2026-03-20","close":12100.0}]}"""

                exchange.requestURI.path.contains("/history/USDPLN%3DX") || exchange.requestURI.path.contains("/history/USDPLN=X") ->
                    """{"prices":[{"date":"2026-03-19","close":3.85},{"date":"2026-03-20","close":3.86}]}"""

                else -> """{"prices":[]}"""
            }
            respond(exchange, body)
        }
    }
}

private fun respond(exchange: HttpExchange, body: String) {
    val bytes = body.toByteArray()
    exchange.responseHeaders.add("Content-Type", "application/json")
    exchange.sendResponseHeaders(200, bytes.size.toLong())
    exchange.responseBody.use { output ->
        output.write(bytes)
    }
}
