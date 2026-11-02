package net.bobinski.portfolio.api

import com.sun.net.httpserver.HttpServer
import io.ktor.client.request.get
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpStatusCode
import io.ktor.server.config.MapApplicationConfig
import io.ktor.server.testing.testApplication
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import net.bobinski.portfolio.api.marketdata.model.EdoSeriesCatalogResponse
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.net.InetSocketAddress

class EdoSeriesCatalogRouteTest {
    @Test
    fun `catalog route uses configured provider and returns converted terms`() {
        val server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        var requests = 0
        server.createContext("/v1/edo/series") { exchange ->
            requests++
            val bytes = """{"updatedAt":"2026-11-02","series":[{
                "code":"EDO1135","saleStart":"2025-11-01","saleEnd":"2025-11-30",
                "firstPeriodRate":"5.75","margin":"2.00","verifiedAt":"2026-11-02",
                "sourceUrl":"https://www.obligacjeskarbowe.pl/"}]}""".toByteArray()
            exchange.sendResponseHeaders(200, bytes.size.toLong())
            exchange.responseBody.use { it.write(bytes) }
        }
        server.start()
        try {
            testApplication {
                environment {
                    config = MapApplicationConfig(
                        "portfolio.marketData.enabled" to "true",
                        "portfolio.marketData.edoCalculatorApiUrl" to "http://127.0.0.1:${server.address.port}"
                    )
                }
                application { module() }
                val response = client.get("/v1/instruments/edo-series")
                assertEquals(HttpStatusCode.OK, response.status)
                val catalog = Json.decodeFromString<EdoSeriesCatalogResponse>(response.bodyAsText())
                assertEquals(575, catalog.series.single().firstPeriodRateBps)
                assertEquals("2025-11", catalog.series.single().seriesMonth)
                assertEquals(HttpStatusCode.OK, client.get("/v1/instruments/edo-series").status)
                assertEquals(1, requests)
            }
        } finally {
            server.stop(0)
        }
    }

    @Test
    fun `disabled catalog returns a retryable error without blocking instrument reads`() = testApplication {
        application { module() }
        val response = client.get("/v1/instruments/edo-series")
        assertEquals(HttpStatusCode.ServiceUnavailable, response.status)
        val error = Json.parseToJsonElement(response.bodyAsText()).jsonObject
        assertEquals("EDO_CATALOG_UNAVAILABLE", error.getValue("errorCode").jsonPrimitive.content)
        assertEquals("true", error.getValue("retryable").jsonPrimitive.content)
        assertTrue(error.getValue("requestId").jsonPrimitive.content.isNotBlank())
        assertEquals(HttpStatusCode.OK, client.get("/v1/instruments").status)
    }
}
