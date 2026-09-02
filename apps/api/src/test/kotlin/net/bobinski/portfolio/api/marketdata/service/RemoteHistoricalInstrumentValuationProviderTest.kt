package net.bobinski.portfolio.api.marketdata.service

import com.sun.net.httpserver.HttpExchange
import com.sun.net.httpserver.HttpServer
import java.math.BigDecimal
import java.net.InetSocketAddress
import java.net.http.HttpClient
import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import java.util.UUID
import kotlinx.coroutines.runBlocking
import net.bobinski.portfolio.api.config.AppJsonFactory
import net.bobinski.portfolio.api.domain.model.AssetClass
import net.bobinski.portfolio.api.domain.model.Instrument
import net.bobinski.portfolio.api.domain.model.InstrumentKind
import net.bobinski.portfolio.api.domain.model.ValuationSource
import net.bobinski.portfolio.api.domain.service.AuditLogService
import net.bobinski.portfolio.api.domain.service.OperationalStateService
import net.bobinski.portfolio.api.marketdata.client.StockAnalystClient
import net.bobinski.portfolio.api.marketdata.config.MarketDataConfig
import net.bobinski.portfolio.api.marketdata.model.HistoricalPricePoint
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryAuditEventRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryOperationalStateRepository
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class RemoteHistoricalInstrumentValuationProviderTest {
    @Test
    fun `upstream failure does not expose an implausible cached history`() = runBlocking {
        val snapshotCacheService = snapshotCacheService()
        snapshotCacheService.putSeries(
            identity = "stock-history:VWRA.L",
            from = LocalDate.parse("2026-08-28"),
            to = LocalDate.parse("2026-09-01"),
            prices = poisonedPrices()
        )
        val server = failingServer()
        server.start()

        try {
            val result = provider(
                baseUrl = "http://127.0.0.1:${server.address.port}",
                snapshotCacheService = snapshotCacheService
            ).dailyPriceSeries(
                instrument = vwraInstrument(),
                from = LocalDate.parse("2026-08-28"),
                to = LocalDate.parse("2026-09-01")
            )

            assertTrue(result is HistoricalInstrumentValuationResult.Failure)
        } finally {
            server.stop(0)
        }
    }

    private fun provider(
        baseUrl: String,
        snapshotCacheService: MarketDataSnapshotCacheService
    ): RemoteHistoricalInstrumentValuationProvider {
        val clock = Clock.fixed(Instant.parse("2026-09-02T08:00:00Z"), ZoneOffset.UTC)
        return RemoteHistoricalInstrumentValuationProvider(
            config = marketDataConfig(baseUrl),
            stockAnalystClient = StockAnalystClient(
                httpClient = HttpClient.newHttpClient(),
                json = AppJsonFactory.create(),
                baseUrl = baseUrl
            ),
            marketDataFailureAuditService = MarketDataFailureAuditService(
                AuditLogService(
                    auditEventRepository = InMemoryAuditEventRepository(),
                    clock = clock
                )
            ),
            snapshotCacheService = snapshotCacheService
        )
    }

    private fun snapshotCacheService(): MarketDataSnapshotCacheService {
        val clock = Clock.fixed(Instant.parse("2026-09-02T08:00:00Z"), ZoneOffset.UTC)
        return MarketDataSnapshotCacheService(
            operationalStateService = OperationalStateService(
                repository = InMemoryOperationalStateRepository(),
                json = AppJsonFactory.create(),
                clock = clock
            ),
            clock = clock
        )
    }

    private fun marketDataConfig(baseUrl: String) = MarketDataConfig(
        enabled = true,
        stockAnalystApiUrl = baseUrl,
        edoCalculatorApiUrl = "http://127.0.0.1:9",
        goldApiUrl = "http://127.0.0.1:9",
        goldApiKey = null,
        usdPlnSymbol = "PLN=X",
        goldBenchmarkSymbol = "GC=F",
        equityBenchmarkSymbol = "VWRA.L",
        bondBenchmarkSymbol = "ETFBTBSP.WA"
    )

    private fun vwraInstrument() = Instrument(
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

    private fun poisonedPrices() = listOf(
        HistoricalPricePoint(LocalDate.parse("2026-08-28"), BigDecimal("719.84")),
        HistoricalPricePoint(LocalDate.parse("2026-09-01"), BigDecimal("7.12"))
    )

    private fun failingServer(): HttpServer = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0).apply {
        createContext("/") { exchange ->
            exchange.respondJson("""{"error":"Service unavailable"}""", status = 503)
        }
        executor = null
    }

    private fun HttpExchange.respondJson(body: String, status: Int) {
        val bytes = body.toByteArray()
        responseHeaders.add("Content-Type", "application/json")
        sendResponseHeaders(status, bytes.size.toLong())
        responseBody.use { output -> output.write(bytes) }
    }
}
