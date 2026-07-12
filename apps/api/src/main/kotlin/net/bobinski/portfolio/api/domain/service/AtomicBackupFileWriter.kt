package net.bobinski.portfolio.api.domain.service

import java.io.IOException
import java.nio.ByteBuffer
import java.nio.channels.FileChannel
import java.nio.channels.NonWritableChannelException
import java.nio.charset.StandardCharsets
import java.nio.file.AtomicMoveNotSupportedException
import java.nio.file.FileAlreadyExistsException
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.StandardCopyOption.ATOMIC_MOVE
import java.nio.file.StandardOpenOption.READ
import java.nio.file.StandardOpenOption.TRUNCATE_EXISTING
import java.nio.file.StandardOpenOption.WRITE

internal class AtomicBackupFileWriter(
    private val moveIntoPlace: (source: Path, target: Path) -> Unit = ::moveAtomically
) {
    fun write(target: Path, content: String) {
        val directory = requireNotNull(target.parent) { "Backup target must have a parent directory." }
        if (Files.exists(target)) {
            throw FileAlreadyExistsException(target.toString())
        }

        val stagedFile = Files.createTempFile(directory, ".${target.fileName}-", ".tmp")
        try {
            writeAndForce(stagedFile, content)
            moveIntoPlace(stagedFile, target)
            forceDirectoryBestEffort(directory)
        } finally {
            Files.deleteIfExists(stagedFile)
        }
    }

    private fun writeAndForce(file: Path, content: String) {
        val buffer = ByteBuffer.wrap(content.toByteArray(StandardCharsets.UTF_8))
        FileChannel.open(file, WRITE, TRUNCATE_EXISTING).use { channel ->
            while (buffer.hasRemaining()) {
                channel.write(buffer)
            }
            channel.force(true)
        }
    }

    private fun forceDirectoryBestEffort(directory: Path) {
        try {
            FileChannel.open(directory, READ).use { channel -> channel.force(true) }
        } catch (_: IOException) {
            // Some filesystems and operating systems do not support opening directories as channels.
        } catch (_: UnsupportedOperationException) {
            // The file has already been forced; directory forcing is an additional durability guard.
        } catch (_: NonWritableChannelException) {
            // Some providers allow opening the directory read-only but do not allow forcing that channel.
        }
    }
}

private fun moveAtomically(source: Path, target: Path) {
    try {
        Files.move(source, target, ATOMIC_MOVE)
    } catch (_: AtomicMoveNotSupportedException) {
        Files.move(source, target)
    }
}
