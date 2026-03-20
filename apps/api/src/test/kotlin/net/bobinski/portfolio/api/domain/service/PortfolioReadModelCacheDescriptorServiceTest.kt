package net.bobinski.portfolio.api.domain.service

import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import kotlinx.coroutines.runBlocking
import net.bobinski.portfolio.api.config.AppJsonFactory
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryAccountRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryAppPreferenceRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryInstrumentRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryPortfolioTargetRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryReadModelCacheRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryTransactionRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class PortfolioReadModelCacheDescriptorServiceTest {

    @Test
    fun `daily history descriptor invalidates when market data config changes`() {
        val enabled = descriptorService(
            marketDataCacheFingerprint = "enabled=true"
        )
        val disabled = descriptorService(
            marketDataCacheFingerprint = "enabled=false"
        )

        val enabledDescriptor = runBlocking { enabled.dailyHistoryDescriptor() }
        val disabledDescriptor = runBlocking { disabled.dailyHistoryDescriptor() }

        assertTrue(enabledDescriptor.modelVersion > 0)
        assertTrue(disabledDescriptor.modelVersion > 0)
        assertNotEquals(enabledDescriptor.modelVersion, disabledDescriptor.modelVersion)
        assertEquals(enabledDescriptor.inputsFrom, disabledDescriptor.inputsFrom)
        assertEquals(enabledDescriptor.inputsTo, disabledDescriptor.inputsTo)
    }

    @Test
    fun `returns descriptor invalidates when market data key changes`() {
        val withoutKey = descriptorService(
            marketDataCacheFingerprint = "goldApiKey="
        )
        val withKey = descriptorService(
            marketDataCacheFingerprint = "goldApiKey=gold-key"
        )

        val withoutKeyDescriptor = runBlocking { withoutKey.returnsDescriptor() }
        val withKeyDescriptor = runBlocking { withKey.returnsDescriptor() }

        assertTrue(withoutKeyDescriptor.modelVersion > 0)
        assertTrue(withKeyDescriptor.modelVersion > 0)
        assertNotEquals(withoutKeyDescriptor.modelVersion, withKeyDescriptor.modelVersion)
        assertEquals(withoutKeyDescriptor.inputsFrom, withKeyDescriptor.inputsFrom)
        assertEquals(withoutKeyDescriptor.inputsTo, withKeyDescriptor.inputsTo)
    }

    @Test
    fun `read-model cache rebuilds when market data fingerprint changes`() {
        val cacheService = ReadModelCacheService(
            repository = InMemoryReadModelCacheRepository(),
            json = AppJsonFactory.create(),
            clock = fixedClock()
        )
        val firstDescriptor = runBlocking {
            descriptorService(marketDataCacheFingerprint = "enabled=false").dailyHistoryDescriptor()
        }
        val secondDescriptor = runBlocking {
            descriptorService(marketDataCacheFingerprint = "enabled=true").dailyHistoryDescriptor()
        }
        var computeCount = 0

        runBlocking {
            cacheService.getOrCompute(firstDescriptor, CachedPayload.serializer()) {
                computeCount += 1
                CachedPayload("book-only")
            }
        }
        val refreshed = runBlocking {
            cacheService.getOrCompute(secondDescriptor, CachedPayload.serializer()) {
                computeCount += 1
                CachedPayload("mark-to-market")
            }
        }
        val snapshot = runBlocking { cacheService.list().first() }

        assertEquals(CachedPayload("mark-to-market"), refreshed)
        assertEquals(2, computeCount)
        assertEquals(ReadModelCacheInvalidationReason.MODEL_VERSION_CHANGED, snapshot.invalidationReason)
    }

    private fun descriptorService(marketDataCacheFingerprint: String): PortfolioReadModelCacheDescriptorService =
        PortfolioReadModelCacheDescriptorService(
            accountRepository = InMemoryAccountRepository(),
            appPreferenceRepository = InMemoryAppPreferenceRepository(),
            instrumentRepository = InMemoryInstrumentRepository(),
            portfolioTargetRepository = InMemoryPortfolioTargetRepository(),
            transactionRepository = InMemoryTransactionRepository(),
            marketDataCacheFingerprint = marketDataCacheFingerprint,
            clock = fixedClock()
        )

    private fun fixedClock(): Clock = Clock.fixed(Instant.parse("2026-03-20T12:00:00Z"), ZoneOffset.UTC)

    @kotlinx.serialization.Serializable
    private data class CachedPayload(val value: String)
}
