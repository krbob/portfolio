package net.bobinski.portfolio.api.readmodel

import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import java.util.concurrent.atomic.AtomicInteger
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.async
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.builtins.serializer
import net.bobinski.portfolio.api.config.AppJsonFactory
import net.bobinski.portfolio.api.domain.service.ReadModelCacheDescriptor
import net.bobinski.portfolio.api.domain.service.ReadModelComputationCoordinator
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryReadModelCacheRepository
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

class ReadModelSnapshotServiceTest {
    @Test
    fun `persisted preview is immediate during one shared refresh and survives midnight`() = runBlocking {
        ReadModelComputationCoordinator().use { coordinator ->
            val repository = InMemoryReadModelCacheRepository()
            val initial = service(repository, coordinator)
            initial.read(false, String.serializer(), { descriptor() }) { SnapshotCandidate("old") }
            val refreshed = service(repository, coordinator, NOW.plusSeconds(86_400))
            val nextDay = descriptor().copy(inputsTo = DAY.plusDays(1))
            val entered = CompletableDeferred<Unit>()
            val release = CompletableDeferred<Unit>()
            val calls = AtomicInteger()
            suspend fun compute(): SnapshotCandidate<String> {
                calls.incrementAndGet()
                entered.complete(Unit)
                release.await()
                return SnapshotCandidate("new")
            }
            val first = async { refreshed.read(false, String.serializer(), { nextDay }, ::compute) }
            entered.await()
            val second = async(start = CoroutineStart.UNDISPATCHED) {
                refreshed.read(false, String.serializer(), { nextDay }, ::compute)
            }
            val preview = refreshed.read(true, String.serializer(), { nextDay }) { error("No upstream") }
            assertEquals("old", preview.value)
            assertEquals(NOW, preview.generatedAt)
            assertTrue(preview.refreshRequired)
            assertTrue(preview.fromCache)
            release.complete(Unit)
            assertEquals("new", first.await().value)
            assertEquals("new", second.await().value)
            assertEquals(1, calls.get())
            assertEquals(1, repository.list().size)
        }
    }

    @Test
    fun `failed and incomplete refresh preserve complete value with original timestamp`() = runBlocking {
        ReadModelComputationCoordinator().use { coordinator ->
            val repository = InMemoryReadModelCacheRepository()
            val service = service(repository, coordinator)
            service.read(false, String.serializer(), { descriptor() }) { SnapshotCandidate("complete") }
            for (throws in listOf(true, false)) {
                val result = service.read(false, String.serializer(), { descriptor() }) {
                    if (throws) error("Unavailable")
                    SnapshotCandidate("partial", complete = false)
                }
                assertEquals("complete", result.value)
                assertEquals(NOW, result.generatedAt)
                assertTrue(result.fromCache)
                assertTrue(result.refreshFailed)
            }
            assertEquals(1, repository.list().size)
        }
    }

    @Test
    fun `different canonical content cannot reuse or fall back to an old result`() = runBlocking {
        ReadModelComputationCoordinator().use { coordinator ->
            val repository = InMemoryReadModelCacheRepository()
            val service = service(repository, coordinator)
            service.read(false, String.serializer(), { descriptor() }) { SnapshotCandidate("old") }
            val changed = descriptor().copy(parameters = mapOf("ledger" to "changed"))
            assertThrows(IllegalStateException::class.java) {
                runBlocking { service.read(true, String.serializer(), { changed }) { error("Unavailable") } }
            }
            val current = service.read(true, String.serializer(), { changed }) { SnapshotCandidate("current") }
            assertEquals("current", current.value)
            assertFalse(current.fromCache)
            assertEquals(1, repository.list().size)
        }
    }

    @Test
    fun `input mutation during refresh never publishes or falls back and cancellation propagates`() = runBlocking<Unit> {
        ReadModelComputationCoordinator().use { coordinator ->
            val repository = InMemoryReadModelCacheRepository()
            val service = service(repository, coordinator)
            var current = descriptor()
            service.read(false, String.serializer(), { current }) { SnapshotCandidate("old") }
            val saved = repository.list().single()
            assertThrows(IllegalStateException::class.java) {
                runBlocking {
                    service.read(false, String.serializer(), { current }) {
                        current = current.copy(parameters = mapOf("ledger" to "changed"))
                        SnapshotCandidate("obsolete")
                    }
                }
            }
            assertEquals(saved, repository.list().single())
            assertThrows(CancellationException::class.java) {
                runBlocking { service.read(false, String.serializer(), { descriptor() }) { throw CancellationException() } }
            }
        }
    }

    private fun service(repository: InMemoryReadModelCacheRepository, coordinator: ReadModelComputationCoordinator, at: Instant = NOW) =
        ReadModelSnapshotService(repository, AppJsonFactory.create(), Clock.fixed(at, ZoneOffset.UTC), coordinator)

    private fun descriptor() = ReadModelCacheDescriptor(
        "test.preview", "TEST", 1, DAY, DAY, NOW, parameters = mapOf("ledger" to "original")
    )
    companion object {
        private val NOW = Instant.parse("2026-10-13T10:00:00Z")
        private val DAY = LocalDate.parse("2026-10-13")
    }
}
