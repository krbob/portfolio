package net.bobinski.portfolio.api

import io.ktor.client.request.get
import io.ktor.client.request.post
import io.ktor.client.request.put
import io.ktor.client.request.delete
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
                  "name": "EDO0735",
                  "kind": "BOND_EDO",
                  "assetClass": "BONDS",
                  "currency": "PLN",
                  "valuationSource": "EDO_CALCULATOR",
                  "edoTerms": {
                    "seriesMonth": "2025-07",
                    "firstPeriodRateBps": 650,
                    "marginBps": 200
                  }
                }
                """.trimIndent()
            )
        }

        assertEquals(HttpStatusCode.Created, response.status)
        assertTrue(response.bodyAsText().contains("\"kind\": \"BOND_EDO\""))
        assertTrue(response.bodyAsText().contains("\"seriesMonth\": \"2025-07\""))
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

    @Test
    fun `edo redemptions require REDEEM instead of SELL`() = testApplication {
        application {
            module()
        }

        val accountId = createAccount()
        val instrumentId = createEdoInstrument()

        val redeemResponse = client.post("/v1/transactions") {
            contentType(ContentType.Application.Json)
            setBody(
                """
                {
                  "accountId": "$accountId",
                  "instrumentId": "$instrumentId",
                  "type": "REDEEM",
                  "tradeDate": "2026-03-10",
                  "settlementDate": "2026-03-10",
                  "quantity": "10",
                  "unitPrice": "108.00",
                  "grossAmount": "1080.00",
                  "taxAmount": "15.20",
                  "currency": "PLN"
                }
                """.trimIndent()
            )
        }

        val sellResponse = client.post("/v1/transactions") {
            contentType(ContentType.Application.Json)
            setBody(
                """
                {
                  "accountId": "$accountId",
                  "instrumentId": "$instrumentId",
                  "type": "SELL",
                  "tradeDate": "2026-03-10",
                  "settlementDate": "2026-03-10",
                  "quantity": "10",
                  "unitPrice": "108.00",
                  "grossAmount": "1080.00",
                  "taxAmount": "15.20",
                  "currency": "PLN"
                }
                """.trimIndent()
            )
        }

        assertEquals(HttpStatusCode.Created, redeemResponse.status)
        assertTrue(redeemResponse.bodyAsText().contains("\"type\": \"REDEEM\""))
        assertEquals(HttpStatusCode.BadRequest, sellResponse.status)
        assertTrue(sellResponse.bodyAsText().contains("Use REDEEM instead of SELL for EDO instruments."))
    }

    @Test
    fun `transactions accept decimal commas`() = testApplication {
        application {
            module()
        }

        val accountId = createAccount()
        val instrumentId = createEtfInstrument()

        val response = client.post("/v1/transactions") {
            contentType(ContentType.Application.Json)
            setBody(
                """
                {
                  "accountId": "$accountId",
                  "instrumentId": "$instrumentId",
                  "type": "BUY",
                  "tradeDate": "2026-03-10",
                  "settlementDate": "2026-03-10",
                  "quantity": "2",
                  "unitPrice": "123,45",
                  "grossAmount": "246,90",
                  "feeAmount": "1,20",
                  "taxAmount": "0,00",
                  "currency": "USD",
                  "fxRateToPln": "4,0321"
                }
                """.trimIndent()
            )
        }

        assertEquals(HttpStatusCode.Created, response.status)
        assertTrue(response.bodyAsText().contains("\"unitPrice\": \"123.45\""))
        assertTrue(response.bodyAsText().contains("\"grossAmount\": \"246.90\""))
        assertTrue(response.bodyAsText().contains("\"feeAmount\": \"1.20\""))
        assertTrue(response.bodyAsText().contains("\"fxRateToPln\": \"4.0321\""))
    }

    @Test
    fun `transactions can be updated and deleted`() = testApplication {
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

        val createResponse = client.post("/v1/transactions") {
            contentType(ContentType.Application.Json)
            setBody(
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
        }
        val transactionId = Regex("\"id\":\\s*\"([^\"]+)\"").find(createResponse.bodyAsText())!!.groupValues[1]

        val updateResponse = client.put("/v1/transactions/$transactionId") {
            contentType(ContentType.Application.Json)
            setBody(
                """
                {
                  "accountId": "$accountId",
                  "type": "DEPOSIT",
                  "tradeDate": "2026-03-02",
                  "settlementDate": "2026-03-02",
                  "grossAmount": "1250.00",
                  "currency": "PLN",
                  "notes": "Adjusted"
                }
                """.trimIndent()
            )
        }
        val deleteResponse = client.delete("/v1/transactions/$transactionId")
        val listResponse = client.get("/v1/transactions")

        assertEquals(HttpStatusCode.OK, updateResponse.status)
        assertTrue(updateResponse.bodyAsText().contains("\"grossAmount\": \"1250.00\""))
        assertTrue(updateResponse.bodyAsText().contains("\"notes\": \"Adjusted\""))
        assertEquals(HttpStatusCode.NoContent, deleteResponse.status)
        assertEquals("[]", listResponse.bodyAsText())
    }

    @Test
    fun `transactions can be imported in bulk`() = testApplication {
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

        val response = client.post("/v1/transactions/import") {
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
                    },
                    {
                      "accountId": "$accountId",
                      "type": "DEPOSIT",
                      "tradeDate": "2026-03-02",
                      "settlementDate": "2026-03-02",
                      "grossAmount": "250.00",
                      "currency": "PLN",
                      "notes": "second row"
                    }
                  ]
                }
                """.trimIndent()
            )
        }
        val listResponse = client.get("/v1/transactions")

        assertEquals(HttpStatusCode.Created, response.status)
        assertTrue(response.bodyAsText().contains("\"createdCount\": 2"))
        assertTrue(response.bodyAsText().contains("\"skippedDuplicateCount\": 0"))
        assertTrue(listResponse.bodyAsText().contains("\"notes\": \"second row\""))
    }

    @Test
    fun `transaction import preview flags duplicates and import skips them by default`() = testApplication {
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

        client.post("/v1/transactions") {
            contentType(ContentType.Application.Json)
            setBody(
                """
                {
                  "accountId": "$accountId",
                  "type": "DEPOSIT",
                  "tradeDate": "2026-03-01",
                  "settlementDate": "2026-03-01",
                  "grossAmount": "1000.00",
                  "currency": "PLN",
                  "notes": "existing"
                }
                """.trimIndent()
            )
        }

        val previewResponse = client.post("/v1/transactions/import/preview") {
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
                      "currency": "PLN",
                      "notes": "existing"
                    },
                    {
                      "accountId": "$accountId",
                      "type": "DEPOSIT",
                      "tradeDate": "2026-03-02",
                      "settlementDate": "2026-03-02",
                      "grossAmount": "250.00",
                      "currency": "PLN",
                      "notes": "batch duplicate"
                    },
                    {
                      "accountId": "$accountId",
                      "type": "DEPOSIT",
                      "tradeDate": "2026-03-02",
                      "settlementDate": "2026-03-02",
                      "grossAmount": "250.00",
                      "currency": "PLN",
                      "notes": "batch duplicate"
                    }
                  ]
                }
                """.trimIndent()
            )
        }

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
                      "currency": "PLN",
                      "notes": "existing"
                    },
                    {
                      "accountId": "$accountId",
                      "type": "DEPOSIT",
                      "tradeDate": "2026-03-02",
                      "settlementDate": "2026-03-02",
                      "grossAmount": "250.00",
                      "currency": "PLN",
                      "notes": "batch duplicate"
                    },
                    {
                      "accountId": "$accountId",
                      "type": "DEPOSIT",
                      "tradeDate": "2026-03-02",
                      "settlementDate": "2026-03-02",
                      "grossAmount": "250.00",
                      "currency": "PLN",
                      "notes": "batch duplicate"
                    }
                  ]
                }
                """.trimIndent()
            )
        }
        val listResponse = client.get("/v1/transactions")

        assertEquals(HttpStatusCode.OK, previewResponse.status)
        assertTrue(previewResponse.bodyAsText().contains("\"duplicateRowCount\": 2"))
        assertTrue(previewResponse.bodyAsText().contains("\"status\": \"DUPLICATE_EXISTING\""))
        assertTrue(previewResponse.bodyAsText().contains("\"status\": \"DUPLICATE_BATCH\""))
        assertEquals(HttpStatusCode.Created, importResponse.status)
        assertTrue(importResponse.bodyAsText().contains("\"createdCount\": 1"))
        assertTrue(importResponse.bodyAsText().contains("\"skippedDuplicateCount\": 2"))
        assertTrue(listResponse.bodyAsText().contains("\"notes\": \"batch duplicate\""))
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

    private suspend fun io.ktor.server.testing.ApplicationTestBuilder.createEdoInstrument(): String {
        val response = client.post("/v1/instruments") {
            contentType(ContentType.Application.Json)
            setBody(
                """
                {
                  "name": "EDO0336",
                  "kind": "BOND_EDO",
                  "assetClass": "BONDS",
                  "currency": "PLN",
                  "valuationSource": "EDO_CALCULATOR",
                  "edoTerms": {
                    "seriesMonth": "2026-03",
                    "firstPeriodRateBps": 500,
                    "marginBps": 150
                  }
                }
                """.trimIndent()
            )
        }
        return Regex("\"id\":\\s*\"([^\"]+)\"").find(response.bodyAsText())!!.groupValues[1]
    }

    private suspend fun io.ktor.server.testing.ApplicationTestBuilder.createEtfInstrument(): String {
        val response = client.post("/v1/instruments") {
            contentType(ContentType.Application.Json)
            setBody(
                """
                {
                  "name": "VWRA",
                  "kind": "ETF",
                  "assetClass": "EQUITIES",
                  "symbol": "VWRA.L",
                  "currency": "USD",
                  "valuationSource": "STOCK_ANALYST"
                }
                """.trimIndent()
            )
        }
        return Regex("\"id\":\\s*\"([^\"]+)\"").find(response.bodyAsText())!!.groupValues[1]
    }
}
