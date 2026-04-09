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
import org.junit.jupiter.api.Assertions.assertFalse
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
        assertEquals(HttpStatusCode.OK, importResponse.status)
        assertTrue(importResponse.bodyAsText().contains("\"mode\": \"REPLACE\""))
        assertTrue(importResponse.bodyAsText().contains("\"appPreferenceCount\": 2"))
        assertTrue(importResponse.bodyAsText().contains("\"targetCount\": 2"))
        assertTrue(importResponse.bodyAsText().contains("\"transactionCount\": 2"))
        assertTrue(importResponse.bodyAsText().contains("\"importProfileCount\": 1"))
        assertTrue(importResponse.bodyAsText().contains("\"safetyBackupFileName\": \"portfolio-backup-"))
        assertTrue(transactionsResponse.bodyAsText().contains("\"type\": \"BUY\""))
        assertTrue(benchmarkSettingsResponse.bodyAsText().contains("\"customBenchmarks\""))
        assertTrue(benchmarkSettingsResponse.bodyAsText().contains("\"symbol\": \"EXSA.DE\""))
        assertTrue(rebalancingSettingsResponse.bodyAsText().contains("\"mode\": \"ALLOW_TRIMS\""))
        assertTrue(importProfilesResponse.bodyAsText().contains("\"name\": \"Interactive Brokers CSV\""))
    }

    @Test
    fun `merge import preserves targets when snapshot omits the targets section`() = testApplication {
        application {
            module()
        }

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

        val requestBody =
            """
            {
              "mode": "MERGE",
              "snapshot": {
                "schemaVersion": 4,
                "exportedAt": "2026-03-20T12:00:00Z",
                "accounts": [],
                "appPreferences": [],
                "instruments": [],
                "targets": [],
                "importProfiles": [],
                "transactions": []
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
        val targetsResponse = client.get("/v1/portfolio/targets")
        val previewBody = previewResponse.bodyAsText()
        val importBody = importResponse.bodyAsText()
        val targetsBody = targetsResponse.bodyAsText()

        assertEquals(HttpStatusCode.OK, previewResponse.status, previewBody)
        assertTrue(previewBody.contains("\"isValid\": true"), previewBody)
        assertTrue(previewBody.contains("\"code\": \"TARGETS_SECTION_SKIPPED\""), previewBody)
        assertTrue(previewBody.contains("\"existingTargetCount\": 2"), previewBody)
        assertTrue(previewBody.contains("\"preservedCount\": 2"), previewBody)
        assertTrue(previewBody.contains("\"sectionSkipped\": true"), previewBody)
        assertEquals(HttpStatusCode.OK, importResponse.status)
        assertTrue(importBody.contains("\"mode\": \"MERGE\""), importBody)
        assertTrue(importBody.contains("\"targetCount\": 0"), importBody)
        assertTrue(targetsBody.contains("\"assetClass\": \"EQUITIES\""), targetsBody)
        assertTrue(targetsBody.contains("\"targetWeight\": \"0.800000\""), targetsBody)
        assertTrue(targetsBody.contains("\"assetClass\": \"BONDS\""), targetsBody)
        assertTrue(targetsBody.contains("\"targetWeight\": \"0.200000\""), targetsBody)
    }

    @Test
    fun `merge import replaces targets when snapshot includes the targets section`() = testApplication {
        application {
            module()
        }

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

        val requestBody =
            """
            {
              "mode": "MERGE",
              "snapshot": {
                "schemaVersion": 4,
                "exportedAt": "2026-03-20T12:00:00Z",
                "accounts": [],
                "appPreferences": [],
                "instruments": [],
                "targets": [
                  {
                    "id": "11111111-1111-1111-1111-111111111111",
                    "assetClass": "EQUITIES",
                    "targetWeight": "0.60",
                    "createdAt": "2026-03-20T12:00:00Z",
                    "updatedAt": "2026-03-20T12:00:00Z"
                  },
                  {
                    "id": "22222222-2222-2222-2222-222222222222",
                    "assetClass": "CASH",
                    "targetWeight": "0.40",
                    "createdAt": "2026-03-20T12:00:00Z",
                    "updatedAt": "2026-03-20T12:00:00Z"
                  }
                ],
                "importProfiles": [],
                "transactions": []
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
        val targetsResponse = client.get("/v1/portfolio/targets")
        val previewBody = previewResponse.bodyAsText()
        val importBody = importResponse.bodyAsText()
        val targetsBody = targetsResponse.bodyAsText()

        assertEquals(HttpStatusCode.OK, previewResponse.status, previewBody)
        assertTrue(previewBody.contains("\"isValid\": true"), previewBody)
        assertTrue(previewBody.contains("\"code\": \"TARGETS_SECTION_REPLACED\""), previewBody)
        assertTrue(previewBody.contains("\"createdCount\": 1"), previewBody)
        assertTrue(previewBody.contains("\"updatedCount\": 1"), previewBody)
        assertTrue(previewBody.contains("\"deletedCount\": 1"), previewBody)
        assertTrue(previewBody.contains("\"sectionSkipped\": false"), previewBody)
        assertEquals(HttpStatusCode.OK, importResponse.status, importBody)
        assertTrue(importBody.contains("\"targetCount\": 2"), importBody)
        assertTrue(
            Regex("\"assetClass\":\\s*\"EQUITIES\"[\\s\\S]*?\"targetWeight\":\\s*\"0\\.6(?:0+)?\"").containsMatchIn(targetsBody),
            targetsBody
        )
        assertTrue(
            Regex("\"assetClass\":\\s*\"CASH\"[\\s\\S]*?\"targetWeight\":\\s*\"0\\.4(?:0+)?\"").containsMatchIn(targetsBody),
            targetsBody
        )
        assertFalse(targetsBody.contains("\"assetClass\": \"BONDS\""), targetsBody)
    }

    @Test
    fun `portfolio state preview rejects duplicate target asset classes`() = testApplication {
        application {
            module()
        }

        val requestBody =
            """
            {
              "mode": "MERGE",
              "snapshot": {
                "schemaVersion": 4,
                "exportedAt": "2026-03-20T12:00:00Z",
                "accounts": [],
                "appPreferences": [],
                "instruments": [],
                "targets": [
                  {
                    "id": "11111111-1111-1111-1111-111111111111",
                    "assetClass": "EQUITIES",
                    "targetWeight": "0.60",
                    "createdAt": "2026-03-20T12:00:00Z",
                    "updatedAt": "2026-03-20T12:00:00Z"
                  },
                  {
                    "id": "22222222-2222-2222-2222-222222222222",
                    "assetClass": "EQUITIES",
                    "targetWeight": "0.40",
                    "createdAt": "2026-03-20T12:00:00Z",
                    "updatedAt": "2026-03-20T12:00:00Z"
                  }
                ],
                "importProfiles": [],
                "transactions": []
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
        assertTrue(previewBody.contains("\"TARGET_INVALID\""), previewBody)
        assertTrue(previewBody.contains("Each asset class can only appear once."), previewBody)
        assertEquals(HttpStatusCode.BadRequest, importResponse.status)
        assertTrue(importBody.contains("Each asset class can only appear once."), importBody)
    }

    @Test
    fun `portfolio state preview rejects duplicate import profile names after merge`() = testApplication {
        application {
            module()
        }

        val accountId = createAccount(name = "Primary")
        createImportProfile(accountId)
        val secondProfileResponse = client.post("/v1/transactions/import/profiles") {
            contentType(ContentType.Application.Json)
            setBody(
                """
                {
                  "name": "Secondary CSV",
                  "description": "Second import profile",
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
        assertEquals(HttpStatusCode.Created, secondProfileResponse.status)
        val exportedSnapshot = client.get("/v1/portfolio/state/export").bodyAsText()
        val duplicateNameSnapshot = exportedSnapshot.replace(
            "\"name\": \"Secondary CSV\"",
            "\"name\": \"Interactive Brokers CSV\""
        )

        val requestBody =
            """
            {
              "mode": "MERGE",
              "snapshot": $duplicateNameSnapshot
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
        assertTrue(previewBody.contains("\"IMPORT_PROFILE_NAME_DUPLICATE\""), previewBody)
        assertTrue(previewBody.contains("Interactive Brokers CSV"), previewBody)
        assertEquals(HttpStatusCode.BadRequest, importResponse.status)
        assertTrue(importBody.contains("Interactive Brokers CSV"), importBody)
    }

    @Test
    fun `merge import reports only incoming import profiles in the result count`() = testApplication {
        application {
            module()
        }

        val accountId = createAccount(name = "Primary")
        createImportProfile(accountId, name = "Primary CSV")
        val exportedSnapshot = client.get("/v1/portfolio/state/export").bodyAsText()
        createImportProfile(accountId, name = "Secondary CSV")

        val importResponse = client.post("/v1/portfolio/state/import") {
            contentType(ContentType.Application.Json)
            setBody(
                """
                {
                  "mode": "MERGE",
                  "snapshot": $exportedSnapshot
                }
                """.trimIndent()
            )
        }
        val importProfilesResponse = client.get("/v1/transactions/import/profiles")
        val importBody = importResponse.bodyAsText()
        val importProfilesBody = importProfilesResponse.bodyAsText()

        assertEquals(HttpStatusCode.OK, importResponse.status, importBody)
        assertTrue(importBody.contains("\"importProfileCount\": 1"), importBody)
        assertTrue(importProfilesBody.contains("\"name\": \"Primary CSV\""), importProfilesBody)
        assertTrue(importProfilesBody.contains("\"name\": \"Secondary CSV\""), importProfilesBody)
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
    fun `portfolio state import normalizes redundant fx rates on pln transactions`() = testApplication {
        application {
            module()
        }

        val importResponse = client.post("/v1/portfolio/state/import") {
            contentType(ContentType.Application.Json)
            setBody(
                """
                {
                  "mode": "REPLACE",
                  "confirmation": "REPLACE",
                  "snapshot": {
                    "schemaVersion": 4,
                    "exportedAt": "2026-03-13T18:00:00Z",
                    "accounts": [
                      {
                        "id": "11111111-1111-1111-1111-111111111111",
                        "name": "Primary",
                        "institution": "Broker",
                        "type": "BROKERAGE",
                        "baseCurrency": "PLN",
                        "displayOrder": 0,
                        "isActive": true,
                        "createdAt": "2026-03-13T18:00:00Z",
                        "updatedAt": "2026-03-13T18:00:00Z"
                      }
                    ],
                    "appPreferences": [],
                    "instruments": [],
                    "targets": [],
                    "importProfiles": [],
                    "transactions": [
                      {
                        "id": "22222222-2222-2222-2222-222222222222",
                        "accountId": "11111111-1111-1111-1111-111111111111",
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
                        "fxRateToPln": "4.0000",
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
        val transactionsResponse = client.get("/v1/transactions")
        val exportResponse = client.get("/v1/portfolio/state/export")

        assertEquals(HttpStatusCode.OK, importResponse.status)
        assertTrue(transactionsResponse.bodyAsText().contains("\"currency\": \"PLN\""))
        assertTrue(transactionsResponse.bodyAsText().contains("\"fxRateToPln\": null"))
        assertTrue(exportResponse.bodyAsText().contains("\"fxRateToPln\": null"))
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
                  "enabledKeys": ["VWRA", "TARGET_MIX", "CUSTOM_1"],
                  "pinnedKeys": ["VWRA", "CUSTOM_1"],
                  "customBenchmarks": [
                    {
                      "key": "CUSTOM_1",
                      "label": "Europe 600",
                      "symbol": "EXSA.DE"
                    }
                  ]
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

    private suspend fun io.ktor.server.testing.ApplicationTestBuilder.createImportProfile(
        accountId: String,
        name: String = "Interactive Brokers CSV"
    ) {
        val response = client.post("/v1/transactions/import/profiles") {
            contentType(ContentType.Application.Json)
            setBody(
                """
                {
                  "name": "$name",
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
