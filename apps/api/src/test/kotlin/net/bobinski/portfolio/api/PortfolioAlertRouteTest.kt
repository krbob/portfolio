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
