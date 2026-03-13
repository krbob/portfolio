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
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class WriteModelRouteTest {

    @Test
    fun `accounts can be created and listed`() = testApplication {
        application {
            module()
        }

        val createResponse = client.post("/v1/accounts") {
            contentType(ContentType.Application.Json)
            setBody(
                """
                {
                  "name": "Interactive Brokers",
                  "institution": "Interactive Brokers",
                  "type": "BROKERAGE",
                  "baseCurrency": "USD"
                }
                """.trimIndent()
            )
        }

        val listResponse = client.get("/v1/accounts")

        assertEquals(HttpStatusCode.Created, createResponse.status)
        assertTrue(createResponse.bodyAsText().contains("\"type\": \"BROKERAGE\""))
        assertEquals(HttpStatusCode.OK, listResponse.status)
        assertTrue(listResponse.bodyAsText().contains("\"name\": \"Interactive Brokers\""))
    }

    @Test
    fun `edo instruments can be created`() = testApplication {
        application {
            module()
        }

        val response = client.post("/v1/instruments") {
            contentType(ContentType.Application.Json)
            setBody(
                """
                {
                  "name": "EDO 2035 2025-07-15",
                  "kind": "BOND_EDO",
                  "assetClass": "BONDS",
                  "currency": "PLN",
                  "valuationSource": "EDO_CALCULATOR",
                  "edoTerms": {
                    "purchaseDate": "2025-07-15",
                    "firstPeriodRateBps": 650,
                    "marginBps": 200,
                    "principalUnits": 12,
                    "maturityDate": "2035-07-15"
                  }
                }
                """.trimIndent()
            )
        }

        assertEquals(HttpStatusCode.Created, response.status)
        assertTrue(response.bodyAsText().contains("\"kind\": \"BOND_EDO\""))
        assertTrue(response.bodyAsText().contains("\"principalUnits\": 12"))
    }

    @Test
    fun `transactions return not found when account is missing`() = testApplication {
        application {
            module()
        }

        val response = client.post("/v1/transactions") {
            contentType(ContentType.Application.Json)
            setBody(
                """
                {
                  "accountId": "1f6f0cb3-8ef7-4700-b05b-c91470ca6b44",
                  "type": "DEPOSIT",
                  "tradeDate": "2026-03-01",
                  "settlementDate": "2026-03-01",
                  "grossAmount": "1000.00",
                  "currency": "PLN"
                }
                """.trimIndent()
            )
        }

        assertEquals(HttpStatusCode.NotFound, response.status)
        assertTrue(response.bodyAsText().contains("Account 1f6f0cb3-8ef7-4700-b05b-c91470ca6b44 was not found."))
    }
}
