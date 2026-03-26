package net.bobinski.portfolio.api

import io.ktor.client.request.get
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.server.testing.testApplication
import java.nio.file.Files
import java.nio.file.Path
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class PortfolioStateRouteTest {

    @Test
    fun `portfolio state preview summarizes valid snapshot`() = testApplication {
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
        createTargets(
            """
            {
              "items": [
                { "assetClass": "EQUITIES", "targetWeight": "0.80" },
                { "assetClass": "BONDS", "targetWeight": "0.20" }
              ]
            }
            """.trimIndent()
        )
        saveBenchmarkSettings()
        saveRebalancingSettings()
        createImportProfile(accountId)

        val exportResponse = client.get("/v1/portfolio/state/export")
        val previewResponse = client.post("/v1/portfolio/state/preview") {
            contentType(ContentType.Application.Json)
            setBody(
                """
                {
                  "mode": "REPLACE",
                  "confirmation": "REPLACE",
                  "snapshot": ${exportResponse.bodyAsText()}
                }
                """.trimIndent()
            )
        }

        assertEquals(HttpStatusCode.OK, previewResponse.status)
        assertTrue(previewResponse.bodyAsText().contains("\"isValid\": true"))
        assertTrue(previewResponse.bodyAsText().contains("\"snapshotAppPreferenceCount\": 2"))
        assertTrue(previewResponse.bodyAsText().contains("\"existingAppPreferenceCount\": 2"))
        assertTrue(previewResponse.bodyAsText().contains("\"snapshotTargetCount\": 2"))
        assertTrue(previewResponse.bodyAsText().contains("\"existingTargetCount\": 2"))
        assertTrue(previewResponse.bodyAsText().contains("\"snapshotTransactionCount\": 2"))
        assertTrue(previewResponse.bodyAsText().contains("\"existingTransactionCount\": 2"))
        assertTrue(previewResponse.bodyAsText().contains("\"snapshotImportProfileCount\": 1"))
        assertTrue(previewResponse.bodyAsText().contains("\"existingImportProfileCount\": 1"))
    }

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
        createTargets(
            """
            {
              "items": [
                { "assetClass": "EQUITIES", "targetWeight": "0.80" },
                { "assetClass": "BONDS", "targetWeight": "0.20" }
              ]
            }
            """.trimIndent()
        )
        saveBenchmarkSettings()
        saveRebalancingSettings()
        createImportProfile(accountId)

        val exportResponse = client.get("/v1/portfolio/state/export")
        val importResponse = client.post("/v1/portfolio/state/import") {
            contentType(ContentType.Application.Json)
            setBody(
                """
                {
                  "mode": "REPLACE",
                  "confirmation": "REPLACE",
                  "snapshot": ${exportResponse.bodyAsText()}
                }
                """.trimIndent()
            )
        }
        val transactionsResponse = client.get("/v1/transactions")
        val benchmarkSettingsResponse = client.get("/v1/portfolio/benchmark-settings")
        val rebalancingSettingsResponse = client.get("/v1/portfolio/rebalancing-settings")
        val importProfilesResponse = client.get("/v1/transactions/import/profiles")

        assertEquals(HttpStatusCode.OK, exportResponse.status)
        assertTrue(exportResponse.bodyAsText().contains("\"schemaVersion\": 4"))
        assertTrue(exportResponse.bodyAsText().contains("\"appPreferences\": ["))
        assertTrue(exportResponse.bodyAsText().contains("\"targets\": ["))
        assertTrue(exportResponse.bodyAsText().contains("\"importProfiles\": ["))
        assertTrue(exportResponse.bodyAsText().contains("\"name\": \"Primary\""))
        assertTrue(exportResponse.bodyAsText().contains("\"displayOrder\": 0"))
        assertEquals(HttpStatusCode.OK, importResponse.status)
        assertTrue(importResponse.bodyAsText().contains("\"mode\": \"REPLACE\""))
        assertTrue(importResponse.bodyAsText().contains("\"appPreferenceCount\": 2"))
        assertTrue(importResponse.bodyAsText().contains("\"targetCount\": 2"))
        assertTrue(importResponse.bodyAsText().contains("\"transactionCount\": 2"))
        assertTrue(importResponse.bodyAsText().contains("\"importProfileCount\": 1"))
        assertTrue(importResponse.bodyAsText().contains("\"safetyBackupFileName\": \"portfolio-backup-"))
        assertTrue(transactionsResponse.bodyAsText().contains("\"type\": \"BUY\""))
        assertTrue(benchmarkSettingsResponse.bodyAsText().contains("\"customSymbol\": \"EXSA.DE\""))
        assertTrue(rebalancingSettingsResponse.bodyAsText().contains("\"mode\": \"ALLOW_TRIMS\""))
        assertTrue(importProfilesResponse.bodyAsText().contains("\"name\": \"Interactive Brokers CSV\""))
    }

    @Test
    fun `portfolio state import preserves fx rates on foreign-currency transactions`() = testApplication {
        application {
            module()
        }

        val accountId = createAccount(name = "Primary")
        val instrumentId = createInstrument(name = "VWRA", symbol = "VWRA.L", currency = "USD")
        createTransaction(
            """
            {
              "accountId": "$accountId",
              "type": "DEPOSIT",
              "tradeDate": "2026-03-01",
              "settlementDate": "2026-03-01",
              "grossAmount": "1000.00",
              "currency": "USD",
              "fxRateToPln": "3.98760000"
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
              "currency": "USD",
              "fxRateToPln": "3.99550000"
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
                  "confirmation": "REPLACE",
                  "snapshot": ${exportResponse.bodyAsText()}
                }
                """.trimIndent()
            )
        }
        val transactionsResponse = client.get("/v1/transactions")

        assertEquals(HttpStatusCode.OK, exportResponse.status)
        assertEquals(HttpStatusCode.OK, importResponse.status)
        assertTrue(transactionsResponse.bodyAsText().contains("\"fxRateToPln\": \"3.98760000\""))
        assertTrue(transactionsResponse.bodyAsText().contains("\"fxRateToPln\": \"3.99550000\""))
    }

    @Test
    fun `demo portfolio snapshot imports without losing foreign exchange data`() = testApplication {
        application {
            module()
        }

        val fixture = Files.readString(
            Path.of("..", "..", "demo", "demo-portfolio-import.json").normalize()
        )

        val importResponse = client.post("/v1/portfolio/state/import") {
            contentType(ContentType.Application.Json)
            setBody(fixture)
        }
        val overviewResponse = client.get("/v1/portfolio/overview")
        val holdingsResponse = client.get("/v1/portfolio/holdings")
        val transactionsResponse = client.get("/v1/transactions")

        assertEquals(HttpStatusCode.OK, importResponse.status)
        assertTrue(overviewResponse.bodyAsText().contains("\"totalBookValuePln\": \"104736.00\""))
        assertTrue(overviewResponse.bodyAsText().contains("\"missingFxTransactions\": 0"))
        assertTrue(holdingsResponse.bodyAsText().contains("\"instrumentName\": \"Vanguard FTSE All-World UCITS ETF\""))
        assertTrue(holdingsResponse.bodyAsText().contains("\"kind\": \"BOND_EDO\""))
        assertTrue(transactionsResponse.bodyAsText().contains("\"fxRateToPln\": \"3.99000000\""))
        assertTrue(transactionsResponse.bodyAsText().contains("\"fxRateToPln\": \"3.95500000\""))
    }

    @Test
    fun `replace import requires explicit confirmation`() = testApplication {
        application {
            module()
        }

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

        assertEquals(HttpStatusCode.BadRequest, importResponse.status)
        assertTrue(importResponse.bodyAsText().contains("REPLACE operations require confirmation"))
    }

    @Test
    fun `portfolio state preview rejects missing transaction references`() = testApplication {
        application {
            module()
        }

        val previewResponse = client.post("/v1/portfolio/state/preview") {
            contentType(ContentType.Application.Json)
            setBody(
                """
                {
                  "mode": "REPLACE",
                  "snapshot": {
                    "schemaVersion": 4,
                    "exportedAt": "2026-03-13T18:00:00Z",
                    "accounts": [],
                    "appPreferences": [],
                    "instruments": [],
                    "targets": [],
                    "importProfiles": [],
                    "transactions": [
                      {
                        "id": "11111111-1111-1111-1111-111111111111",
                        "accountId": "22222222-2222-2222-2222-222222222222",
                        "instrumentId": null,
                        "type": "DEPOSIT",
                        "tradeDate": "2026-03-01",
                        "settlementDate": "2026-03-01",
                        "quantity": null,
                        "unitPrice": null,
                        "grossAmount": "1000.00",
                        "feeAmount": "0.00",
                        "taxAmount": "0.00",
                        "currency": "PLN",
                        "fxRateToPln": null,
                        "notes": "",
                        "createdAt": "2026-03-13T18:00:00Z",
                        "updatedAt": "2026-03-13T18:00:00Z"
                      }
                    ]
                  }
                }
                """.trimIndent()
            )
        }

        assertEquals(HttpStatusCode.OK, previewResponse.status)
        assertTrue(previewResponse.bodyAsText().contains("\"isValid\": false"))
        assertTrue(previewResponse.bodyAsText().contains("\"blockingIssueCount\": 1"))
        assertTrue(previewResponse.bodyAsText().contains("TRANSACTION_ACCOUNT_MISSING"))
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

    private suspend fun io.ktor.server.testing.ApplicationTestBuilder.createInstrument(
        name: String,
        symbol: String = "VWCE.DE",
        currency: String = "EUR"
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

    private suspend fun io.ktor.server.testing.ApplicationTestBuilder.createTransaction(body: String) {
        val response = client.post("/v1/transactions") {
            contentType(ContentType.Application.Json)
            setBody(body)
        }
        assertEquals(HttpStatusCode.Created, response.status)
    }

    private suspend fun io.ktor.server.testing.ApplicationTestBuilder.createTargets(body: String) {
        val response = client.post("/v1/portfolio/targets") {
            contentType(ContentType.Application.Json)
            setBody(body)
        }
        assertEquals(HttpStatusCode.OK, response.status)
    }

    private suspend fun io.ktor.server.testing.ApplicationTestBuilder.saveBenchmarkSettings() {
        val response = client.post("/v1/portfolio/benchmark-settings") {
            contentType(ContentType.Application.Json)
            setBody(
                """
                {
                  "enabledKeys": ["VWRA", "TARGET_MIX", "CUSTOM"],
                  "pinnedKeys": ["VWRA", "CUSTOM"],
                  "customLabel": "Europe 600",
                  "customSymbol": "EXSA.DE"
                }
                """.trimIndent()
            )
        }
        assertEquals(HttpStatusCode.OK, response.status)
    }

    private suspend fun io.ktor.server.testing.ApplicationTestBuilder.saveRebalancingSettings() {
        val response = client.post("/v1/portfolio/rebalancing-settings") {
            contentType(ContentType.Application.Json)
            setBody(
                """
                {
                  "toleranceBandPctPoints": "3.50",
                  "mode": "ALLOW_TRIMS"
                }
                """.trimIndent()
            )
        }
        assertEquals(HttpStatusCode.OK, response.status)
    }

    private suspend fun io.ktor.server.testing.ApplicationTestBuilder.createImportProfile(accountId: String) {
        val response = client.post("/v1/transactions/import/profiles") {
            contentType(ContentType.Application.Json)
            setBody(
                """
                {
                  "name": "Interactive Brokers CSV",
                  "description": "Primary import profile",
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
        assertEquals(HttpStatusCode.Created, response.status)
    }
}
