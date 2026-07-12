package net.bobinski.portfolio.api

import io.ktor.client.request.delete
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
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
    fun `alerts endpoint localizes content from accept language with a Polish compatibility fallback`() = testApplication {
        application {
            module()
        }

        val accountId = createAccount()
        createDeposit(accountId)
        createEquityTarget()
        val settings = client.post("/v1/portfolio/alert-settings") {
            contentType(ContentType.Application.Json)
            setBody(
                """
                {
                  "enabled": true,
                  "pushEnabled": false,
                  "enabledTypes": ["ALLOCATION_DRIFT"],
                  "allocationDriftThresholdPctPoints": "5.00",
                  "benchmarkUnderperformanceThresholdPctPoints": "5.00"
                }
                """.trimIndent()
            )
        }
        assertEquals(HttpStatusCode.OK, settings.status, settings.bodyAsText())

        val english = client.get("/v1/portfolio/alerts") {
            header(HttpHeaders.AcceptLanguage, "pl;q=0.4, en-GB;q=0.9")
        }
        val polish = client.get("/v1/portfolio/alerts") {
            header(HttpHeaders.AcceptLanguage, "pl-PL")
        }
        val defaultLocale = client.get("/v1/portfolio/alerts")
        val invalidLocale = client.get("/v1/portfolio/alerts") {
            header(HttpHeaders.AcceptLanguage, "de-DE, invalid;q=broken")
        }
        val englishBody = english.bodyAsText()

        assertEquals(HttpStatusCode.OK, english.status, englishBody)
        assertTrue(englishBody.contains("Allocation drift: equities"), englishBody)
        assertTrue(englishBody.contains("The deviation is"), englishBody)
        assertTrue(polish.bodyAsText().contains("Dryf alokacji: akcje"), polish.bodyAsText())
        assertTrue(defaultLocale.bodyAsText().contains("Dryf alokacji: akcje"), defaultLocale.bodyAsText())
        assertTrue(invalidLocale.bodyAsText().contains("Dryf alokacji: akcje"), invalidLocale.bodyAsText())
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
        assertTrue(createBody.contains("\"locale\": \"pl\""), createBody)

        val englishResponse = client.post("/v1/push/subscriptions") {
            contentType(ContentType.Application.Json)
            setBody(
                """
                {
                  "endpoint": "https://push.example.test/subscription-2",
                  "keys": { "p256dh": "public-key", "auth": "auth-secret" },
                  "locale": "en-GB"
                }
                """.trimIndent()
            )
        }
        val invalidLocaleResponse = client.post("/v1/push/subscriptions") {
            contentType(ContentType.Application.Json)
            setBody(
                """
                {
                  "endpoint": "https://push.example.test/subscription-3",
                  "keys": { "p256dh": "public-key", "auth": "auth-secret" },
                  "locale": "invalid"
                }
                """.trimIndent()
            )
        }

        assertTrue(englishResponse.bodyAsText().contains("\"locale\": \"en\""), englishResponse.bodyAsText())
        assertTrue(invalidLocaleResponse.bodyAsText().contains("\"locale\": \"pl\""), invalidLocaleResponse.bodyAsText())

        val deleteResponse = client.delete("/v1/push/subscriptions") {
            contentType(ContentType.Application.Json)
            setBody("""{"endpoint":"https://push.example.test/subscription-1"}""")
        }

        assertEquals(HttpStatusCode.NoContent, deleteResponse.status)
    }

    private suspend fun io.ktor.server.testing.ApplicationTestBuilder.createAccount(): String {
        val response = client.post("/v1/accounts") {
            contentType(ContentType.Application.Json)
            setBody(
                """
                {
                  "name": "Primary",
                  "institution": "Broker",
                  "type": "BROKERAGE",
                  "baseCurrency": "PLN"
                }
                """.trimIndent()
            )
        }
        assertEquals(HttpStatusCode.Created, response.status, response.bodyAsText())
        return Regex("\"id\":\\s*\"([^\"]+)\"").find(response.bodyAsText())!!.groupValues[1]
    }

    private suspend fun io.ktor.server.testing.ApplicationTestBuilder.createDeposit(accountId: String) {
        val response = client.post("/v1/transactions") {
            contentType(ContentType.Application.Json)
            setBody(
                """
                {
                  "accountId": "$accountId",
                  "type": "DEPOSIT",
                  "tradeDate": "2026-07-13",
                  "settlementDate": "2026-07-13",
                  "grossAmount": "1000.00",
                  "currency": "PLN"
                }
                """.trimIndent()
            )
        }
        assertEquals(HttpStatusCode.Created, response.status, response.bodyAsText())
    }

    private suspend fun io.ktor.server.testing.ApplicationTestBuilder.createEquityTarget() {
        val response = client.post("/v1/portfolio/targets") {
            contentType(ContentType.Application.Json)
            setBody(
                """
                {
                  "items": [
                    { "assetClass": "EQUITIES", "targetWeight": "1.00" }
                  ]
                }
                """.trimIndent()
            )
        }
        assertEquals(HttpStatusCode.OK, response.status, response.bodyAsText())
    }
}
