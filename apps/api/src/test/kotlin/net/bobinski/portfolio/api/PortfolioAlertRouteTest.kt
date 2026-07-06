package net.bobinski.portfolio.api

import io.ktor.client.request.delete
import io.ktor.client.request.get
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.server.testing.testApplication
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class PortfolioAlertRouteTest {
    @Test
    fun `alerts endpoint returns empty list for empty portfolio`() = testApplication {
        application {
            module()
        }

        val response = client.get("/v1/portfolio/alerts")

        assertEquals(HttpStatusCode.OK, response.status)
        assertEquals("[]", response.bodyAsText())
    }

    @Test
    fun `alert settings return defaults and can be saved`() = testApplication {
        application {
            module()
        }

        val defaultResponse = client.get("/v1/portfolio/alert-settings")
        val defaultBody = defaultResponse.bodyAsText()

        assertEquals(HttpStatusCode.OK, defaultResponse.status)
        assertTrue(defaultBody.contains("\"enabled\": true"), defaultBody)
        assertTrue(defaultBody.contains("\"pushEnabled\": true"), defaultBody)
        assertTrue(defaultBody.contains("\"ALLOCATION_DRIFT\""), defaultBody)
        assertTrue(defaultBody.contains("\"MARKET_DATA_STALE\""), defaultBody)
        assertTrue(defaultBody.contains("\"BENCHMARK_UNDERPERFORMANCE\""), defaultBody)
        assertTrue(defaultBody.contains("\"allocationDriftThresholdPctPoints\": \"5.00\""), defaultBody)

        val saveResponse = client.post("/v1/portfolio/alert-settings") {
            contentType(ContentType.Application.Json)
            setBody(
                """
                {
                  "enabled": true,
                  "pushEnabled": false,
                  "enabledTypes": ["ALLOCATION_DRIFT"],
                  "allocationDriftThresholdPctPoints": "7.25",
                  "benchmarkUnderperformanceThresholdPctPoints": "4.50"
                }
                """.trimIndent()
            )
        }
        val saveBody = saveResponse.bodyAsText()

        assertEquals(HttpStatusCode.OK, saveResponse.status)
        assertTrue(saveBody.contains("\"pushEnabled\": false"), saveBody)
        assertTrue(saveBody.contains("\"ALLOCATION_DRIFT\""), saveBody)
        assertTrue(!saveBody.contains("\"MARKET_DATA_STALE\""), saveBody)
        assertTrue(!saveBody.contains("\"BENCHMARK_UNDERPERFORMANCE\""), saveBody)
        assertTrue(saveBody.contains("\"allocationDriftThresholdPctPoints\": \"7.25\""), saveBody)
        assertTrue(saveBody.contains("\"benchmarkUnderperformanceThresholdPctPoints\": \"4.50\""), saveBody)

        val auditResponse = client.get("/v1/portfolio/audit/events?category=SYSTEM")
        val auditBody = auditResponse.bodyAsText()

        assertEquals(HttpStatusCode.OK, auditResponse.status)
        assertTrue(auditBody.contains("ALERT_SETTINGS_UPDATED"), auditBody)
    }

    @Test
    fun `alert settings reject unsupported alert types`() = testApplication {
        application {
            module()
        }

        val response = client.post("/v1/portfolio/alert-settings") {
            contentType(ContentType.Application.Json)
            setBody(
                """
                {
                  "enabled": true,
                  "pushEnabled": true,
                  "enabledTypes": ["BROKEN_ALERT"],
                  "allocationDriftThresholdPctPoints": "5.00",
                  "benchmarkUnderperformanceThresholdPctPoints": "5.00"
                }
                """.trimIndent()
            )
        }
        val body = response.bodyAsText()

        assertEquals(HttpStatusCode.BadRequest, response.status)
        assertTrue(body.contains("Unsupported portfolio alert type"), body)
    }

    @Test
    fun `push config reports disabled when vapid keys are absent`() = testApplication {
        application {
            module()
        }

        val response = client.get("/v1/push/config")
        val body = response.bodyAsText()

        assertEquals(HttpStatusCode.OK, response.status)
        assertTrue(body.contains("\"enabled\": false"))
    }

    @Test
    fun `push subscription can be saved and removed`() = testApplication {
        application {
            module()
        }

        val createResponse = client.post("/v1/push/subscriptions") {
            contentType(ContentType.Application.Json)
            setBody(
                """
                {
                  "endpoint": "https://push.example.test/subscription-1",
                  "expirationTime": null,
                  "keys": {
                    "p256dh": "public-key",
                    "auth": "auth-secret"
                  },
                  "user_agent": "PortfolioRouteTest"
                }
                """.trimIndent()
            )
        }
        val createBody = createResponse.bodyAsText()

        assertEquals(HttpStatusCode.Created, createResponse.status)
        assertTrue(createBody.contains("https://push.example.test/subscription-1"))

        val deleteResponse = client.delete("/v1/push/subscriptions") {
            contentType(ContentType.Application.Json)
            setBody("""{"endpoint":"https://push.example.test/subscription-1"}""")
        }

        assertEquals(HttpStatusCode.NoContent, deleteResponse.status)
    }
}
