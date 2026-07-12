package net.bobinski.portfolio.api

import io.ktor.client.request.delete
import io.ktor.client.request.get
import io.ktor.client.request.post
import io.ktor.client.request.put
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.server.testing.ApplicationTestBuilder
import io.ktor.server.testing.testApplication
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class TransactionLedgerRouteTest {
    @Test
    fun `selling an instrument that was never owned is rejected`() = testApplication {
        application { module() }
        val accountId = createAccount()
        val instrumentId = createInstrument()

        val response = postTransaction(accountId, instrumentId, "SELL", "2026-03-01", "1")

        assertEquals(HttpStatusCode.BadRequest, response.status)
        assertTrue(response.bodyAsText().contains("available 0, requested 1"))
        assertEquals("[]", client.get("/v1/transactions").bodyAsText())
    }

    @Test
    fun `selling more than the available quantity is rejected`() = testApplication {
        application { module() }
        val accountId = createAccount()
        val instrumentId = createInstrument()
        assertEquals(
            HttpStatusCode.Created,
            postTransaction(accountId, instrumentId, "BUY", "2026-03-01", "10").status
        )

        val response = postTransaction(accountId, instrumentId, "SELL", "2026-03-02", "11")

        assertEquals(HttpStatusCode.BadRequest, response.status)
        assertTrue(response.bodyAsText().contains("available 10, requested 11"))
        assertEquals(1, transactionCount())
    }

    @Test
    fun `backdated sale is rejected when it invalidates a later sale`() = testApplication {
        application { module() }
        val accountId = createAccount()
        val instrumentId = createInstrument()
        assertEquals(
            HttpStatusCode.Created,
            postTransaction(accountId, instrumentId, "BUY", "2026-03-01", "10").status
        )
        assertEquals(
            HttpStatusCode.Created,
            postTransaction(accountId, instrumentId, "SELL", "2026-03-03", "10").status
        )

        val response = postTransaction(accountId, instrumentId, "SELL", "2026-03-02", "1")

        assertEquals(HttpStatusCode.BadRequest, response.status)
        assertTrue(response.bodyAsText().contains("available 9, requested 10"))
        assertEquals(2, transactionCount())
    }

    @Test
    fun `updating or deleting an earlier buy cannot invalidate later sales`() = testApplication {
        application { module() }
        val accountId = createAccount()
        val instrumentId = createInstrument()
        val buyResponse = postTransaction(accountId, instrumentId, "BUY", "2026-03-01", "10")
        val buyId = responseId(buyResponse)
        assertEquals(
            HttpStatusCode.Created,
            postTransaction(accountId, instrumentId, "SELL", "2026-03-02", "10").status
        )

        val updateResponse = client.put("/v1/transactions/$buyId") {
            contentType(ContentType.Application.Json)
            setBody(transactionBody(accountId, instrumentId, "BUY", "2026-03-01", "5"))
        }
        val deleteResponse = client.delete("/v1/transactions/$buyId")
        val journal = client.get("/v1/transactions").bodyAsText()

        assertEquals(HttpStatusCode.BadRequest, updateResponse.status)
        assertTrue(updateResponse.bodyAsText().contains("available 5, requested 10"))
        assertEquals(HttpStatusCode.BadRequest, deleteResponse.status)
        assertTrue(deleteResponse.bodyAsText().contains("available 0, requested 10"))
        assertTrue(journal.contains("\"id\": \"$buyId\""))
        assertTrue(journal.contains("\"quantity\": \"10\""))
        assertEquals(2, Regex("\"id\":").findAll(journal).count())
    }

    @Test
    fun `batch preview and import reject an oversell atomically`() = testApplication {
        application { module() }
        val accountId = createAccount()
        val instrumentId = createInstrument()
        val requestBody = """
            {
              "rows": [
                ${transactionBody(accountId, instrumentId, "BUY", "2026-03-01", "5")},
                ${transactionBody(accountId, instrumentId, "SELL", "2026-03-02", "6")}
              ]
            }
        """.trimIndent()

        val previewResponse = client.post("/v1/transactions/import/preview") {
            contentType(ContentType.Application.Json)
            setBody(requestBody)
        }
        val importResponse = client.post("/v1/transactions/import") {
            contentType(ContentType.Application.Json)
            setBody(requestBody)
        }

        assertEquals(HttpStatusCode.OK, previewResponse.status)
        assertTrue(previewResponse.bodyAsText().contains("\"invalidRowCount\": 1"))
        assertTrue(previewResponse.bodyAsText().contains("available 5, requested 6"))
        assertEquals(HttpStatusCode.BadRequest, importResponse.status)
        assertEquals("[]", client.get("/v1/transactions").bodyAsText())
    }

    private suspend fun ApplicationTestBuilder.createAccount(): String {
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
        assertEquals(HttpStatusCode.Created, response.status)
        return responseId(response)
    }

    private suspend fun ApplicationTestBuilder.createInstrument(): String {
        val response = client.post("/v1/instruments") {
            contentType(ContentType.Application.Json)
            setBody(
                """
                {
                  "name": "VWCE",
                  "kind": "ETF",
                  "assetClass": "EQUITIES",
                  "symbol": "VWCE.DE",
                  "currency": "EUR",
                  "valuationSource": "STOCK_ANALYST"
                }
                """.trimIndent()
            )
        }
        assertEquals(HttpStatusCode.Created, response.status)
        return responseId(response)
    }

    private suspend fun ApplicationTestBuilder.postTransaction(
        accountId: String,
        instrumentId: String,
        type: String,
        tradeDate: String,
        quantity: String
    ): HttpResponse = client.post("/v1/transactions") {
        contentType(ContentType.Application.Json)
        setBody(transactionBody(accountId, instrumentId, type, tradeDate, quantity))
    }

    private suspend fun ApplicationTestBuilder.transactionCount(): Int = client.get("/v1/transactions")
        .bodyAsText()
        .let { body -> Regex("\"id\":").findAll(body).count() }

    private suspend fun responseId(response: HttpResponse): String =
        Regex("\"id\":\\s*\"([^\"]+)\"").find(response.bodyAsText())!!.groupValues[1]

    private fun transactionBody(
        accountId: String,
        instrumentId: String,
        type: String,
        tradeDate: String,
        quantity: String
    ): String = """
        {
          "accountId": "$accountId",
          "instrumentId": "$instrumentId",
          "type": "$type",
          "tradeDate": "$tradeDate",
          "settlementDate": "$tradeDate",
          "quantity": "$quantity",
          "unitPrice": "100.00",
          "grossAmount": "100.00",
          "feeAmount": "0",
          "taxAmount": "0",
          "currency": "PLN"
        }
    """.trimIndent()
}
