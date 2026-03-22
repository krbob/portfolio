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

class PortfolioReadModelRouteTest {

    @Test
    fun `overview aggregates cash and holdings on book basis`() = testApplication {
        application {
            module()
        }

        val accountId = createAccount()
        val instrumentId = createInstrument()
        createTransaction(
            """
            {
              "accountId": "$accountId",
              "type": "DEPOSIT",
              "tradeDate": "2026-03-01",
              "settlementDate": "2026-03-01",
              "grossAmount": "2000.00",
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
              "quantity": "10",
              "unitPrice": "100.00",
              "grossAmount": "1000.00",
              "feeAmount": "5.00",
              "taxAmount": "0",
              "currency": "PLN"
            }
            """.trimIndent()
        )

        val response = client.get("/v1/portfolio/overview")
        val body = response.bodyAsText()

        assertEquals(HttpStatusCode.OK, response.status)
        assertTrue(body.contains("\"valuationState\": \"BOOK_ONLY\""))
        assertTrue(body.contains("\"totalBookValuePln\": \"2000.00\""))
        assertTrue(body.contains("\"investedBookValuePln\": \"1005.00\""))
        assertTrue(body.contains("\"cashBalancePln\": \"995.00\""))
        assertTrue(body.contains("\"netContributionsPln\": \"2000.00\""))
        assertTrue(body.contains("\"activeHoldingCount\": 1"))
    }

    @Test
    fun `holdings use average cost and account grouping`() = testApplication {
        application {
            module()
        }

        val accountId = createAccount()
        val instrumentId = createInstrument()
        createTransaction(
            """
            {
              "accountId": "$accountId",
              "type": "DEPOSIT",
              "tradeDate": "2026-03-01",
              "settlementDate": "2026-03-01",
              "grossAmount": "2000.00",
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
              "quantity": "10",
              "unitPrice": "100.00",
              "grossAmount": "1000.00",
              "feeAmount": "5.00",
              "taxAmount": "0",
              "currency": "PLN"
            }
            """.trimIndent()
        )
        createTransaction(
            """
            {
              "accountId": "$accountId",
              "instrumentId": "$instrumentId",
              "type": "SELL",
              "tradeDate": "2026-03-05",
              "settlementDate": "2026-03-05",
              "quantity": "4",
              "unitPrice": "110.00",
              "grossAmount": "440.00",
              "feeAmount": "0",
              "taxAmount": "0",
              "currency": "PLN"
            }
            """.trimIndent()
        )

        val response = client.get("/v1/portfolio/holdings")
        val body = response.bodyAsText()

        assertEquals(HttpStatusCode.OK, response.status)
        assertTrue(body.contains("\"quantity\": \"6\""))
        assertTrue(body.contains("\"costBasisPln\": \"603.00\""))
        assertTrue(body.contains("\"averageCostPerUnitPln\": \"100.50\""))
        assertTrue(body.contains("\"transactionCount\": 2"))
    }

    @Test
    fun `overview reports transactions missing fx conversion when lookup fails`() = testApplication {
        application {
            module()
        }

        val accountId = createAccount(baseCurrency = "ZZZ")
        createTransaction(
            """
            {
              "accountId": "$accountId",
              "type": "DEPOSIT",
              "tradeDate": "2026-03-01",
              "settlementDate": "2026-03-01",
              "grossAmount": "100.00",
              "currency": "ZZZ"
            }
            """.trimIndent()
        )

        val response = client.get("/v1/portfolio/overview")
        val body = response.bodyAsText()

        assertEquals(HttpStatusCode.OK, response.status)
        assertTrue(body.contains("\"missingFxTransactions\": 1"))
    }

