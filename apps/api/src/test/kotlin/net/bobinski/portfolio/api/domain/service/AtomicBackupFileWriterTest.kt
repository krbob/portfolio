package net.bobinski.portfolio.api.domain.service

import java.nio.file.FileAlreadyExistsException
import java.nio.file.Files
import kotlin.io.path.createTempDirectory
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class AtomicBackupFileWriterTest {
    @Test
    fun `publishes a complete backup without leaving the staged file visible`() {
        val directory = createTempDirectory("atomic-backup-writer-success")
        val target = directory.resolve("portfolio-backup.json")

        try {
            AtomicBackupFileWriter().write(target, "{\"schemaVersion\":4}")

            assertEquals("{\"schemaVersion\":4}", Files.readString(target))
            assertEquals(listOf(target.fileName.toString()), directoryFileNames(directory))
        } finally {
            directory.toFile().deleteRecursively()
        }
    }

    @Test
    fun `removes the staged file when publication fails`() {
        val directory = createTempDirectory("atomic-backup-writer-failure")
        val target = directory.resolve("portfolio-backup.json")
        var stagedContent: String? = null
        val writer = AtomicBackupFileWriter { source, _ ->
            stagedContent = Files.readString(source)
            error("Simulated atomic publication failure.")
        }

        try {
            val failure = assertThrows(IllegalStateException::class.java) {
                writer.write(target, "{\"schemaVersion\":4}")
            }

            assertEquals("Simulated atomic publication failure.", failure.message)
            assertEquals("{\"schemaVersion\":4}", stagedContent)
            assertTrue(directoryFileNames(directory).isEmpty())
        } finally {
            directory.toFile().deleteRecursively()
        }
    }

    @Test
    fun `does not replace an existing backup`() {
        val directory = createTempDirectory("atomic-backup-writer-existing")
        val target = directory.resolve("portfolio-backup.json")

        try {
            Files.writeString(target, "existing")

            assertThrows(FileAlreadyExistsException::class.java) {
                AtomicBackupFileWriter().write(target, "replacement")
            }
            assertEquals("existing", Files.readString(target))
            assertEquals(listOf(target.fileName.toString()), directoryFileNames(directory))
        } finally {
            directory.toFile().deleteRecursively()
        }
    }

    private fun directoryFileNames(directory: java.nio.file.Path): List<String> =
        Files.list(directory).use { stream -> stream.map { path -> path.fileName.toString() }.sorted().toList() }
}
