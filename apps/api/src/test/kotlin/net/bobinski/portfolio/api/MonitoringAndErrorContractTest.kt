package net.bobinski.portfolio.api

import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.server.config.MapApplicationConfig
import io.ktor.server.testing.testApplication
import net.bobinski.portfolio.api.plugins.RequestMetricsRegistry
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class MonitoringAndErrorContractTest {
    @Test
    fun `request id is preserved when valid and replaced when invalid`() = testApplication {
        application { module() }

        val preserved = client.get("/v1/health") {
            header(HttpHeaders.XRequestId, "portfolio-request-123")
        }
        val replaced = client.get("/v1/health") {
            header(HttpHeaders.XRequestId, "invalid request id")
        }

        assertEquals("portfolio-request-123", preserved.headers[HttpHeaders.XRequestId])
        val generated = replaced.headers[HttpHeaders.XRequestId]
        assertTrue(generated?.matches(Regex("[A-Za-z0-9][A-Za-z0-9._:-]{0,127}")) == true, generated)
        assertNotEquals("invalid request id", generated)
    }

    @Test
    fun `validation errors expose stable correlated envelope`() = testApplication {
        application { module() }

        val response = client.post("/v1/portfolio/alert-settings") {
            header(HttpHeaders.XRequestId, "validation-request")
            contentType(ContentType.Application.Json)
            setBody(
                """
                {
                  "enabled": true,
                  "pushEnabled": false,
                  "enabledTypes": ["UNKNOWN"],
                  "allocationDriftThresholdPctPoints": "5.00",
                  "benchmarkUnderperformanceThresholdPctPoints": "5.00"
                }
                """.trimIndent()
            )
        }
        val body = response.bodyAsText()

        assertEquals(HttpStatusCode.BadRequest, response.status, body)
        assertEquals("validation-request", response.headers[HttpHeaders.XRequestId])
        assertTrue(body.contains("\"error\":"), body)
        assertTrue(body.contains("\"errorCode\": \"INVALID_REQUEST\""), body)
        assertTrue(body.contains("\"retryable\": false"), body)
        assertTrue(body.contains("\"requestId\": \"validation-request\""), body)
        assertTrue(body.contains("\"message\":"), body)
    }

    @Test
    fun `unknown routes return a stable route not found error`() = testApplication {
        application { module() }

        val response = client.get("/missing-route") {
            header(HttpHeaders.XRequestId, "missing-route-request")
        }
        val body = response.bodyAsText()

        assertEquals(HttpStatusCode.NotFound, response.status, body)
        assertTrue(body.contains("\"errorCode\": \"ROUTE_NOT_FOUND\""), body)
        assertTrue(body.contains("\"requestId\": \"missing-route-request\""), body)
    }

    @Test
    fun `metrics expose bounded normalized request series`() = testApplication {
        application { module() }

        client.get("/v1/meta")
        val response = client.get("/metrics")
        val body = response.bodyAsText()

        assertEquals(HttpStatusCode.OK, response.status, body)
        assertTrue(body.contains("# TYPE portfolio_http_requests_total counter"), body)
        assertTrue(
            body.contains("portfolio_http_requests_total{method=\"GET\",route=\"/v1/meta\",status=\"200\"} 1"),
            body
        )
        assertTrue(body.contains("portfolio_http_request_duration_seconds_count"), body)
    }

    @Test
    fun `metrics require an authenticated session when password auth is enabled`() = testApplication {
        environment {
            config = MapApplicationConfig(
                "portfolio.auth.enabled" to "true",
                "portfolio.auth.password" to "secret-pass",
                "portfolio.auth.sessionSecret" to "0123456789abcdef0123456789abcdef",
                "portfolio.auth.sessionCookieName" to "portfolio_metrics_session",
                "portfolio.auth.secureCookie" to "false"
            )
        }
        application { module() }

        val unauthorized = client.get("/metrics")
        val login = client.post("/v1/auth/session") {
            contentType(ContentType.Application.Json)
            setBody("""{"password":"secret-pass"}""")
        }
        val sessionCookie = login.headers[HttpHeaders.SetCookie]
            ?.substringBefore(';')
            ?: error("Expected auth session cookie in login response.")
        val authorized = client.get("/metrics") {
            header(HttpHeaders.Cookie, sessionCookie)
        }

        assertEquals(HttpStatusCode.Unauthorized, unauthorized.status)
        assertEquals(HttpStatusCode.OK, login.status)
        assertEquals(HttpStatusCode.OK, authorized.status)
        assertTrue(authorized.bodyAsText().contains("# TYPE portfolio_http_requests_total counter"))
    }

    @Test
    fun `metrics registry bounds unexpected series cardinality`() {
        val registry = RequestMetricsRegistry()

        repeat(400) { index ->
            registry.record("GET", "/unexpected/$index", 200, index.toLong())
        }

        val seriesCount = registry.scrape().lineSequence()
            .count { line -> line.startsWith("portfolio_http_requests_total{") }
        assertTrue(seriesCount <= 256, "Expected at most 256 series, received $seriesCount")
    }
}
