package net.bobinski.portfolio.api

import ch.qos.logback.classic.Level
import ch.qos.logback.classic.Logger
import ch.qos.logback.classic.encoder.PatternLayoutEncoder
import ch.qos.logback.classic.spi.ILoggingEvent
import ch.qos.logback.core.ConsoleAppender
import ch.qos.logback.core.read.ListAppender
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
import net.bobinski.portfolio.api.plugins.formatAccessLog
import net.bobinski.portfolio.api.plugins.shouldLogAccessPath
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNotEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.slf4j.LoggerFactory

class MonitoringAndErrorContractTest {
    @Test
    fun `logback uses explicit UTC stdout format with request correlation and full exceptions`() {
        val rootLogger = LoggerFactory.getLogger(Logger.ROOT_LOGGER_NAME) as Logger
        val stdoutAppender = requireNotNull(rootLogger.getAppender("STDOUT")) as ConsoleAppender<*>
        val encoder = stdoutAppender.encoder as PatternLayoutEncoder

        assertEquals(Level.INFO, rootLogger.level)
        assertEquals("System.out", stdoutAppender.target)
        assertTrue(encoder.pattern.contains(",UTC}"), encoder.pattern)
        assertTrue(encoder.pattern.contains("requestId=%X{requestId:-none}"), encoder.pattern)
        assertTrue(encoder.pattern.contains("%ex{full}"), encoder.pattern)
    }

    @Test
    fun `access log format is bounded to request metadata and escapes untrusted path characters`() {
        val message = formatAccessLog(
            method = "GET",
            path = "/v1/example/\"line\nnext",
            status = 200,
            durationMillis = -1
        )

        assertEquals(
            "event=http_request method=\"GET\" path=\"/v1/example/\\\"line\\nnext\" status=200 durationMs=0",
            message
        )
        assertFalse(shouldLogAccessPath("/v1/health"))
        assertFalse(shouldLogAccessPath("/metrics"))
        assertTrue(shouldLogAccessPath("/v1/readiness"))
    }

    @Test
    fun `call logging records safe request metadata with request id and suppresses probe paths`() {
        val rootLogger = LoggerFactory.getLogger(Logger.ROOT_LOGGER_NAME) as Logger
        val appender = ListAppender<ILoggingEvent>().apply { start() }
        rootLogger.addAppender(appender)

        try {
            testApplication {
                application { module() }

                client.get("/v1/health")
                client.get("/metrics")
                client.get("/v1/meta?secret=must-not-be-logged") {
                    header(HttpHeaders.XRequestId, "access-log-request")
                }
            }

            val accessEvents = appender.list.filter { event ->
                event.formattedMessage.startsWith("event=http_request")
            }
            val metaEvent = accessEvents.single { event ->
                event.formattedMessage.contains("path=\"/v1/meta\"")
            }

            assertEquals(Level.INFO, metaEvent.level)
            assertEquals("access-log-request", metaEvent.mdcPropertyMap["requestId"])
            assertTrue(metaEvent.formattedMessage.contains("method=\"GET\""), metaEvent.formattedMessage)
            assertTrue(metaEvent.formattedMessage.contains("status=200"), metaEvent.formattedMessage)
            assertTrue(metaEvent.formattedMessage.contains("durationMs="), metaEvent.formattedMessage)
            assertFalse(metaEvent.formattedMessage.contains("secret"), metaEvent.formattedMessage)
            assertFalse(accessEvents.any { it.formattedMessage.contains("path=\"/v1/health\"") })
            assertFalse(accessEvents.any { it.formattedMessage.contains("path=\"/metrics\"") })
        } finally {
            rootLogger.detachAppender(appender)
            appender.stop()
        }
    }

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
