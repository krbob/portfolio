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
                    "portfolio.persistence.sqlite.databasePath" to databasePath.toString(),
                    "portfolio.persistence.sqlite.journalMode" to "WAL",
                    "portfolio.persistence.sqlite.synchronousMode" to "FULL",
                    "portfolio.persistence.sqlite.busyTimeoutMs" to "5000",
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
            } finally {
                tempDirectory.toFile().deleteRecursively()
            }
        }
    }
}
