package net.bobinski.portfolio.api.domain.service

import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.KSerializer
import kotlinx.serialization.Serializable
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import net.bobinski.portfolio.api.config.AppJsonFactory
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryReadModelCacheRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
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

    private fun descriptor(sourceUpdatedAt: Instant) = ReadModelCacheDescriptor(
        cacheKey = "portfolio.daily-history",
        modelName = "DAILY_HISTORY",
        modelVersion = 1,
        inputsFrom = LocalDate.parse("2026-01-01"),
        inputsTo = LocalDate.parse("2026-03-14"),
        sourceUpdatedAt = sourceUpdatedAt
    )

    private fun fixedClock(): Clock = Clock.fixed(Instant.parse("2026-03-14T12:00:00Z"), ZoneOffset.UTC)

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
