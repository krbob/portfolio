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
                      "mode": "REPLACE"
                    }
                    """.trimIndent()
                )
            }
            val accountsResponse = client.get("/v1/accounts")

            assertEquals(HttpStatusCode.OK, runResponse.status)
            assertTrue(runResponse.bodyAsText().contains("\"isReadable\": true"))
            assertEquals(HttpStatusCode.OK, listResponse.status)
            assertTrue(listResponse.bodyAsText().contains("\"schedulerEnabled\": false"))
            assertTrue(listResponse.bodyAsText().contains(backupFileName))
            assertEquals(HttpStatusCode.OK, downloadResponse.status)
            assertTrue(downloadResponse.bodyAsText().contains("\"schemaVersion\": 1"))
            assertTrue(downloadResponse.headers[HttpHeaders.ContentDisposition]?.contains(backupFileName) == true)
            assertEquals(HttpStatusCode.OK, restoreResponse.status)
            assertTrue(restoreResponse.bodyAsText().contains("\"mode\": \"REPLACE\""))
            assertTrue(accountsResponse.bodyAsText().contains("\"name\": \"Primary\""))
            assertFalse(accountsResponse.bodyAsText().contains("\"name\": \"Secondary\""))
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
}
