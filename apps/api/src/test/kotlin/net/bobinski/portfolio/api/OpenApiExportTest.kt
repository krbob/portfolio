package net.bobinski.portfolio.api

import io.ktor.client.request.get
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpStatusCode
import io.ktor.server.testing.testApplication
import java.nio.file.Files
import java.nio.file.Path
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class OpenApiExportTest {

    @Test
    fun `exports openapi spec to build directory`() = testApplication {
        application {
            module()
        }

        val response = client.get("/v1/openapi.json")
        val body = response.bodyAsText()

        assertEquals(HttpStatusCode.OK, response.status)
        assertTrue(body.contains("/v1/portfolio/overview"))

        val outputPath = Path.of(
            System.getProperty("portfolio.openapi.outputPath")
                ?: error("portfolio.openapi.outputPath system property is required.")
        )
        Files.createDirectories(outputPath.parent)
        Files.writeString(outputPath, body)
    }
}
