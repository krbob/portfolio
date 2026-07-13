package net.bobinski.portfolio.api.domain.service

import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import java.util.concurrent.atomic.AtomicInteger
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.async
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.yield
import kotlinx.serialization.KSerializer
import kotlinx.serialization.Serializable
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import net.bobinski.portfolio.api.config.AppJsonFactory
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryReadModelCacheRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class ReadModelCacheServiceTest {

    @Test
    fun `cache returns stored payload when descriptor is unchanged`() {
        val service = ReadModelCacheService(
            repository = InMemoryReadModelCacheRepository(),
            json = AppJsonFactory.create(),
            clock = fixedClock()
        )
        val descriptor = descriptor(sourceUpdatedAt = Instant.parse("2026-03-14T00:00:00Z"))
        var computeCount = 0

        val first = runBlocking {
            service.getOrCompute(descriptor, CachedPayload.serializer()) {
                computeCount += 1
                CachedPayload(value = "first")
            }
        }
        val second = runBlocking {
            service.getOrCompute(descriptor, CachedPayload.serializer()) {
                computeCount += 1
                CachedPayload(value = "second")
            }
        }

        assertEquals(CachedPayload("first"), first)
        assertEquals(CachedPayload("first"), second)
        assertEquals(1, computeCount)
    }

    @Test
    fun `cache rebuild stores canonical state change invalidation reason`() {
        val service = ReadModelCacheService(
            repository = InMemoryReadModelCacheRepository(),
            json = AppJsonFactory.create(),
            clock = fixedClock()
        )

        runBlocking {
            service.getOrCompute(descriptor(sourceUpdatedAt = Instant.parse("2026-03-14T00:00:00Z")), CachedPayload.serializer()) {
                CachedPayload(value = "first")
            }
        }

        val refreshed = runBlocking {
            service.getOrCompute(descriptor(sourceUpdatedAt = Instant.parse("2026-03-14T01:00:00Z")), CachedPayload.serializer()) {
                CachedPayload(value = "second")
            }
        }
        val snapshot = runBlocking { service.list().first() }

        assertEquals(CachedPayload("second"), refreshed)
        assertEquals(ReadModelCacheInvalidationReason.CANONICAL_STATE_CHANGED, snapshot.invalidationReason)
    }

    @Test
    fun `stale-if-error returns compatible healthy snapshot when refreshed candidate is rejected`() = runBlocking {
        val repository = InMemoryReadModelCacheRepository()
        val service = ReadModelCacheService(
            repository = repository,
            json = AppJsonFactory.create(),
            clock = fixedClock()
        )
        val canonicalRevision = Instant.parse("2026-03-14T00:00:00Z")
        val healthyDescriptor = descriptor(canonicalRevision)
        service.getOrCompute(healthyDescriptor, CachedPayload.serializer()) {
            CachedPayload("healthy")
        }
        val healthySnapshot = repository.list().single()
        val marketRevisionChanged = healthyDescriptor.copy(
            sourceUpdatedAt = Instant.parse("2026-03-14T01:00:00Z"),
            canonicalRevision = canonicalRevision
        )

        val result = service.getOrComputeStaleIfError(
            descriptor = marketRevisionChanged,
            serializer = CachedPayload.serializer(),
            isAcceptable = { payload -> payload.value != "degraded" }
        ) {
            CachedPayload("degraded")
        }

        assertEquals(CachedPayload("healthy"), result)
        assertEquals(healthySnapshot, repository.list().single())
    }

    @Test
    fun `stale-if-error serves rejected candidate without caching when no fallback exists`() = runBlocking {
        val repository = InMemoryReadModelCacheRepository()
        val service = ReadModelCacheService(
            repository = repository,
            json = AppJsonFactory.create(),
            clock = fixedClock()
        )

        val result = service.getOrComputeStaleIfError(
            descriptor = descriptor(Instant.parse("2026-03-14T00:00:00Z")),
            serializer = CachedPayload.serializer(),
            isAcceptable = { payload -> payload.value != "degraded" }
        ) {
            CachedPayload("degraded")
        }

        assertEquals(CachedPayload("degraded"), result)
        assertTrue(repository.list().isEmpty())
    }

    @Test
    fun `compatible acceptable snapshot lookup ignores degraded and newer canonical state`() = runBlocking {
        val service = cacheService()
        val canonicalRevision = Instant.parse("2026-03-14T00:00:00Z")
        val storedDescriptor = descriptor(canonicalRevision)
        service.getOrCompute(storedDescriptor, CachedPayload.serializer()) {
            CachedPayload("healthy")
        }

        assertTrue(
            service.hasCompatibleAcceptableSnapshot(
                descriptor = storedDescriptor.copy(sourceUpdatedAt = Instant.parse("2026-03-14T01:00:00Z")),
                serializer = CachedPayload.serializer(),
                isAcceptable = { payload -> payload.value == "healthy" }
            )
        )
        assertFalse(
            service.hasCompatibleAcceptableSnapshot(
                descriptor = storedDescriptor,
                serializer = CachedPayload.serializer(),
                isAcceptable = { payload -> payload.value == "degraded" }
            )
        )
        assertFalse(
            service.hasCompatibleAcceptableSnapshot(
                descriptor = storedDescriptor.copy(
                    sourceUpdatedAt = Instant.parse("2026-03-14T02:00:00Z"),
                    canonicalRevision = Instant.parse("2026-03-14T02:00:00Z")
                ),
                serializer = CachedPayload.serializer(),
                isAcceptable = { true }
            )
        )
    }

    @Test
    fun `stale-if-error returns compatible snapshot when recomputation fails`() = runBlocking {
        val repository = InMemoryReadModelCacheRepository()
        val service = ReadModelCacheService(
            repository = repository,
            json = AppJsonFactory.create(),
            clock = fixedClock()
        )
        val canonicalRevision = Instant.parse("2026-03-14T00:00:00Z")
        val healthyDescriptor = descriptor(canonicalRevision)
        service.getOrCompute(healthyDescriptor, CachedPayload.serializer()) {
            CachedPayload("healthy")
        }
        val healthySnapshot = repository.list().single()

        val result = service.getOrComputeStaleIfError(
            descriptor = healthyDescriptor.copy(
                sourceUpdatedAt = Instant.parse("2026-03-14T01:00:00Z"),
                canonicalRevision = canonicalRevision
            ),
            serializer = CachedPayload.serializer()
        ) {
            error("provider unavailable")
        }

        assertEquals(CachedPayload("healthy"), result)
        assertEquals(healthySnapshot, repository.list().single())
    }

    @Test
    fun `stale-if-error does not reuse snapshot for another model window or newer canonical state`() = runBlocking {
        val repository = InMemoryReadModelCacheRepository()
        val service = ReadModelCacheService(
            repository = repository,
            json = AppJsonFactory.create(),
            clock = fixedClock()
        )
        val healthyDescriptor = descriptor(Instant.parse("2026-03-14T00:00:00Z"))
        service.getOrCompute(healthyDescriptor, CachedPayload.serializer()) {
            CachedPayload("healthy")
        }
        val incompatibleDescriptors = listOf(
            healthyDescriptor.copy(modelVersion = healthyDescriptor.modelVersion + 1),
            healthyDescriptor.copy(inputsFrom = healthyDescriptor.inputsFrom?.minusDays(1)),
            healthyDescriptor.copy(
                sourceUpdatedAt = Instant.parse("2026-03-14T02:00:00Z"),
                canonicalRevision = Instant.parse("2026-03-14T02:00:00Z")
            )
        )

        incompatibleDescriptors.forEach { incompatible ->
            val exception = assertThrows(IllegalStateException::class.java) {
                runBlocking {
                    service.getOrComputeStaleIfError(incompatible, CachedPayload.serializer()) {
                        error("provider unavailable")
                    }
                }
            }
            assertEquals("provider unavailable", exception.message)
        }
    }

    @Test
    fun `stale-if-error persists descriptor captured after successful computation`() = runBlocking {
        val repository = InMemoryReadModelCacheRepository()
        val service = ReadModelCacheService(
            repository = repository,
            json = AppJsonFactory.create(),
            clock = fixedClock()
        )
        val canonicalRevision = Instant.parse("2026-03-14T00:00:00Z")
        val beforeCompute = descriptor(canonicalRevision)
        val afterCompute = beforeCompute.copy(
            sourceUpdatedAt = Instant.parse("2026-03-14T01:00:00Z"),
            canonicalRevision = canonicalRevision
        )

        val result = service.getOrComputeStaleIfError(
            descriptor = beforeCompute,
            serializer = CachedPayload.serializer(),
            descriptorAfterCompute = { afterCompute }
        ) {
            CachedPayload("fresh")
        }

        assertEquals(CachedPayload("fresh"), result)
        assertEquals(afterCompute.sourceUpdatedAt, repository.list().single().sourceUpdatedAt)
    }

    @Test
    fun `stale-if-error never turns cancellation into a stale response`() = runBlocking {
        val service = cacheService()
        val canonicalRevision = Instant.parse("2026-03-14T00:00:00Z")
        val healthyDescriptor = descriptor(canonicalRevision)
        service.getOrCompute(healthyDescriptor, CachedPayload.serializer()) {
            CachedPayload("healthy")
        }

        assertThrows(CancellationException::class.java) {
            runBlocking {
                service.getOrComputeStaleIfError(
                    descriptor = healthyDescriptor.copy(
                        sourceUpdatedAt = Instant.parse("2026-03-14T01:00:00Z"),
                        canonicalRevision = canonicalRevision
                    ),
                    serializer = CachedPayload.serializer()
                ) {
                    throw CancellationException("request cancelled")
                }
            }
        }
        Unit
    }

    @Test
    fun `force refresh rebuilds snapshot even when descriptor is unchanged`() {
        val service = ReadModelCacheService(
            repository = InMemoryReadModelCacheRepository(),
            json = AppJsonFactory.create(),
            clock = fixedClock()
        )
        val descriptor = descriptor(sourceUpdatedAt = Instant.parse("2026-03-14T00:00:00Z"))
        var computeCount = 0

        runBlocking {
            service.getOrCompute(descriptor, CachedPayload.serializer()) {
                computeCount += 1
                CachedPayload(value = "first")
            }
        }

        val refreshed = runBlocking {
            service.forceRefresh(descriptor, CachedPayload.serializer()) {
                computeCount += 1
                CachedPayload(value = "second")
            }
        }
        val snapshot = runBlocking { service.list().first() }

        assertEquals(CachedPayload("second"), refreshed)
        assertEquals(2, computeCount)
        assertEquals(ReadModelCacheInvalidationReason.EXPLICIT_REFRESH, snapshot.invalidationReason)
    }

    @Test
    fun `cache decode does not turn cancellation into a rebuild`() {
        val service = ReadModelCacheService(
            repository = InMemoryReadModelCacheRepository(),
            json = AppJsonFactory.create(),
            clock = fixedClock()
        )
        val descriptor = descriptor(sourceUpdatedAt = Instant.parse("2026-03-14T00:00:00Z"))

        runBlocking {
            service.getOrCompute(descriptor, CachedPayload.serializer()) {
                CachedPayload(value = "cached")
            }
        }

        assertThrows(CancellationException::class.java) {
            runBlocking {
                service.getOrCompute(descriptor, CancellingPayloadSerializer) {
                    CachedPayload(value = "must-not-rebuild")
                }
            }
        }
    }

    @Test
    fun `concurrent identical misses share one computation`() = runBlocking {
        val service = cacheService()
        val started = CompletableDeferred<Unit>()
        val release = CompletableDeferred<Unit>()
        val computeCount = AtomicInteger()

        val first = async {
            service.getOrCompute(descriptor(Instant.parse("2026-03-14T00:00:00Z")), CachedPayload.serializer()) {
                computeCount.incrementAndGet()
                started.complete(Unit)
                release.await()
                CachedPayload("shared")
            }
        }
        started.await()
        val second = async {
            service.getOrCompute(descriptor(Instant.parse("2026-03-14T00:00:00Z")), CachedPayload.serializer()) {
                computeCount.incrementAndGet()
                CachedPayload("duplicate")
            }
        }

        yield()
        release.complete(Unit)

        assertEquals(CachedPayload("shared"), first.await())
        assertEquals(CachedPayload("shared"), second.await())
        assertEquals(1, computeCount.get())
    }

    @Test
    fun `market source revision changing during a canonical flight does not split the computation`() = runBlocking {
        val service = cacheService()
        val canonicalRevision = Instant.parse("2026-03-14T00:00:00Z")
        val beforeMarketWrite = descriptor(canonicalRevision)
        val afterMarketWrite = beforeMarketWrite.copy(
            sourceUpdatedAt = Instant.parse("2026-03-14T00:05:00Z"),
            canonicalRevision = canonicalRevision
        )
        val started = CompletableDeferred<Unit>()
        val release = CompletableDeferred<Unit>()
        val computeCount = AtomicInteger()

        val first = async {
            service.getOrCompute(beforeMarketWrite, CachedPayload.serializer()) {
                computeCount.incrementAndGet()
                started.complete(Unit)
                release.await()
                CachedPayload("one canonical flight")
            }
        }
        started.await()
        val second = async {
            service.getOrCompute(afterMarketWrite, CachedPayload.serializer()) {
                computeCount.incrementAndGet()
                CachedPayload("split")
            }
        }
        yield()
        release.complete(Unit)

        assertEquals(CachedPayload("one canonical flight"), first.await())
        assertEquals(CachedPayload("one canonical flight"), second.await())
        assertEquals(1, computeCount.get())
    }

    @Test
    fun `cancelling one waiter does not cancel shared computation`() = runBlocking {
        val service = cacheService()
        val started = CompletableDeferred<Unit>()
        val release = CompletableDeferred<Unit>()
        val computeCount = AtomicInteger()

        val cancelledWaiter = async {
            service.getOrCompute(descriptor(Instant.parse("2026-03-14T00:00:00Z")), CachedPayload.serializer()) {
                computeCount.incrementAndGet()
                started.complete(Unit)
                release.await()
                CachedPayload("completed")
            }
        }
        started.await()
        cancelledWaiter.cancelAndJoin()

        val survivingWaiter = async {
            service.getOrCompute(descriptor(Instant.parse("2026-03-14T00:00:00Z")), CachedPayload.serializer()) {
                computeCount.incrementAndGet()
                CachedPayload("duplicate")
            }
        }
        yield()
        release.complete(Unit)

        assertEquals(CachedPayload("completed"), survivingWaiter.await())
        assertEquals(1, computeCount.get())
    }

    @Test
    fun `failed computation is removed so the next request can recover`() = runBlocking {
        val service = cacheService()
        val started = CompletableDeferred<Unit>()
        val releaseFailure = CompletableDeferred<Unit>()
        val computeCount = AtomicInteger()

        val first = async {
            runCatching {
                service.getOrCompute(descriptor(Instant.parse("2026-03-14T00:00:00Z")), CachedPayload.serializer()) {
                    computeCount.incrementAndGet()
                    started.complete(Unit)
                    releaseFailure.await()
                    error("transient failure")
                }
            }
        }
        started.await()
        val second = async {
            runCatching {
                service.getOrCompute(descriptor(Instant.parse("2026-03-14T00:00:00Z")), CachedPayload.serializer()) {
                    computeCount.incrementAndGet()
                    CachedPayload("must-not-run")
                }
            }
        }
        yield()
        releaseFailure.complete(Unit)

        assertTrue(first.await().exceptionOrNull()?.message == "transient failure")
        assertTrue(second.await().exceptionOrNull()?.message == "transient failure")

        val recovered = service.getOrCompute(
            descriptor(Instant.parse("2026-03-14T00:00:00Z")),
            CachedPayload.serializer()
        ) {
            computeCount.incrementAndGet()
            CachedPayload("recovered")
        }

        assertEquals(CachedPayload("recovered"), recovered)
        assertEquals(2, computeCount.get())
    }

    @Test
    fun `revision range and parameters are all part of the single-flight key`() {
        val base = descriptor(Instant.parse("2026-03-14T00:00:00Z"))
        val nextRevision = Instant.parse("2026-03-14T01:00:00Z")

        assertTrue(
            base.computationKey("test") != base.copy(
                sourceUpdatedAt = nextRevision,
                canonicalRevision = nextRevision
            ).computationKey("test")
        )
        assertTrue(base.computationKey("test") != base.copy(inputsFrom = LocalDate.parse("2025-01-01")).computationKey("test"))
        assertTrue(base.computationKey("test") != base.copy(parameters = mapOf("currency" to "USD")).computationKey("test"))
        assertEquals(
            base.copy(parameters = linkedMapOf("currency" to "USD", "period" to "1Y")).computationKey("test"),
            base.copy(parameters = linkedMapOf("period" to "1Y", "currency" to "USD")).computationKey("test")
        )
    }

    @Test
    fun `failed reusable snapshot does not poison later recovery`() = runBlocking {
        val coordinator = ReadModelComputationCoordinator()
        val key = descriptor(Instant.parse("2026-03-14T00:00:00Z"))
            .computationKey("domain:test")
        var computeCount = 0

        val failure = runCatching {
            coordinator.getOrCompute(key) {
                computeCount += 1
                error("temporary")
            }
        }
        val recovered = coordinator.getOrCompute(key) {
            computeCount += 1
            CachedPayload("recovered")
        }
        val reused = coordinator.getOrCompute(key) {
            computeCount += 1
            CachedPayload("duplicate")
        }

        assertEquals("temporary", failure.exceptionOrNull()?.message)
        assertEquals(CachedPayload("recovered"), recovered)
        assertEquals(CachedPayload("recovered"), reused)
        assertEquals(2, computeCount)
        coordinator.close()
    }

    @Test
    fun `cancelled shared computation is removed before retry`() = runBlocking {
        val coordinator = ReadModelComputationCoordinator()
        val key = descriptor(Instant.parse("2026-03-14T00:00:00Z"))
            .computationKey("domain:cancelled")
        var computeCount = 0

        val cancellation = runCatching {
            coordinator.getOrCompute(key) {
                computeCount += 1
                throw CancellationException("worker cancelled")
            }
        }
        val recovered = coordinator.getOrCompute(key) {
            computeCount += 1
            CachedPayload("recovered")
        }

        assertTrue(cancellation.exceptionOrNull() is CancellationException)
        assertEquals(CachedPayload("recovered"), recovered)
        assertEquals(2, computeCount)
        coordinator.close()
    }

    @Test
    fun `parameter variants keep independent persistent snapshots`() = runBlocking {
        val service = cacheService()
        val base = descriptor(Instant.parse("2026-03-14T00:00:00Z"))
        val pln = base.copy(parameters = mapOf("currency" to "PLN", "period" to "1Y"))
        val usd = base.copy(parameters = linkedMapOf("period" to "1Y", "currency" to "USD"))
        var computeCount = 0

        val plnResult = service.getOrCompute(pln, CachedPayload.serializer()) {
            computeCount += 1
            CachedPayload("pln")
        }
        val usdResult = service.getOrCompute(usd, CachedPayload.serializer()) {
            computeCount += 1
            CachedPayload("usd")
        }
        val plnAgain = service.getOrCompute(pln, CachedPayload.serializer()) {
            computeCount += 1
            CachedPayload("duplicate")
        }

        assertEquals(CachedPayload("pln"), plnResult)
        assertEquals(CachedPayload("usd"), usdResult)
        assertEquals(CachedPayload("pln"), plnAgain)
        assertTrue(pln.storageKey() != usd.storageKey())
        assertEquals(2, computeCount)
    }

    @Test
    fun `reusable snapshots evict the least recently used slot at a hard bound`() = runBlocking {
        val coordinator = ReadModelComputationCoordinator()
        val base = descriptor(Instant.parse("2026-03-14T00:00:00Z"))
        var computeCount = 0

        repeat(33) { index ->
            coordinator.getOrCompute(
                base.copy(parameters = mapOf("variant" to index.toString())).computationKey("bounded:test")
            ) {
                computeCount += 1
                CachedPayload(index.toString())
            }
        }
        coordinator.getOrCompute(
            base.copy(parameters = mapOf("variant" to "32")).computationKey("bounded:test")
        ) {
            computeCount += 1
            CachedPayload("latest-duplicate")
        }
        val evicted = coordinator.getOrCompute(
            base.copy(parameters = mapOf("variant" to "0")).computationKey("bounded:test")
        ) {
            computeCount += 1
            CachedPayload("recomputed")
        }

        assertEquals(CachedPayload("recomputed"), evicted)
        assertEquals(34, computeCount)
        coordinator.close()
    }

    private fun descriptor(sourceUpdatedAt: Instant) = ReadModelCacheDescriptor(
        cacheKey = "portfolio.daily-history",
        modelName = "DAILY_HISTORY",
        modelVersion = 1,
        inputsFrom = LocalDate.parse("2026-01-01"),
        inputsTo = LocalDate.parse("2026-03-14"),
        sourceUpdatedAt = sourceUpdatedAt
    )

    private fun fixedClock(): Clock = Clock.fixed(Instant.parse("2026-03-14T12:00:00Z"), ZoneOffset.UTC)

    private fun cacheService(): ReadModelCacheService = ReadModelCacheService(
        repository = InMemoryReadModelCacheRepository(),
        json = AppJsonFactory.create(),
        clock = fixedClock()
    )

    @Serializable
    private data class CachedPayload(val value: String)

    private object CancellingPayloadSerializer : KSerializer<CachedPayload> {
        override val descriptor: SerialDescriptor = CachedPayload.serializer().descriptor

        override fun deserialize(decoder: Decoder): CachedPayload =
            throw CancellationException("Read-model decode cancelled.")

        override fun serialize(encoder: Encoder, value: CachedPayload) {
            CachedPayload.serializer().serialize(encoder, value)
        }
    }
}
