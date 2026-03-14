package net.bobinski.portfolio.api

import io.ktor.client.request.get
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.server.testing.testApplication
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class PortfolioAuditRouteTest {

    @Test
    fun `audit events expose recent account and import activity`() = testApplication {
        application {
            module()
        }

        val accountResponse = client.post("/v1/accounts") {
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
        val accountId = Regex("\"id\":\\s*\"([^\"]+)\"").find(accountResponse.bodyAsText())!!.groupValues[1]

        val importResponse = client.post("/v1/transactions/import") {
            contentType(ContentType.Application.Json)
            setBody(
                """
                {
                  "rows": [
                    {
                      "accountId": "$accountId",
                      "type": "DEPOSIT",
                      "tradeDate": "2026-03-01",
                      "settlementDate": "2026-03-01",
                      "grossAmount": "1000.00",
                      "currency": "PLN"
                    }
                  ]
                }
                """.trimIndent()
            )
        }

        val listResponse = client.get("/v1/portfolio/audit/events?limit=5")
        val accountsOnlyResponse = client.get("/v1/portfolio/audit/events?category=ACCOUNTS&limit=5")

        assertEquals(HttpStatusCode.Created, importResponse.status)
        assertEquals(HttpStatusCode.OK, listResponse.status)
        assertTrue(listResponse.bodyAsText().contains("\"action\": \"TRANSACTION_BATCH_IMPORTED\""))
        assertTrue(listResponse.bodyAsText().contains("\"action\": \"ACCOUNT_CREATED\""))
        assertTrue(listResponse.bodyAsText().contains("\"outcome\": \"SUCCESS\""))

        assertEquals(HttpStatusCode.OK, accountsOnlyResponse.status)
        assertTrue(accountsOnlyResponse.bodyAsText().contains("\"category\": \"ACCOUNTS\""))
        assertFalse(accountsOnlyResponse.bodyAsText().contains("TRANSACTION_BATCH_IMPORTED"))
    }
}
