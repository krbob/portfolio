package net.bobinski.portfolio.api.domain.service

import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.Serializable
import net.bobinski.portfolio.api.config.AppJsonFactory
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryReadModelCacheRepository
import org.junit.jupiter.api.Assertions.assertEquals
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
}
