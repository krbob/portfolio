package net.bobinski.portfolio.api.marketdata.client

import com.sun.net.httpserver.HttpServer
import kotlinx.coroutines.runBlocking
import net.bobinski.portfolio.api.config.AppJsonFactory
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import java.math.BigDecimal
import java.net.InetSocketAddress
import java.net.http.HttpClient
import java.time.LocalDate
import java.util.concurrent.atomic.AtomicReference

class GoldApiClientTest {

    @Test
    fun `historyUsd parses day buckets and sends api key`() = runBlocking {
        val requestPath = AtomicReference<String>()
        val apiKeyHeader = AtomicReference<String?>()
        val responseBody = """
            [
              {"day":"2026-03-19","avg_price":3025.15},
              {"day":"2026-03-20","avg_price":3031.40}
            ]
        """.trimIndent()
        val server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        server.createContext("/history") { exchange ->
            requestPath.set(exchange.requestURI.toString())
            apiKeyHeader.set(exchange.requestHeaders.getFirst("x-api-key"))
            val bytes = responseBody.toByteArray()
            exchange.sendResponseHeaders(200, bytes.size.toLong())
            exchange.responseBody.use { it.write(bytes) }
        }
        server.start()

        try {
            val client = GoldApiClient(
                httpClient = HttpClient.newBuilder().build(),
                json = AppJsonFactory.create(),
                baseUrl = "http://127.0.0.1:${server.address.port}"
            )

            val points = client.historyUsd(
                apiKey = "test-key",
                from = LocalDate.parse("2026-03-19"),
                to = LocalDate.parse("2026-03-20")
            )

            assertEquals("test-key", apiKeyHeader.get())
            assertEquals(
                "/history?symbol=XAU&groupBy=day&aggregation=avg&orderBy=asc&startTimestamp=1773878400&endTimestamp=1774051199",
                requestPath.get()
            )
            assertEquals(2, points.size)
            assertEquals(LocalDate.parse("2026-03-19"), points[0].date)
            assertEquals(BigDecimal("3025.15"), points[0].closePriceUsd)
            assertEquals(LocalDate.parse("2026-03-20"), points[1].date)
            assertEquals(BigDecimal("3031.40"), points[1].closePriceUsd)
        } finally {
            server.stop(0)
        }
    }
}
