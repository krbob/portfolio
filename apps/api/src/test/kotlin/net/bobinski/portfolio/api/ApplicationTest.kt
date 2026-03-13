package net.bobinski.portfolio.api

import io.ktor.client.request.get
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpStatusCode
import io.ktor.server.testing.testApplication
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class ApplicationTest {

    @Test
    fun `root endpoint returns splash text`() = testApplication {
        application {
            module()
        }

        val response = client.get("/")

        assertEquals(HttpStatusCode.OK, response.status)
        assertEquals("Portfolio API", response.bodyAsText())
    }

    @Test
    fun `health endpoint returns ok payload`() = testApplication {
        application {
            module()
        }

        val response = client.get("/v1/health")
        val body = response.bodyAsText()

        assertEquals(HttpStatusCode.OK, response.status)
        assertTrue(body.contains("\"status\": \"ok\""))
        assertTrue(body.contains("\"name\": \"Portfolio\""))
        assertTrue(body.contains("\"persistenceMode\": \"MEMORY\""))
    }

    @Test
    fun `meta endpoint returns stack summary`() = testApplication {
        application {
            module()
        }

        val response = client.get("/v1/meta")
        val body = response.bodyAsText()

        assertEquals(HttpStatusCode.OK, response.status)
        assertTrue(body.contains("\"web\": \"React 19 + TypeScript + Vite\""))
        assertTrue(body.contains("\"database\": \"PostgreSQL (planned)\""))
        assertTrue(body.contains("\"persistenceMode\": \"MEMORY\""))
    }
}
