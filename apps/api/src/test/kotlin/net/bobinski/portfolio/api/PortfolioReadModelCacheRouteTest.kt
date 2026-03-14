package net.bobinski.portfolio.api

import io.ktor.client.request.get
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpStatusCode
import io.ktor.server.testing.testApplication
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class PortfolioReadModelCacheRouteTest {

    @Test
    fun `read model cache lists cached history and returns snapshots`() = testApplication {
        application {
            module()
        }

        val historyResponse = client.get("/v1/portfolio/history/daily")
        val returnsResponse = client.get("/v1/portfolio/returns")
        val cacheResponse = client.get("/v1/portfolio/read-model-cache")

        assertEquals(HttpStatusCode.OK, historyResponse.status)
        assertEquals(HttpStatusCode.OK, returnsResponse.status)
        assertEquals(HttpStatusCode.OK, cacheResponse.status)
        assertTrue(cacheResponse.bodyAsText().contains("\"cacheKey\": \"portfolio.daily-history\""))
        assertTrue(cacheResponse.bodyAsText().contains("\"cacheKey\": \"portfolio.returns\""))
        assertTrue(cacheResponse.bodyAsText().contains("\"invalidationReason\": \"CACHE_MISS\""))
    }
}
