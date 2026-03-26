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

class PortfolioReturnsRouteTest {

    @Test
    fun `returns endpoint exposes period summary`() = testApplication {
        application {
            module()
        }

        val accountId = createAccount()
        createTransaction(
            """
            {
              "accountId": "$accountId",
              "type": "DEPOSIT",
              "tradeDate": "2026-03-01",
              "settlementDate": "2026-03-01",
              "grossAmount": "1000.00",
              "currency": "PLN"
            }
            """.trimIndent()
        )

        val response = client.get("/v1/portfolio/returns")
        val body = response.bodyAsText()

        assertEquals(HttpStatusCode.OK, response.status)
        assertTrue(body.contains("\"asOf\":"))
        assertTrue(body.contains("\"key\": \"MAX\""))
        assertTrue(body.contains("\"label\": \"MAX\""))
        assertTrue(body.contains("\"timeWeightedReturn\":"))
        assertTrue(body.contains("\"breakdown\":"))
        assertTrue(body.contains("\"benchmarks\":"))
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
        return Regex("\"id\":\\s*\"([^\"]+)\"").find(response.bodyAsText())!!.groupValues[1]
    }

    private suspend fun io.ktor.server.testing.ApplicationTestBuilder.createTransaction(body: String) {
        val response = client.post("/v1/transactions") {
            contentType(ContentType.Application.Json)
            setBody(body)
        }
        assertEquals(HttpStatusCode.Created, response.status)
    }
}
