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

class PortfolioStateLedgerRouteTest {
    @Test
    fun `state preview and import reject a journal with a negative instrument position`() = testApplication {
        application { module() }
        val requestBody = """
            {
              "mode": "REPLACE",
              "confirmation": "REPLACE",
              "snapshot": {
                "schemaVersion": 4,
                "exportedAt": "2026-03-20T12:00:00Z",
                "accounts": [
                  {
                    "id": "11111111-1111-1111-1111-111111111111",
                    "name": "Primary",
                    "institution": "Broker",
                    "type": "BROKERAGE",
                    "baseCurrency": "PLN",
                    "displayOrder": 0,
                    "isActive": true,
                    "createdAt": "2026-03-20T12:00:00Z",
                    "updatedAt": "2026-03-20T12:00:00Z"
                  }
                ],
                "appPreferences": [],
                "instruments": [
                  {
                    "id": "22222222-2222-2222-2222-222222222222",
                    "name": "VWCE",
                    "kind": "ETF",
                    "assetClass": "EQUITIES",
                    "symbol": "VWCE.DE",
                    "currency": "EUR",
                    "valuationSource": "STOCK_ANALYST",
                    "edoTerms": null,
                    "isActive": true,
                    "createdAt": "2026-03-20T12:00:00Z",
                    "updatedAt": "2026-03-20T12:00:00Z"
                  }
                ],
                "targets": [],
                "importProfiles": [],
                "transactions": [
                  {
                    "id": "33333333-3333-3333-3333-333333333333",
                    "accountId": "11111111-1111-1111-1111-111111111111",
                    "instrumentId": "22222222-2222-2222-2222-222222222222",
                    "type": "SELL",
                    "tradeDate": "2026-03-01",
                    "settlementDate": "2026-03-01",
                    "quantity": "1",
                    "unitPrice": "100.00",
                    "grossAmount": "100.00",
                    "feeAmount": "0.00",
                    "taxAmount": "0.00",
                    "currency": "PLN",
                    "fxRateToPln": null,
                    "notes": "",
                    "createdAt": "2026-03-20T12:00:00Z",
                    "updatedAt": "2026-03-20T12:00:00Z"
                  }
                ]
              }
            }
        """.trimIndent()

        val previewResponse = client.post("/v1/portfolio/state/preview") {
            contentType(ContentType.Application.Json)
            setBody(requestBody)
        }
        val importResponse = client.post("/v1/portfolio/state/import") {
            contentType(ContentType.Application.Json)
            setBody(requestBody)
        }
        val previewBody = previewResponse.bodyAsText()
        val importBody = importResponse.bodyAsText()

        assertEquals(HttpStatusCode.OK, previewResponse.status, previewBody)
        assertTrue(previewBody.contains("\"isValid\": false"), previewBody)
        assertTrue(previewBody.contains("TRANSACTION_POSITION_NEGATIVE"), previewBody)
        assertTrue(previewBody.contains("available 0, requested 1"), previewBody)
        assertEquals(HttpStatusCode.BadRequest, importResponse.status)
        assertTrue(importBody.contains("Long-only portfolios"), importBody)
        assertEquals("[]", client.get("/v1/accounts").bodyAsText())
        assertEquals("[]", client.get("/v1/transactions").bodyAsText())
    }
}
