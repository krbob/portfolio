package net.bobinski.portfolio.api

import io.ktor.client.request.get
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.server.config.MapApplicationConfig
import io.ktor.server.testing.testApplication
import java.nio.file.Files
import net.bobinski.portfolio.api.dependency.RepositoryBindingMode
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class SqliteApplicationTest {

    @Test
    fun `application can handle write-model and audit routes in sqlite runtime mode`() {
        testApplication {
            val tempDirectory = Files.createTempDirectory("portfolio-sqlite-application-test")
            val databasePath = tempDirectory.resolve("portfolio.db")
            val backupDirectory = tempDirectory.resolve("backups")

            environment {
                config = MapApplicationConfig(
                    "portfolio.persistence.databasePath" to databasePath.toString(),
                    "portfolio.persistence.journalMode" to "WAL",
                    "portfolio.persistence.synchronousMode" to "FULL",
                    "portfolio.persistence.busyTimeoutMs" to "5000",
                    "portfolio.marketData.enabled" to "false",
                    "portfolio.backups.enabled" to "false",
                    "portfolio.backups.directory" to backupDirectory.toString()
                )
            }

            application {
                runtimeModule(RepositoryBindingMode.SQLITE_RUNTIME)
            }

            try {
                val createAccountResponse = client.post("/v1/accounts") {
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
                val accountsResponse = client.get("/v1/accounts")
                val auditResponse = client.get("/v1/portfolio/audit/events")
                val cacheResponse = client.get("/v1/portfolio/read-model-cache")
                val metaResponse = client.get("/v1/meta")
                val readinessResponse = client.get("/v1/readiness")

                assertEquals(HttpStatusCode.Created, createAccountResponse.status)
                assertEquals(HttpStatusCode.OK, accountsResponse.status)
                assertTrue(accountsResponse.bodyAsText().contains("\"name\": \"Primary\""))
                assertEquals(HttpStatusCode.OK, auditResponse.status)
                assertTrue(auditResponse.bodyAsText().contains("\"action\": \"ACCOUNT_CREATED\""))
                assertEquals(HttpStatusCode.OK, cacheResponse.status)
                assertEquals("[]", cacheResponse.bodyAsText())
                assertEquals(HttpStatusCode.OK, metaResponse.status)
                assertTrue(metaResponse.bodyAsText().contains("\"persistenceMode\": \"SQLITE\""))
                assertTrue(metaResponse.bodyAsText().contains("\"database\": \"SQLite\""))
                assertEquals(HttpStatusCode.OK, readinessResponse.status)
                assertTrue(readinessResponse.bodyAsText().contains("\"status\": \"READY\""))
                assertTrue(readinessResponse.bodyAsText().contains("\"key\": \"sqlite-connection\""))
                assertTrue(readinessResponse.bodyAsText().contains("\"status\": \"PASS\""))
            } finally {
                tempDirectory.toFile().deleteRecursively()
            }
        }
    }

    @Test
    fun `application supports EDO redeem flow in sqlite runtime mode`() {
        testApplication {
            val tempDirectory = Files.createTempDirectory("portfolio-sqlite-edo-runtime-test")
            val databasePath = tempDirectory.resolve("portfolio.db")
            val backupDirectory = tempDirectory.resolve("backups")

            environment {
                config = MapApplicationConfig(
                    "portfolio.persistence.databasePath" to databasePath.toString(),
                    "portfolio.persistence.journalMode" to "WAL",
                    "portfolio.persistence.synchronousMode" to "FULL",
                    "portfolio.persistence.busyTimeoutMs" to "5000",
                    "portfolio.marketData.enabled" to "false",
                    "portfolio.backups.enabled" to "false",
                    "portfolio.backups.directory" to backupDirectory.toString()
                )
            }

            application {
                runtimeModule(RepositoryBindingMode.SQLITE_RUNTIME)
            }

            try {
                val accountId = extractId(
                    client.post("/v1/accounts") {
                        contentType(ContentType.Application.Json)
                        setBody(
                            """
                            {
                              "name": "Treasury Register",
                              "institution": "PKO BP",
                              "type": "BOND_REGISTER",
                              "baseCurrency": "PLN"
                            }
                            """.trimIndent()
                        )
                    }.also { response ->
                        assertEquals(HttpStatusCode.Created, response.status)
                    }.bodyAsText()
                )
                val instrumentId = extractId(
                    client.post("/v1/instruments") {
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
                    }.also { response ->
                        assertEquals(HttpStatusCode.Created, response.status)
                    }.bodyAsText()
                )

                createTransaction(
                    accountId = accountId,
                    payload = """
                        {
                          "accountId": "$accountId",
                          "type": "DEPOSIT",
                          "tradeDate": "2026-03-01",
                          "settlementDate": "2026-03-01",
                          "grossAmount": "15000.00",
                          "currency": "PLN"
                        }
                    """.trimIndent()
                )
                createTransaction(
                    accountId = accountId,
                    payload = """
                        {
                          "accountId": "$accountId",
                          "instrumentId": "$instrumentId",
                          "type": "BUY",
                          "tradeDate": "2026-03-02",
                          "settlementDate": "2026-03-02",
                          "quantity": "70",
                          "unitPrice": "100.00",
                          "grossAmount": "7000.00",
                          "feeAmount": "0",
                          "taxAmount": "0",
                          "currency": "PLN"
                        }
                    """.trimIndent()
                )
                createTransaction(
                    accountId = accountId,
                    payload = """
                        {
                          "accountId": "$accountId",
                          "instrumentId": "$instrumentId",
                          "type": "BUY",
                          "tradeDate": "2026-03-22",
                          "settlementDate": "2026-03-22",
                          "quantity": "30",
                          "unitPrice": "100.00",
                          "grossAmount": "3000.00",
                          "feeAmount": "0",
                          "taxAmount": "0",
                          "currency": "PLN"
                        }
                    """.trimIndent()
                )
                val redeemResponse = createTransaction(
                    accountId = accountId,
                    payload = """
                        {
                          "accountId": "$accountId",
                          "instrumentId": "$instrumentId",
                          "type": "REDEEM",
                          "tradeDate": "2026-03-26",
                          "settlementDate": "2026-03-26",
                          "quantity": "80",
                          "unitPrice": "102.00",
                          "grossAmount": "8160.00",
                          "feeAmount": "0",
                          "taxAmount": "160.00",
                          "currency": "PLN"
                        }
                    """.trimIndent()
                )
                val holdingsResponse = client.get("/v1/portfolio/holdings")
                val transactionsResponse = client.get("/v1/transactions")
                val auditResponse = client.get("/v1/portfolio/audit/events")
                val redeemBody = redeemResponse.bodyAsText()
                val holdingsBody = holdingsResponse.bodyAsText()
                val transactionsBody = transactionsResponse.bodyAsText()
                val auditBody = auditResponse.bodyAsText()

                assertEquals(HttpStatusCode.Created, redeemResponse.status)
                assertTrue(redeemBody.contains("\"type\": \"REDEEM\""))
                assertEquals(HttpStatusCode.OK, holdingsResponse.status)
                assertTrue(holdingsBody.contains("\"instrumentName\": \"EDO0336\""))
                assertTrue(holdingsBody.contains("\"quantity\": \"20\""))
                assertTrue(holdingsBody.contains("\"purchaseDate\": \"2026-03-22\""))
                assertFalse(holdingsBody.contains("\"purchaseDate\": \"2026-03-02\""))
                assertEquals(HttpStatusCode.OK, transactionsResponse.status)
                assertTrue(transactionsBody.contains("\"type\": \"REDEEM\""))
                assertEquals(HttpStatusCode.OK, auditResponse.status)
                assertTrue(auditBody.contains("\"action\": \"TRANSACTION_CREATED\""))
            } finally {
                tempDirectory.toFile().deleteRecursively()
            }
        }
    }

    private fun extractId(body: String): String =
        Regex("\"id\":\\s*\"([^\"]+)\"")
            .find(body)
            ?.groupValues
            ?.get(1)
            ?: error("Response does not contain id: $body")

    private suspend fun io.ktor.server.testing.ApplicationTestBuilder.createTransaction(
        accountId: String,
        payload: String
    ) = client.post("/v1/transactions") {
        contentType(ContentType.Application.Json)
        setBody(payload)
    }.also { response ->
        assertEquals(HttpStatusCode.Created, response.status, "Failed transaction for account $accountId.")
    }
}
