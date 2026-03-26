package net.bobinski.portfolio.api

import io.ktor.client.request.get
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.server.config.MapApplicationConfig
import io.ktor.server.testing.ApplicationTestBuilder
import io.ktor.server.testing.testApplication
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class ApplicationTest {

    @Test
    fun `root endpoint returns splash text`() = testApplication {
        configurePortfolioTestApplication()

        val response = client.get("/")

        assertEquals(HttpStatusCode.OK, response.status)
        assertEquals("Portfolio API", response.bodyAsText())
    }

    @Test
    fun `health endpoint returns ok payload`() = testApplication {
        configurePortfolioTestApplication()

        val response = client.get("/v1/health")
        val body = response.bodyAsText()

        assertEquals(HttpStatusCode.OK, response.status)
        assertTrue(body.contains("\"status\": \"ok\""))
        assertTrue(body.contains("\"name\": \"Portfolio\""))
        assertTrue(body.contains("\"persistenceMode\": \"SQLITE\""))
        assertTrue(body.contains("\"authEnabled\": false"))
    }

    @Test
    fun `meta endpoint returns stack summary`() = testApplication {
        configurePortfolioTestApplication()

        val response = client.get("/v1/meta")
        val body = response.bodyAsText()

        assertEquals(HttpStatusCode.OK, response.status)
        assertTrue(body.contains("\"web\": \"React 19 + TypeScript + Vite\""))
        assertTrue(body.contains("\"database\": \"SQLite\""))
        assertTrue(body.contains("\"persistenceMode\": \"SQLITE\""))
        assertTrue(body.contains("\"mode\": \"DISABLED\""))
        assertTrue(body.contains("Server-side backup snapshots"))
    }

    @Test
    fun `api endpoints disable http caching`() = testApplication {
        configurePortfolioTestApplication()

        val response = client.get("/v1/meta")

        assertEquals(HttpStatusCode.OK, response.status)
        assertEquals("no-store", response.headers[HttpHeaders.CacheControl])
        assertEquals("no-cache", response.headers[HttpHeaders.Pragma])
        assertEquals("0", response.headers[HttpHeaders.Expires])
    }

    @Test
    fun `readiness endpoint returns structured checks`() = testApplication {
        configurePortfolioTestApplication()

        val response = client.get("/v1/readiness")
        val body = response.bodyAsText()

        assertEquals(HttpStatusCode.OK, response.status)
        assertTrue(body.contains("\"status\": \"READY\""), body)
        assertTrue(body.contains("\"key\": \"sqlite-directory\""), body)
        assertTrue(body.contains("\"key\": \"sqlite-connection\""), body)
        assertTrue(body.contains("\"key\": \"backups-directory\""), body)
    }

    @Test
    fun `openapi endpoint returns api specification`() = testApplication {
        configurePortfolioTestApplication()

        val response = client.get("/v1/openapi.json")
        val body = response.bodyAsText()

        assertEquals(HttpStatusCode.OK, response.status)
        assertTrue(body.contains("\"openapi\""))
        assertTrue(body.contains("/v1/portfolio/overview"))
        assertTrue(body.contains("/v1/portfolio/accounts"))
        assertTrue(body.contains("/v1/portfolio/returns"))
    }

    @Test
    fun `openapi ui route is disabled in test stage`() = testApplication {
        configurePortfolioTestApplication()

        val response = client.get("/openapi")

        assertEquals(HttpStatusCode.NotFound, response.status)
    }

    private fun ApplicationTestBuilder.configurePortfolioTestApplication() {
        environment {
            config = MapApplicationConfig(
                "portfolio.stage" to "test",
                "portfolio.openapi.uiEnabled" to "false",
                "portfolio.marketData.enabled" to "false"
            )
        }

        application {
            module()
        }
    }
}
