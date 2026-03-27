package net.bobinski.portfolio.api.marketdata.service

import com.sun.net.httpserver.HttpServer
import java.net.InetSocketAddress
import java.net.http.HttpClient
import kotlinx.coroutines.runBlocking
import net.bobinski.portfolio.api.config.AppJsonFactory
import net.bobinski.portfolio.api.marketdata.client.StockAnalystClient
import net.bobinski.portfolio.api.marketdata.config.MarketDataConfig
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertDoesNotThrow
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test

class RemoteValuationProbeServiceTest {

    @Test
    fun `valid symbol passes verification`() = runBlocking {
        val server = startFakeStockAnalyst { exchange ->
            val response = """{"symbol":"VWRA.L","currency":"PLN","date":"2026-03-20","lastPrice":420.5}"""
            exchange.sendResponseHeaders(200, response.toByteArray().size.toLong())
            exchange.responseBody.use { it.write(response.toByteArray()) }
        }

        try {
            val service = buildService(server.address.port)
            assertDoesNotThrow { runBlocking { service.verifyStockAnalystSymbol("VWRA.L") } }
        } finally {
            server.stop(0)
        }
    }

    @Test
    fun `invalid symbol throws descriptive error`() = runBlocking {
        val server = startFakeStockAnalyst { exchange ->
            val response = """{"error":"Not found"}"""
            exchange.sendResponseHeaders(404, response.toByteArray().size.toLong())
            exchange.responseBody.use { it.write(response.toByteArray()) }
        }

        try {
            val service = buildService(server.address.port)
            val exception = assertThrows(IllegalArgumentException::class.java) {
                runBlocking { service.verifyStockAnalystSymbol("VRWA.L") }
            }
            assertEquals(true, exception.message?.contains("VRWA.L"))
            assertEquals(true, exception.message?.contains("could not be verified"))
        } finally {
            server.stop(0)
        }
    }

    @Test
    fun `verification is skipped when market data is disabled`() = runBlocking {
        val config = MarketDataConfig(
            enabled = false,
            stockAnalystBaseUrl = "http://127.0.0.1:1",
            edoCalculatorBaseUrl = "http://127.0.0.1:1",
            goldApiBaseUrl = "http://127.0.0.1:1",
            goldApiKey = null,
            usdPlnSymbol = "PLN=X",
            goldBenchmarkSymbol = "GC=F",
            equityBenchmarkSymbol = "VWRA.L",
            bondBenchmarkSymbol = "VAGF.DE"
        )
        val client = StockAnalystClient(
            httpClient = HttpClient.newBuilder().build(),
            json = AppJsonFactory.create(),
            baseUrl = "http://127.0.0.1:1"
        )
        val service = RemoteValuationProbeService(config, client)

        assertDoesNotThrow { runBlocking { service.verifyStockAnalystSymbol("ANYTHING") } }
    }

    @Test
    fun `unreachable service throws descriptive error`() = runBlocking {
        val config = MarketDataConfig(
            enabled = true,
            stockAnalystBaseUrl = "http://127.0.0.1:1",
            edoCalculatorBaseUrl = "http://127.0.0.1:1",
            goldApiBaseUrl = "http://127.0.0.1:1",
            goldApiKey = null,
            usdPlnSymbol = "PLN=X",
            goldBenchmarkSymbol = "GC=F",
            equityBenchmarkSymbol = "VWRA.L",
            bondBenchmarkSymbol = "VAGF.DE"
        )
        val client = StockAnalystClient(
            httpClient = HttpClient.newBuilder().build(),
            json = AppJsonFactory.create(),
            baseUrl = "http://127.0.0.1:1"
        )
        val service = RemoteValuationProbeService(config, client)

        val exception = assertThrows(IllegalArgumentException::class.java) {
            runBlocking { service.verifyStockAnalystSymbol("VWRA.L") }
        }
        assertEquals(true, exception.message?.contains("Could not reach"))
    }

    private fun buildService(port: Int): RemoteValuationProbeService {
        val config = MarketDataConfig(
            enabled = true,
            stockAnalystBaseUrl = "http://127.0.0.1:$port",
            edoCalculatorBaseUrl = "http://127.0.0.1:1",
            goldApiBaseUrl = "http://127.0.0.1:1",
            goldApiKey = null,
            usdPlnSymbol = "PLN=X",
            goldBenchmarkSymbol = "GC=F",
            equityBenchmarkSymbol = "VWRA.L",
            bondBenchmarkSymbol = "VAGF.DE"
        )
        val client = StockAnalystClient(
            httpClient = HttpClient.newBuilder().build(),
            json = AppJsonFactory.create(),
            baseUrl = "http://127.0.0.1:$port"
        )
        return RemoteValuationProbeService(config, client)
    }

    private fun startFakeStockAnalyst(handler: (com.sun.net.httpserver.HttpExchange) -> Unit): HttpServer {
        val server = HttpServer.create(InetSocketAddress(0), 0)
        server.createContext("/") { exchange ->
            handler(exchange)
        }
        server.start()
        return server
    }
}