    @Test
    fun `allocation returns drift against configured targets`() = testApplication {
        application {
            module()
        }

        val accountId = createAccount()
        val equityInstrumentId = createInstrument()
        val bondInstrumentId = createBondInstrument()
        createTransaction(
            """
            {
              "accountId": "$accountId",
              "type": "DEPOSIT",
              "tradeDate": "2026-03-01",
              "settlementDate": "2026-03-01",
              "grossAmount": "10000.00",
              "currency": "PLN"
            }
            """.trimIndent()
        )
        createTransaction(
            """
            {
              "accountId": "$accountId",
              "instrumentId": "$equityInstrumentId",
              "type": "BUY",
              "tradeDate": "2026-03-02",
              "settlementDate": "2026-03-02",
              "quantity": "60",
              "unitPrice": "100.00",
              "grossAmount": "6000.00",
              "currency": "PLN"
            }
            """.trimIndent()
        )
        createTransaction(
            """
            {
              "accountId": "$accountId",
              "instrumentId": "$bondInstrumentId",
              "type": "BUY",
              "tradeDate": "2026-03-03",
              "settlementDate": "2026-03-03",
              "quantity": "20",
              "unitPrice": "100.00",
              "grossAmount": "2000.00",
              "currency": "PLN"
            }
            """.trimIndent()
        )

        val saveTargetsResponse = client.post("/v1/portfolio/targets") {
            contentType(ContentType.Application.Json)
            setBody(
                """
                {
                  "items": [
                    { "assetClass": "EQUITIES", "targetWeight": "0.80" },
                    { "assetClass": "BONDS", "targetWeight": "0.20" },
                    { "assetClass": "CASH", "targetWeight": "0.00" }
                  ]
                }
                """.trimIndent()
            )
        }
        assertEquals(HttpStatusCode.OK, saveTargetsResponse.status)

        val response = client.get("/v1/portfolio/allocation")
        val body = response.bodyAsText()

        assertEquals(HttpStatusCode.OK, response.status)
        assertTrue(body.contains("\"configured\": true"))
        assertTrue(body.contains("\"toleranceBandPctPoints\": \"5.00\""))
        assertTrue(body.contains("\"rebalancingMode\": \"CONTRIBUTIONS_ONLY\""))
        assertTrue(body.contains("\"recommendedAction\": \"DEPLOY_EXISTING_CASH\""))
        assertTrue(body.contains("\"targetWeightSumPct\": \"100.00\""))
        assertTrue(body.contains("\"suggestedContributionPln\": \"2000.00\""))
        assertTrue(body.contains("\"rebalanceAction\": \"BUY\""))
        assertTrue(body.contains("\"status\": \"UNDERWEIGHT\""))
    }

    @Test
    fun `benchmark settings can be saved and read back`() = testApplication {
        application {
            module()
        }

        val saveResponse = client.post("/v1/portfolio/benchmark-settings") {
            contentType(ContentType.Application.Json)
            setBody(
                """
                {
                  "enabledKeys": ["VWRA", "CUSTOM"],
                  "pinnedKeys": ["CUSTOM"],
                  "customLabel": "Europe 600",
                  "customSymbol": "EXSA.DE"
                }
                """.trimIndent()
            )
        }
        val listResponse = client.get("/v1/portfolio/benchmark-settings")
        val body = listResponse.bodyAsText()

        assertEquals(HttpStatusCode.OK, saveResponse.status)
        assertEquals(HttpStatusCode.OK, listResponse.status)
        assertTrue(body.contains("\"enabledKeys\": ["))
        assertTrue(body.contains("\"CUSTOM\""))
        assertTrue(body.contains("\"customLabel\": \"Europe 600\""))
        assertTrue(body.contains("\"customSymbol\": \"EXSA.DE\""))
    }

    @Test
    fun `rebalancing settings can be saved and read back`() = testApplication {
        application {
            module()
        }

        val saveResponse = client.post("/v1/portfolio/rebalancing-settings") {
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
        val listResponse = client.get("/v1/portfolio/rebalancing-settings")
        val body = listResponse.bodyAsText()

        assertEquals(HttpStatusCode.OK, saveResponse.status)
        assertEquals(HttpStatusCode.OK, listResponse.status)
        assertTrue(body.contains("\"toleranceBandPctPoints\": \"3.50\""))
        assertTrue(body.contains("\"mode\": \"ALLOW_TRIMS\""))
    }

    private suspend fun io.ktor.server.testing.ApplicationTestBuilder.createAccount(
        baseCurrency: String = "PLN"
    ): String {
        val response = client.post("/v1/accounts") {
            contentType(ContentType.Application.Json)
            setBody(
                """
                {
                  "name": "Primary",
                  "institution": "Broker",
                  "type": "BROKERAGE",
                  "baseCurrency": "$baseCurrency"
                }
                """.trimIndent()
            )
        }
        return Regex("\"id\":\\s*\"([^\"]+)\"").find(response.bodyAsText())!!.groupValues[1]
    }

    private suspend fun io.ktor.server.testing.ApplicationTestBuilder.createInstrument(): String {
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
        return Regex("\"id\":\\s*\"([^\"]+)\"").find(response.bodyAsText())!!.groupValues[1]
    }

    private suspend fun io.ktor.server.testing.ApplicationTestBuilder.createBondInstrument(): String {
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

    private suspend fun io.ktor.server.testing.ApplicationTestBuilder.createTransaction(body: String) {
        val response = client.post("/v1/transactions") {
            contentType(ContentType.Application.Json)
            setBody(body)
        }
        assertEquals(HttpStatusCode.Created, response.status)
    }
}
