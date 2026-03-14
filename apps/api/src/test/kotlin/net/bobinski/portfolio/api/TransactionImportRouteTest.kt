package net.bobinski.portfolio.api

import io.ktor.client.request.delete
import io.ktor.client.request.get
import io.ktor.client.request.post
import io.ktor.client.request.put
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.server.testing.testApplication
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class TransactionImportRouteTest {

    @Test
    fun `import profiles can be created updated listed and deleted`() = testApplication {
        application {
            module()
        }

        val accountId = createAccount("Primary import account")
        val createResponse = client.post("/v1/transactions/import/profiles") {
            contentType(ContentType.Application.Json)
            setBody(
                """
                {
                  "name": "Canonical semicolon import",
                  "description": "Semicolon separated rows with European decimals",
                  "delimiter": "SEMICOLON",
                  "dateFormat": "DMY_DOTS",
                  "decimalSeparator": "COMMA",
                  "skipDuplicatesByDefault": false,
                  "headerMappings": {
                    "account": null,
                    "type": "Action",
                    "tradeDate": "Trade date",
                    "settlementDate": "Settle date",
                    "instrument": "Ticker",
                    "quantity": "Units",
                    "unitPrice": "Price",
                    "grossAmount": "Gross",
                    "feeAmount": "Fee",
                    "taxAmount": null,
                    "currency": null,
                    "fxRateToPln": "FX",
                    "notes": "Memo"
                  },
                  "defaults": {
                    "accountId": "$accountId",
                    "currency": "USD"
                  }
                }
                """.trimIndent()
            )
        }
        val profileId = Regex("\"id\":\\s*\"([^\"]+)\"").find(createResponse.bodyAsText())!!.groupValues[1]

        val updateResponse = client.put("/v1/transactions/import/profiles/$profileId") {
            contentType(ContentType.Application.Json)
            setBody(
                """
                {
                  "name": "Canonical semicolon import",
                  "description": "Updated mapping",
                  "delimiter": "SEMICOLON",
                  "dateFormat": "DMY_DOTS",
                  "decimalSeparator": "COMMA",
                  "skipDuplicatesByDefault": true,
                  "headerMappings": {
                    "account": null,
                    "type": "Action",
                    "tradeDate": "Trade date",
                    "settlementDate": "Settle date",
                    "instrument": "Ticker",
                    "quantity": "Units",
                    "unitPrice": "Price",
                    "grossAmount": "Gross",
                    "feeAmount": "Fee",
                    "taxAmount": null,
                    "currency": null,
                    "fxRateToPln": "FX",
                    "notes": "Memo"
                  },
                  "defaults": {
                    "accountId": "$accountId",
                    "currency": "USD"
                  }
                }
                """.trimIndent()
            )
        }
        val listResponse = client.get("/v1/transactions/import/profiles")
        val deleteResponse = client.delete("/v1/transactions/import/profiles/$profileId")
        val listAfterDelete = client.get("/v1/transactions/import/profiles")

        assertEquals(HttpStatusCode.Created, createResponse.status)
        assertTrue(createResponse.bodyAsText().contains("\"delimiter\": \"SEMICOLON\""))
        assertEquals(HttpStatusCode.OK, updateResponse.status)
        assertTrue(updateResponse.bodyAsText().contains("\"description\": \"Updated mapping\""))
        assertTrue(updateResponse.bodyAsText().contains("\"skipDuplicatesByDefault\": true"))
        assertEquals(HttpStatusCode.OK, listResponse.status)
        assertTrue(listResponse.bodyAsText().contains("\"name\": \"Canonical semicolon import\""))
        assertEquals(HttpStatusCode.NoContent, deleteResponse.status)
        assertEquals("[]", listAfterDelete.bodyAsText())
    }

    @Test
    fun `csv preview and import use a saved profile`() = testApplication {
        application {
            module()
        }

        val accountId = createAccount("IBKR")
        createInstrument(name = "Vanguard FTSE All-World UCITS ETF", symbol = "VWRA.L", currency = "USD")

        val profileResponse = client.post("/v1/transactions/import/profiles") {
            contentType(ContentType.Application.Json)
            setBody(
                """
                {
                  "name": "IBKR activity export",
                  "description": "Saved CSV profile for semicolon exports",
                  "delimiter": "SEMICOLON",
                  "dateFormat": "DMY_DOTS",
                  "decimalSeparator": "COMMA",
                  "skipDuplicatesByDefault": true,
                  "headerMappings": {
                    "account": null,
                    "type": "Action",
                    "tradeDate": "Date",
                    "settlementDate": null,
                    "instrument": "Ticker",
                    "quantity": "Units",
                    "unitPrice": "Price",
                    "grossAmount": "Gross",
                    "feeAmount": "Fee",
                    "taxAmount": null,
                    "currency": null,
                    "fxRateToPln": "FX",
                    "notes": "Note"
                  },
                  "defaults": {
                    "accountId": "$accountId",
                    "currency": "USD"
                  }
                }
                """.trimIndent()
            )
        }
        val profileId = Regex("\"id\":\\s*\"([^\"]+)\"").find(profileResponse.bodyAsText())!!.groupValues[1]
        val csv = """
            Action;Date;Ticker;Units;Price;Gross;Fee;FX;Note
            BUY;14.03.2026;VWRA.L;3,5;123,45;432,08;1,20;3,9876;Starter lot
        """.trimIndent()

        val previewResponse = client.post("/v1/transactions/import/csv/preview") {
            contentType(ContentType.Application.Json)
            setBody(
                """
                {
                  "profileId": "$profileId",
                  "csv": ${jsonString(csv)}
                }
                """.trimIndent()
            )
        }
        val importResponse = client.post("/v1/transactions/import/csv") {
            contentType(ContentType.Application.Json)
            setBody(
                """
                {
                  "profileId": "$profileId",
                  "csv": ${jsonString(csv)}
                }
                """.trimIndent()
            )
        }
        val transactionsResponse = client.get("/v1/transactions")
        val previewBody = previewResponse.bodyAsText()
        val importBody = importResponse.bodyAsText()
        val transactionsBody = transactionsResponse.bodyAsText()

        assertEquals(HttpStatusCode.OK, previewResponse.status)
        assertTrue(previewBody.contains("\"importableRowCount\": 1"), previewBody)
        assertTrue(previewBody.contains("\"rowNumber\": 2"), previewBody)
        assertEquals(HttpStatusCode.Created, importResponse.status)
        assertTrue(importBody.contains("\"createdCount\": 1"), importBody)
        assertTrue(transactionsBody.contains("\"currency\": \"USD\""), transactionsBody)
        assertTrue(transactionsBody.contains("\"fxRateToPln\": \"3.9876\""), transactionsBody)
        assertTrue(transactionsBody.contains("\"quantity\": \"3.5\""), transactionsBody)
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
                  "baseCurrency": "USD"
                }
                """.trimIndent()
            )
        }
        return Regex("\"id\":\\s*\"([^\"]+)\"").find(response.bodyAsText())!!.groupValues[1]
    }

    private suspend fun io.ktor.server.testing.ApplicationTestBuilder.createInstrument(
        name: String,
        symbol: String,
        currency: String
    ): String {
        val response = client.post("/v1/instruments") {
            contentType(ContentType.Application.Json)
            setBody(
                """
                {
                  "name": "$name",
                  "kind": "ETF",
                  "assetClass": "EQUITIES",
                  "symbol": "$symbol",
                  "currency": "$currency",
                  "valuationSource": "STOCK_ANALYST"
                }
                """.trimIndent()
            )
        }
        return Regex("\"id\":\\s*\"([^\"]+)\"").find(response.bodyAsText())!!.groupValues[1]
    }

    private fun jsonString(value: String): String = buildString {
        append('"')
        value.forEach { char ->
            when (char) {
                '\\' -> append("\\\\")
                '"' -> append("\\\"")
                '\n' -> append("\\n")
                '\r' -> append("\\r")
                '\t' -> append("\\t")
                else -> append(char)
            }
        }
        append('"')
    }
}
