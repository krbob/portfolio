package net.bobinski.portfolio.api

import io.ktor.client.request.get
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.server.config.MapApplicationConfig
import io.ktor.server.testing.testApplication
import java.nio.file.Files
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class PortfolioBackupRouteTest {

    @Test
    fun `portfolio backup can be created listed and restored`() = testApplication {
        val backupDirectory = Files.createTempDirectory("portfolio-backups-test")

        environment {
            config = MapApplicationConfig(
                "portfolio.backups.enabled" to "false",
                "portfolio.backups.directory" to backupDirectory.toString(),
                "portfolio.backups.intervalMinutes" to "1440",
                "portfolio.backups.retentionCount" to "5"
            )
        }

        application {
            module()
        }

        try {
            val accountId = createAccount(name = "Primary")
            saveBenchmarkSettings()
            saveRebalancingSettings()
            createImportProfile(accountId)
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

            val runResponse = client.post("/v1/portfolio/backups/run")
            val backupFileName = Regex("\"fileName\":\\s*\"([^\"]+)\"").find(runResponse.bodyAsText())!!.groupValues[1]

            createAccount(name = "Secondary")

            val listResponse = client.get("/v1/portfolio/backups")
            val downloadResponse = client.get("/v1/portfolio/backups/download?fileName=$backupFileName")
            val restoreResponse = client.post("/v1/portfolio/backups/restore") {
                contentType(ContentType.Application.Json)
                setBody(
                    """
                    {
                      "fileName": "$backupFileName",
                      "mode": "REPLACE",
                      "confirmation": "REPLACE"
                    }
                    """.trimIndent()
                )
            }
            val accountsResponse = client.get("/v1/accounts")
            val downloadPayload = Json.parseToJsonElement(downloadResponse.bodyAsText()).jsonObject

            assertEquals(HttpStatusCode.OK, runResponse.status)
            assertTrue(runResponse.bodyAsText().contains("\"isReadable\": true"))
            assertTrue(runResponse.bodyAsText().contains("\"appPreferenceCount\": 2"))
            assertTrue(runResponse.bodyAsText().contains("\"importProfileCount\": 1"))
            assertEquals(HttpStatusCode.OK, listResponse.status)
            assertTrue(listResponse.bodyAsText().contains("\"schedulerEnabled\": false"))
            assertTrue(listResponse.bodyAsText().contains(backupFileName))
            assertEquals(HttpStatusCode.OK, downloadResponse.status)
            assertTrue(downloadPayload["schemaVersion"]?.jsonPrimitive?.intOrNull?.let { it > 0 } == true)
            assertEquals(2, downloadPayload["appPreferences"]?.jsonArray?.size)
            assertEquals(1, downloadPayload["importProfiles"]?.jsonArray?.size)
            assertTrue(downloadResponse.headers[HttpHeaders.ContentDisposition]?.contains(backupFileName) == true)
            assertEquals(HttpStatusCode.OK, restoreResponse.status)
            assertTrue(restoreResponse.bodyAsText().contains("\"mode\": \"REPLACE\""))
            assertTrue(restoreResponse.bodyAsText().contains("\"appPreferenceCount\": 2"))
            assertTrue(restoreResponse.bodyAsText().contains("\"importProfileCount\": 1"))
            assertTrue(restoreResponse.bodyAsText().contains("\"safetyBackupFileName\": \"portfolio-backup-"))
            assertTrue(accountsResponse.bodyAsText().contains("\"name\": \"Primary\""))
            assertFalse(accountsResponse.bodyAsText().contains("\"name\": \"Secondary\""))
        } finally {
            backupDirectory.toFile().deleteRecursively()
        }
    }

    @Test
    fun `replace restore requires explicit confirmation`() = testApplication {
        val backupDirectory = Files.createTempDirectory("portfolio-backups-confirmation-test")

        environment {
            config = MapApplicationConfig(
                "portfolio.backups.enabled" to "false",
                "portfolio.backups.directory" to backupDirectory.toString(),
                "portfolio.backups.intervalMinutes" to "1440",
                "portfolio.backups.retentionCount" to "5"
            )
        }

        application {
            module()
        }

        try {
            val accountId = createAccount(name = "Primary")
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

            val runResponse = client.post("/v1/portfolio/backups/run")
            val backupFileName = Regex("\"fileName\":\\s*\"([^\"]+)\"").find(runResponse.bodyAsText())!!.groupValues[1]

            val restoreResponse = client.post("/v1/portfolio/backups/restore") {
                contentType(ContentType.Application.Json)
                setBody(
                    """
                    {
                      "fileName": "$backupFileName",
                      "mode": "REPLACE"
                    }
                    """.trimIndent()
                )
            }

            assertEquals(HttpStatusCode.BadRequest, restoreResponse.status)
            assertTrue(restoreResponse.bodyAsText().contains("REPLACE operations require confirmation"))
        } finally {
            backupDirectory.toFile().deleteRecursively()
        }
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

    private suspend fun io.ktor.server.testing.ApplicationTestBuilder.createTransaction(body: String) {
        val response = client.post("/v1/transactions") {
            contentType(ContentType.Application.Json)
            setBody(body)
        }
        assertEquals(HttpStatusCode.Created, response.status)
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
