package net.bobinski.portfolio.api

import io.ktor.client.request.get
import io.ktor.client.request.post
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpStatusCode
import io.ktor.server.testing.testApplication
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class PortfolioReadModelCacheRouteTest {

    @Test
    fun `read model refresh exposes scheduler status`() = testApplication {
        application {
            module()
        }

        val response = client.get("/v1/portfolio/read-model-refresh")

        assertEquals(HttpStatusCode.OK, response.status)
        assertTrue(response.bodyAsText().contains("\"schedulerEnabled\": false"))
        assertTrue(response.bodyAsText().contains("\"modelNames\": ["))
        assertTrue(response.bodyAsText().contains("\"DAILY_HISTORY\""))
        assertTrue(response.bodyAsText().contains("\"RETURNS\""))
    }

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

    @Test
    fun `read model cache can be invalidated manually`() = testApplication {
        application {
            module()
        }

        val historyResponse = client.get("/v1/portfolio/history/daily")
        val beforeClearResponse = client.get("/v1/portfolio/read-model-cache")
        val clearResponse = client.post("/v1/portfolio/read-model-cache/invalidate")
        val afterClearResponse = client.get("/v1/portfolio/read-model-cache")
        val auditResponse = client.get("/v1/portfolio/audit/events?category=SYSTEM")

        assertEquals(HttpStatusCode.OK, historyResponse.status)
        assertEquals(HttpStatusCode.OK, beforeClearResponse.status)
        assertTrue(beforeClearResponse.bodyAsText().contains("\"cacheKey\": \"portfolio.daily-history\""))

        assertEquals(HttpStatusCode.OK, clearResponse.status)
        assertTrue(clearResponse.bodyAsText().contains("\"clearedSnapshotCount\": 1"))

        assertEquals(HttpStatusCode.OK, afterClearResponse.status)
        assertEquals("[]", afterClearResponse.bodyAsText())

        assertEquals(HttpStatusCode.OK, auditResponse.status)
        assertTrue(auditResponse.bodyAsText().contains("\"action\": \"READ_MODEL_CACHE_INVALIDATED\""))
    }

    @Test
    fun `read model refresh can rebuild cached history and returns manually`() = testApplication {
        application {
            module()
        }

        val refreshResponse = client.post("/v1/portfolio/read-model-refresh/run")
        val cacheResponse = client.get("/v1/portfolio/read-model-cache")
        val statusResponse = client.get("/v1/portfolio/read-model-refresh")
        val auditResponse = client.get("/v1/portfolio/audit/events?category=SYSTEM")

        assertEquals(HttpStatusCode.OK, refreshResponse.status)
        assertTrue(refreshResponse.bodyAsText().contains("\"refreshedModelCount\": 2"))
        assertTrue(refreshResponse.bodyAsText().contains("\"trigger\": \"MANUAL\""))

        assertEquals(HttpStatusCode.OK, cacheResponse.status)
        assertTrue(cacheResponse.bodyAsText().contains("\"cacheKey\": \"portfolio.daily-history\""))
        assertTrue(cacheResponse.bodyAsText().contains("\"cacheKey\": \"portfolio.returns\""))
        assertTrue(cacheResponse.bodyAsText().contains("\"invalidationReason\": \"EXPLICIT_REFRESH\""))

        assertEquals(HttpStatusCode.OK, statusResponse.status)
        assertTrue(statusResponse.bodyAsText().contains("\"lastTrigger\": \"MANUAL\""))
        assertTrue(statusResponse.bodyAsText().contains("\"lastSuccessAt\":"))

        assertEquals(HttpStatusCode.OK, auditResponse.status)
        assertTrue(auditResponse.bodyAsText().contains("\"action\": \"READ_MODEL_REFRESH_COMPLETED\""))
    }
}
