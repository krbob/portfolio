package net.bobinski.portfolio.api.marketdata.service

import com.sun.net.httpserver.HttpServer
import java.net.InetSocketAddress
import java.net.http.HttpClient
import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.runBlocking
import net.bobinski.portfolio.api.config.AppJsonFactory
import net.bobinski.portfolio.api.domain.model.EdoLotTerms
import net.bobinski.portfolio.api.domain.service.AuditLogService
import net.bobinski.portfolio.api.domain.service.OperationalStateService
import net.bobinski.portfolio.api.marketdata.client.EdoCalculatorClient
import net.bobinski.portfolio.api.marketdata.config.MarketDataConfig
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryAuditEventRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryOperationalStateRepository
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test

class RemoteEdoLotValuationProviderTest {

    @Test
    fun `caller cancellation is propagated from previous close valuation`() {
        val server = startFakeEdoCalculator()

        try {
            val provider = buildProvider(
                port = server.address.port,
                httpClient = SelectiveCancellingHttpClient { request ->
                    request.uri().path == "/v1/edo/value/at"
                }
            )

            assertThrows(CancellationException::class.java) {
                runBlocking {
                    provider.value(
                        EdoLotTerms(
                            purchaseDate = LocalDate.of(2024, 3, 15),
                            firstPeriodRateBps = 650,
                            marginBps = 200
                        )
                    )
                }
            }
        } finally {
            server.stop(0)
        }
    }

    private fun buildProvider(port: Int, httpClient: HttpClient): RemoteEdoLotValuationProvider {
        val clock = Clock.fixed(Instant.parse("2026-07-13T12:00:00Z"), ZoneOffset.UTC)
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
        val baseUrl = "http://127.0.0.1:$port"
        return RemoteEdoLotValuationProvider(
            config = MarketDataConfig(
                enabled = true,
                stockAnalystApiUrl = "http://127.0.0.1:1",
                edoCalculatorApiUrl = baseUrl,
                goldApiUrl = "http://127.0.0.1:1",
                goldApiKey = null,
                usdPlnSymbol = "PLN=X",
                goldBenchmarkSymbol = "GC=F",
                equityBenchmarkSymbol = "VWRA.L",
                bondBenchmarkSymbol = "VAGF.DE"
            ),
            edoCalculatorClient = EdoCalculatorClient(
                httpClient = httpClient,
                json = json,
                baseUrl = baseUrl
            ),
            marketDataFailureAuditService = MarketDataFailureAuditService(auditLogService),
            snapshotCacheService = MarketDataSnapshotCacheService(operationalStateService, clock)
        )
    }

    private fun startFakeEdoCalculator(): HttpServer {
        val server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        server.createContext("/v1/edo/value") { exchange ->
            val bytes = CURRENT_VALUE_RESPONSE.toByteArray()
            exchange.responseHeaders.add("Content-Type", "application/json")
            exchange.sendResponseHeaders(200, bytes.size.toLong())
            exchange.responseBody.use { it.write(bytes) }
        }
        server.start()
        return server
    }

    private companion object {
        val CURRENT_VALUE_RESPONSE =
            """
            {
              "purchaseDate": "2024-03-15",
              "asOf": "2026-07-13",
              "firstPeriodRate": "6.50",
              "margin": "2.00",
              "principal": "100.00",
              "edoValue": {
                "totalValue": "117.42",
                "periods": []
              }
            }
            """.trimIndent()
    }
}
