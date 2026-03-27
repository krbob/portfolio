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
                  "csv": ${jsonString(csv)},
                  "sourceFileName": "ibkr-activity-2026-03.csv",
                  "sourceLabel": "IBKR March 2026 export"
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
                  "csv": ${jsonString(csv)},
                  "sourceFileName": "ibkr-activity-2026-03.csv",
                  "sourceLabel": "IBKR March 2026 export"
                }
                """.trimIndent()
            )
        }
        val transactionsResponse = client.get("/v1/transactions")
        val auditResponse = client.get("/v1/portfolio/audit/events?limit=5&category=IMPORTS")
        val previewBody = previewResponse.bodyAsText()
        val importBody = importResponse.bodyAsText()
        val transactionsBody = transactionsResponse.bodyAsText()
        val auditBody = auditResponse.bodyAsText()

        assertEquals(HttpStatusCode.OK, previewResponse.status)
        assertTrue(previewBody.contains("\"importableRowCount\": 1"), previewBody)
        assertTrue(previewBody.contains("\"duplicateExistingCount\": 0"), previewBody)
        assertTrue(previewBody.contains("\"duplicateBatchCount\": 0"), previewBody)
        assertTrue(previewBody.contains("\"rowNumber\": 2"), previewBody)
        assertEquals(HttpStatusCode.Created, importResponse.status)
        assertTrue(importBody.contains("\"createdCount\": 1"), importBody)
        assertTrue(transactionsBody.contains("\"currency\": \"USD\""), transactionsBody)
        assertTrue(transactionsBody.contains("\"fxRateToPln\": \"3.9876\""), transactionsBody)
        assertTrue(transactionsBody.contains("\"quantity\": \"3.5\""), transactionsBody)
        assertTrue(auditBody.contains("\"sourceFileName\": \"ibkr-activity-2026-03.csv\""), auditBody)
        assertTrue(auditBody.contains("\"sourceLabel\": \"IBKR March 2026 export\""), auditBody)
        assertTrue(auditBody.contains("\"profileName\": \"IBKR activity export\""), auditBody)
    }

    @Test
    fun `csv preview exposes duplicate breakdown`() = testApplication {
        application {
            module()
        }

        val accountId = createAccount("Degiro")
        createInstrument(name = "Vanguard FTSE All-World UCITS ETF", symbol = "VWRA.L", currency = "USD")

        val profileResponse = client.post("/v1/transactions/import/profiles") {
            contentType(ContentType.Application.Json)
            setBody(
                """
                {
                  "name": "Degiro export",
                  "delimiter": "COMMA",
                  "dateFormat": "ISO_LOCAL_DATE",
                  "decimalSeparator": "DOT",
                  "skipDuplicatesByDefault": true,
                  "headerMappings": {
                    "account": null,
                    "type": "type",
                    "tradeDate": "tradeDate",
                    "settlementDate": null,
                    "instrument": "instrument",
                    "quantity": "quantity",
                    "unitPrice": "unitPrice",
                    "grossAmount": "grossAmount",
                    "feeAmount": "feeAmount",
                    "taxAmount": null,
                    "currency": null,
                    "fxRateToPln": null,
                    "notes": null
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
            type,tradeDate,instrument,quantity,unitPrice,grossAmount,feeAmount
            BUY,2026-03-10,VWRA.L,1.5,120.10,180.15,0.80
            BUY,2026-03-10,VWRA.L,1.5,120.10,180.15,0.80
            BUY,2026-03-11,UNKNOWN,1,50.00,50.00,0
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
        val previewBody = previewResponse.bodyAsText()

        assertEquals(HttpStatusCode.OK, previewResponse.status)
        assertTrue(previewBody.contains("\"totalRowCount\": 3"), previewBody)
        assertTrue(previewBody.contains("\"importableRowCount\": 1"), previewBody)
        assertTrue(previewBody.contains("\"duplicateRowCount\": 1"), previewBody)
        assertTrue(previewBody.contains("\"duplicateExistingCount\": 0"), previewBody)
        assertTrue(previewBody.contains("\"duplicateBatchCount\": 1"), previewBody)
        assertTrue(previewBody.contains("\"invalidRowCount\": 1"), previewBody)
        assertTrue(previewBody.contains("\"status\": \"DUPLICATE_BATCH\""), previewBody)
        assertTrue(previewBody.contains("\"status\": \"INVALID\""), previewBody)
    }

    @Test
    fun `import profile names must stay unique`() = testApplication {
        application {
            module()
        }

        val accountId = createAccount("Primary import account")
        val firstProfileResponse = client.post("/v1/transactions/import/profiles") {
            contentType(ContentType.Application.Json)
            setBody(
                """
                {
                  "name": "Canonical import",
                  "description": "First profile",
                  "delimiter": "COMMA",
                  "dateFormat": "ISO_LOCAL_DATE",
                  "decimalSeparator": "DOT",
                  "skipDuplicatesByDefault": true,
                  "defaults": {
                    "accountId": "$accountId",
                    "currency": "USD"
                  }
                }
                """.trimIndent()
            )
        }
        val secondProfileResponse = client.post("/v1/transactions/import/profiles") {
            contentType(ContentType.Application.Json)
            setBody(
                """
                {
                  "name": "Aux import",
                  "description": "Second profile",
                  "delimiter": "COMMA",
                  "dateFormat": "ISO_LOCAL_DATE",
                  "decimalSeparator": "DOT",
                  "skipDuplicatesByDefault": true,
                  "defaults": {
                    "accountId": "$accountId",
                    "currency": "USD"
                  }
                }
                """.trimIndent()
            )
        }
        val secondProfileId = Regex("\"id\":\\s*\"([^\"]+)\"").find(secondProfileResponse.bodyAsText())!!.groupValues[1]

        val duplicateCreateResponse = client.post("/v1/transactions/import/profiles") {
            contentType(ContentType.Application.Json)
            setBody(
                """
                {
                  "name": "Canonical import",
                  "description": "Conflicting profile",
                  "delimiter": "SEMICOLON",
                  "dateFormat": "DMY_DOTS",
                  "decimalSeparator": "COMMA",
                  "skipDuplicatesByDefault": false,
                  "defaults": {
                    "accountId": "$accountId",
                    "currency": "USD"
                  }
                }
                """.trimIndent()
            )
        }
        val duplicateUpdateResponse = client.put("/v1/transactions/import/profiles/$secondProfileId") {
            contentType(ContentType.Application.Json)
            setBody(
                """
                {
                  "name": "Canonical import",
                  "description": "Conflicting rename",
                  "delimiter": "COMMA",
                  "dateFormat": "ISO_LOCAL_DATE",
                  "decimalSeparator": "DOT",
                  "skipDuplicatesByDefault": true,
                  "defaults": {
                    "accountId": "$accountId",
                    "currency": "USD"
                  }
                }
                """.trimIndent()
            )
        }

        assertEquals(HttpStatusCode.Created, firstProfileResponse.status)
        assertEquals(HttpStatusCode.Created, secondProfileResponse.status)
        assertEquals(HttpStatusCode.BadRequest, duplicateCreateResponse.status)
        assertTrue(duplicateCreateResponse.bodyAsText().contains("already in use"))
        assertEquals(HttpStatusCode.BadRequest, duplicateUpdateResponse.status)
        assertTrue(duplicateUpdateResponse.bodyAsText().contains("already in use"))
    }

    @Test
    fun `csv preview rejects ambiguous account and instrument lookups`() = testApplication {
        application {
            module()
        }

        val duplicateAccountA = createAccount("IBKR")
        createAccount("IBKR")
        createInstrument(name = "Vanguard FTSE All-World UCITS ETF A", symbol = "VWRA.L", currency = "USD")
        createInstrument(name = "Vanguard FTSE All-World UCITS ETF B", symbol = "VWRA.L", currency = "USD")

        val profileResponse = client.post("/v1/transactions/import/profiles") {
            contentType(ContentType.Application.Json)
            setBody(
                """
                {
                  "name": "Explicit account mapping",
                  "delimiter": "COMMA",
                  "dateFormat": "ISO_LOCAL_DATE",
                  "decimalSeparator": "DOT",
                  "skipDuplicatesByDefault": true,
                  "headerMappings": {
                    "account": "account",
                    "type": "type",
                    "tradeDate": "tradeDate",
                    "settlementDate": null,
                    "instrument": "instrument",
                    "quantity": "quantity",
                    "unitPrice": "unitPrice",
                    "grossAmount": "grossAmount",
                    "feeAmount": "feeAmount",
                    "taxAmount": null,
                    "currency": "currency",
                    "fxRateToPln": null,
                    "notes": null
                  },
                  "defaults": {
                    "accountId": null,
                    "currency": null
                  }
                }
                """.trimIndent()
            )
        }
        val profileId = Regex("\"id\":\\s*\"([^\"]+)\"").find(profileResponse.bodyAsText())!!.groupValues[1]
        val csv = """
            account,type,tradeDate,instrument,quantity,unitPrice,grossAmount,feeAmount,currency
            IBKR,BUY,2026-03-10,VWRA.L,1,100.00,100.00,0,USD
            $duplicateAccountA,BUY,2026-03-11,VWRA.L,1,101.00,101.00,0,USD
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
        val previewBody = previewResponse.bodyAsText()
        val importBody = importResponse.bodyAsText()

        assertEquals(HttpStatusCode.OK, previewResponse.status)
        assertTrue(previewBody.contains("\"totalRowCount\": 2"), previewBody)
        assertTrue(previewBody.contains("\"invalidRowCount\": 2"), previewBody)
        assertTrue(previewBody.contains("account 'IBKR' is ambiguous"), previewBody)
        assertTrue(previewBody.contains("instrument 'VWRA.L' is ambiguous"), previewBody)
        assertEquals(HttpStatusCode.BadRequest, importResponse.status)
        assertTrue(importBody.contains("ambiguous"), importBody)
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
