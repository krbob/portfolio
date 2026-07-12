package net.bobinski.portfolio.api.marketdata.service

import com.sun.net.httpserver.HttpExchange
import com.sun.net.httpserver.HttpServer
import java.math.BigDecimal
import java.net.InetSocketAddress
import java.net.http.HttpClient
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import java.util.UUID
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.runBlocking
import net.bobinski.portfolio.api.config.AppJsonFactory
import net.bobinski.portfolio.api.domain.model.AssetClass
import net.bobinski.portfolio.api.domain.model.Instrument
import net.bobinski.portfolio.api.domain.model.InstrumentKind
import net.bobinski.portfolio.api.domain.model.ValuationSource
import net.bobinski.portfolio.api.domain.service.AuditLogService
import net.bobinski.portfolio.api.domain.service.OperationalStateService
import net.bobinski.portfolio.api.marketdata.client.StockAnalystClient
import net.bobinski.portfolio.api.marketdata.client.withStockAnalystProvenance
import net.bobinski.portfolio.api.marketdata.config.MarketDataConfig
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryAuditEventRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryOperationalStateRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test

class RemoteCurrentInstrumentValuationProviderTest {

    @Test
    fun `stock quote omits previous close when quote date has no trading-day history point`() = runBlocking {
        val server = startFakeStockAnalyst(historyPricesJson = "[]")

        try {
            val service = buildService(server.address.port)

            val result = service.value(vwraInstrument()) as InstrumentValuationResult.Success

            assertEquals(BigDecimal("661.95"), result.valuation.pricePerUnitPln)
            assertEquals(BigDecimal("181.9700"), result.valuation.pricePerUnitNative)
            assertEquals("2026-05-04", result.valuation.valuedAt.toString())
            assertNull(result.valuation.previousClosePln)
        } finally {
            server.stop(0)
        }
    }

    @Test
    fun `stock quote keeps previous close when quote date has a trading-day history point`() = runBlocking {
        val server = startFakeStockAnalyst(
            historyPricesJson = """
                [
                  {"date":"2026-05-04","open":660.0,"close":661.95,"low":657.0,"high":662.0,"volume":1000,"dividend":0.0}
                ]
            """.trimIndent()
        )

        try {
            val service = buildService(server.address.port)

            val result = service.value(vwraInstrument()) as InstrumentValuationResult.Success

            assertEquals(BigDecimal("661.95"), result.valuation.pricePerUnitPln)
            assertEquals(BigDecimal("657.06"), result.valuation.previousClosePln)
        } finally {
            server.stop(0)
        }
    }

    @Test
    fun `caller cancellation is propagated from trading day verification`() {
        val server = startFakeStockAnalyst(historyPricesJson = "[]")

        try {
            val service = buildService(
                port = server.address.port,
                httpClient = SelectiveCancellingHttpClient { request ->
                    request.uri().path.startsWith("/v1/history/")
                }
            )

            assertThrows(CancellationException::class.java) {
                runBlocking { service.value(vwraInstrument()) }
            }
        } finally {
            server.stop(0)
        }
    }

    private fun buildService(
        port: Int,
        httpClient: HttpClient = HttpClient.newBuilder().build()
    ): RemoteCurrentInstrumentValuationProvider {
        val clock = Clock.fixed(Instant.parse("2026-05-04T21:10:00Z"), ZoneOffset.UTC)
        val json = AppJsonFactory.create()
        val operationalStateService = OperationalStateService(
            repository = InMemoryOperationalStateRepository(),
            json = json,
            clock = clock
        )
        val auditLogService = AuditLogService(
            auditEventRepository = InMemoryAuditEventRepository(),
            clock = clock
        )
        val config = MarketDataConfig(
            enabled = true,
            stockAnalystApiUrl = "http://127.0.0.1:$port",
            edoCalculatorApiUrl = "http://127.0.0.1:1",
            goldApiUrl = "http://127.0.0.1:1",
            goldApiKey = null,
            usdPlnSymbol = "PLN=X",
            goldBenchmarkSymbol = "GC=F",
            equityBenchmarkSymbol = "VWRA.L",
            bondBenchmarkSymbol = "VAGF.DE"
        )
        return RemoteCurrentInstrumentValuationProvider(
            config = config,
            stockAnalystClient = StockAnalystClient(
                httpClient = httpClient,
                json = json,
                baseUrl = "http://127.0.0.1:$port"
            ),
            marketDataFailureAuditService = MarketDataFailureAuditService(auditLogService),
            snapshotCacheService = MarketDataSnapshotCacheService(operationalStateService, clock)
        )
    }

    private fun startFakeStockAnalyst(historyPricesJson: String): HttpServer {
        val server = HttpServer.create(InetSocketAddress(0), 0)
        server.createContext("/") { exchange ->
            val path = exchange.requestURI.path
            val query = exchange.requestURI.rawQuery.orEmpty()
            when {
                path == "/v1/quote/VWRA.L" && query.isBlank() -> exchange.respondJson(NATIVE_QUOTE)
                path == "/v1/quote/VWRA.L" && query == "currency=PLN" -> exchange.respondJson(PLN_QUOTE)
                path == "/v1/history/VWRA.L" &&
                    query.contains("currency=PLN") &&
                    query.contains("from=2026-05-04") &&
                    query.contains("to=2026-05-04") ->
                    exchange.respondJson("""{"prices":$historyPricesJson}""".withStockAnalystProvenance())

                else -> exchange.respondJson("""{"error":"unexpected request $path?$query"}""", status = 404)
            }
        }
        server.start()
        return server
    }

    private fun HttpExchange.respondJson(body: String, status: Int = 200) {
        val bytes = body.toByteArray()
        responseHeaders.add("Content-Type", "application/json")
        sendResponseHeaders(status, bytes.size.toLong())
        responseBody.use { it.write(bytes) }
    }

    private fun vwraInstrument(): Instrument = Instrument(
        id = UUID.fromString("90082931-be6f-4407-9400-6213d6b5b783"),
        name = "Vanguard FTSE All-World UCITS ETF",
        kind = InstrumentKind.ETF,
        assetClass = AssetClass.EQUITIES,
        symbol = "VWRA.L",
        currency = "USD",
        valuationSource = ValuationSource.STOCK_ANALYST,
        isActive = true,
        createdAt = Instant.parse("2026-03-01T12:00:00Z"),
        updatedAt = Instant.parse("2026-03-01T12:00:00Z")
    )

    private companion object {
        val NATIVE_QUOTE =
            """{"symbol":"VWRA.L","currency":"USD","date":"2026-05-04","lastPrice":181.97,"previousClose":180.59}"""
                .withStockAnalystProvenance()
        val PLN_QUOTE =
            """{"symbol":"VWRA.L","currency":"PLN","date":"2026-05-04","lastPrice":661.95,"previousClose":657.06}"""
                .withStockAnalystProvenance()
    }
}
