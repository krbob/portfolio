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

class PortfolioStateRouteTest {

    @Test
    fun `portfolio state can be exported and re-imported`() = testApplication {
        application {
            module()
        }

        val accountId = createAccount(name = "Primary")
        val instrumentId = createInstrument(name = "VWCE")
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
        createTransaction(
            """
            {
              "accountId": "$accountId",
              "instrumentId": "$instrumentId",
              "type": "BUY",
              "tradeDate": "2026-03-02",
              "settlementDate": "2026-03-02",
              "quantity": "2",
              "unitPrice": "100.00",
              "grossAmount": "200.00",
              "currency": "PLN"
            }
            """.trimIndent()
        )

        val exportResponse = client.get("/v1/portfolio/state/export")
        val importResponse = client.post("/v1/portfolio/state/import") {
            contentType(ContentType.Application.Json)
            setBody(
                """
                {
                  "mode": "REPLACE",
                  "snapshot": ${exportResponse.bodyAsText()}
                }
                """.trimIndent()
            )
        }
        val transactionsResponse = client.get("/v1/transactions")

        assertEquals(HttpStatusCode.OK, exportResponse.status)
        assertTrue(exportResponse.bodyAsText().contains("\"schemaVersion\": 1"))
        assertTrue(exportResponse.bodyAsText().contains("\"name\": \"Primary\""))
        assertEquals(HttpStatusCode.OK, importResponse.status)
        assertTrue(importResponse.bodyAsText().contains("\"mode\": \"REPLACE\""))
        assertTrue(importResponse.bodyAsText().contains("\"transactionCount\": 2"))
        assertTrue(transactionsResponse.bodyAsText().contains("\"type\": \"BUY\""))
    }

    private suspend fun io.ktor.server.testing.ApplicationTestBuilder.createAccount(name: String): String {
        val response = client.post("/v1/accounts") {
            contentType(ContentType.Application.Json)
            setBody(
                """
                {
                  "name": "$name",
                  "institution": "Broker",
                  "type": "BROKERAGE",
                  "baseCurrency": "PLN"
                }
                """.trimIndent()
            )
        }
        return Regex("\"id\":\\s*\"([^\"]+)\"").find(response.bodyAsText())!!.groupValues[1]
    }

    private suspend fun io.ktor.server.testing.ApplicationTestBuilder.createInstrument(name: String): String {
        val response = client.post("/v1/instruments") {
            contentType(ContentType.Application.Json)
            setBody(
                """
                {
                  "name": "$name",
                  "kind": "ETF",
                  "assetClass": "EQUITIES",
                  "symbol": "VWCE.DE",
                  "currency": "EUR",
                  "valuationSource": "STOCK_ANALYST"
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
