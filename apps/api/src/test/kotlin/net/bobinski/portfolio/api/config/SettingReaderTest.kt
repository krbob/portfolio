package net.bobinski.portfolio.api.config

import io.ktor.server.config.MapApplicationConfig
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import java.nio.file.Files

class SettingReaderTest {
    @Test
    fun `reads direct environment value before file and config`() {
        val file = Files.createTempFile("portfolio-secret", ".txt")
        Files.writeString(file, "from-file\n")
        val config = MapApplicationConfig("portfolio.secret" to "from-config")
        val env = mapOf(
            "PORTFOLIO_SECRET" to "from-env",
            "PORTFOLIO_SECRET_FILE" to file.toString()
        )

        val value = readSetting("PORTFOLIO_SECRET", config, "portfolio.secret", env::get)

        assertEquals("from-env", value)
    }

    @Test
    fun `reads file environment value before config`() {
        val file = Files.createTempFile("portfolio-secret", ".txt")
        Files.writeString(file, "from-file\n")
        val config = MapApplicationConfig("portfolio.secret" to "from-config")
        val env = mapOf("PORTFOLIO_SECRET_FILE" to file.toString())

        val value = readSetting("PORTFOLIO_SECRET", config, "portfolio.secret", env::get)

        assertEquals("from-file", value)
    }

    @Test
    fun `falls back to config when env and file are absent`() {
        val config = MapApplicationConfig("portfolio.secret" to "from-config")

        val value = readSetting("PORTFOLIO_SECRET", config, "portfolio.secret") { null }

        assertEquals("from-config", value)
    }
}
