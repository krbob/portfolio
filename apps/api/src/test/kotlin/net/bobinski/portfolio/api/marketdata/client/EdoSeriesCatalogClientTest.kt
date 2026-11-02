package net.bobinski.portfolio.api.marketdata.client

import com.sun.net.httpserver.HttpServer
import kotlinx.coroutines.runBlocking
import net.bobinski.portfolio.api.config.AppJsonFactory
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import java.net.InetSocketAddress
import java.net.http.HttpClient

class EdoSeriesCatalogClientTest {
    private val emission = """
        {"code":"EDO1135","saleStart":"2025-11-01","saleEnd":"2025-11-30",
         "firstPeriodRate":"5.75","margin":"2.00","verifiedAt":"2026-11-02",
         "sourceUrl":"https://www.obligacjeskarbowe.pl/oferta-obligacji/obligacje-10-letnie-edo/edo1135/"}
    """.trimIndent()

    @Test
    fun `catalog converts exact rates and orders emissions newest first`() = runBlocking {
        val older = emission.replace("EDO1135", "EDO1035").replace("2025-11-01", "2025-10-01")
            .replace("2025-11-30", "2025-10-31")
        withCatalog("""{"updatedAt":"2026-11-02","series":[$older,$emission]}""") { client ->
            val result = client.seriesCatalog()
            assertEquals(listOf("EDO1135", "EDO1035"), result.series.map { it.code })
            assertEquals("2025-11", result.series.first().seriesMonth)
            assertEquals(575, result.series.first().firstPeriodRateBps)
            assertEquals(200, result.series.first().marginBps)
            assertFalse(result.stale)
        }
    }

    @Test
    fun `malformed catalogs are rejected as a whole without rounding rates`() = runBlocking {
        val invalidSeries = listOf(
            "", "$emission,$emission",
            emission.replace("5.75", "5.755"),
            emission.replace("5.75", "-1.00"),
            emission.replace("EDO1135", "EDO1136"),
            emission.replace("2025-11-01", "2025-11-02"),
            emission.replace("2025-11-30", "2025-12-01"),
            emission.replace("2026-11-02", "2026-11-03"),
            emission.replace("https://www.obligacjeskarbowe.pl", "https://example.invalid")
        )
        for (series in invalidSeries) {
            withCatalog("""{"updatedAt":"2026-11-02","series":[$series]}""") { client ->
                assertThrows<RuntimeException> { runBlocking { client.seriesCatalog() } }
            }
        }
    }

    private suspend fun withCatalog(body: String, block: suspend (EdoCalculatorClient) -> Unit) {
        val server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        server.createContext("/v1/edo/series") { exchange ->
            val bytes = body.toByteArray()
            exchange.responseHeaders.add("Content-Type", "application/json")
            exchange.sendResponseHeaders(200, bytes.size.toLong())
            exchange.responseBody.use { it.write(bytes) }
        }
        server.start()
        try {
            HttpClient.newHttpClient().use { httpClient ->
                block(EdoCalculatorClient(httpClient, AppJsonFactory.create(), "http://127.0.0.1:${server.address.port}"))
            }
        } finally {
            server.stop(0)
        }
    }
}
