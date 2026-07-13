package net.bobinski.portfolio.api.domain.service

import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import kotlinx.coroutines.runBlocking
import net.bobinski.portfolio.api.domain.model.Account
import net.bobinski.portfolio.api.domain.model.AccountType
import net.bobinski.portfolio.api.config.AppJsonFactory
import net.bobinski.portfolio.api.marketdata.model.HistoricalPricePoint
import net.bobinski.portfolio.api.marketdata.service.MarketDataSnapshotCacheService
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryAccountRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryAppPreferenceRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryInstrumentRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryOperationalStateRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryPortfolioTargetRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryReadModelCacheRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryTransactionRepository
import java.math.BigDecimal
import java.util.UUID
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class PortfolioReadModelCacheDescriptorServiceTest {

    @Test
    fun `canonical mutation changes revision and invalidates the cached computation`() = runBlocking {
        val accountRepository = InMemoryAccountRepository()
        val appPreferenceRepository = InMemoryAppPreferenceRepository()
        val instrumentRepository = InMemoryInstrumentRepository()
        val targetRepository = InMemoryPortfolioTargetRepository()
        val transactionRepository = InMemoryTransactionRepository()
        val json = AppJsonFactory.create()
        val descriptorService = PortfolioReadModelCacheDescriptorService(
            accountRepository = accountRepository,
            appPreferenceRepository = appPreferenceRepository,
            operationalStateService = OperationalStateService(
                repository = InMemoryOperationalStateRepository(),
                json = json,
                clock = fixedClock()
            ),
            instrumentRepository = instrumentRepository,
            portfolioTargetRepository = targetRepository,
            transactionRepository = transactionRepository,
            marketDataCacheFingerprint = "enabled=true",
            clock = fixedClock()
        )
        val cacheService = ReadModelCacheService(
            repository = InMemoryReadModelCacheRepository(),
            json = AppJsonFactory.create(),
            clock = fixedClock()
        )
        val original = Account(
            id = UUID.fromString("11111111-1111-1111-1111-111111111111"),
            name = "Brokerage",
            institution = "Broker",
            type = AccountType.BROKERAGE,
            baseCurrency = "PLN",
            isActive = true,
            createdAt = Instant.parse("2026-03-14T08:00:00Z"),
            updatedAt = Instant.parse("2026-03-14T08:00:00Z")
        )
        accountRepository.save(original)
        var computeCount = 0

        val beforeMutation = descriptorService.dailyHistoryDescriptor()
        cacheService.getOrCompute(beforeMutation, CachedPayload.serializer()) {
            computeCount += 1
            CachedPayload("before")
        }
        accountRepository.save(
            original.copy(
                name = "Primary brokerage",
                updatedAt = Instant.parse("2026-03-14T09:00:00Z")
            )
        )
        val afterMutation = descriptorService.dailyHistoryDescriptor()
        val result = cacheService.getOrCompute(afterMutation, CachedPayload.serializer()) {
            computeCount += 1
            CachedPayload("after")
        }

        assertNotEquals(beforeMutation.sourceUpdatedAt, afterMutation.sourceUpdatedAt)
        assertNotEquals(beforeMutation.canonicalRevision, afterMutation.canonicalRevision)
        assertEquals(CachedPayload("after"), result)
        assertEquals(2, computeCount)
    }

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
    fun `returns descriptor invalidates legacy unqualified cache generation`() {
        val descriptor = runBlocking {
            descriptorService(marketDataCacheFingerprint = "enabled=true").returnsDescriptor()
        }

        assertEquals(8, descriptor.modelVersion / CACHE_VERSION_MODULUS)
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

    @Test
    fun `descriptor tracks canonical market data updates instead of last check timestamp`() = runBlocking {
        val repository = InMemoryAppPreferenceRepository()
        val operationalStateRepository = InMemoryOperationalStateRepository()
        val json = AppJsonFactory.create()

        fun descriptor(clock: Clock) = PortfolioReadModelCacheDescriptorService(
            accountRepository = InMemoryAccountRepository(),
            appPreferenceRepository = repository,
            operationalStateService = OperationalStateService(
                repository = operationalStateRepository,
                json = json,
                clock = clock,
                legacyPreferenceRepository = repository
            ),
            instrumentRepository = InMemoryInstrumentRepository(),
            portfolioTargetRepository = InMemoryPortfolioTargetRepository(),
            transactionRepository = InMemoryTransactionRepository(),
            marketDataCacheFingerprint = "enabled=true",
            clock = clock
        )

        fun snapshotCache(clock: Clock) = MarketDataSnapshotCacheService(
            operationalStateService = OperationalStateService(
                repository = operationalStateRepository,
                json = json,
                clock = clock,
                legacyPreferenceRepository = repository
            ),
            clock = clock
        )

        val prices = listOf(
            HistoricalPricePoint(
                date = LocalDate.parse("2026-03-01"),
                closePricePln = BigDecimal("101.10")
            ),
            HistoricalPricePoint(
                date = LocalDate.parse("2026-03-03"),
                closePricePln = BigDecimal("102.45")
            )
        )

        val initialClock = Clock.fixed(Instant.parse("2026-03-27T12:00:00Z"), ZoneOffset.UTC)
        snapshotCache(initialClock).putSeries(identity = "VWRA.L", prices = prices)
        val initialDescriptor = descriptor(initialClock).dailyHistoryDescriptor()

        val recheckClock = Clock.fixed(Instant.parse("2026-03-27T12:30:00Z"), ZoneOffset.UTC)
        snapshotCache(recheckClock).putSeries(identity = "VWRA.L", prices = prices)
        val afterRecheckDescriptor = descriptor(recheckClock).dailyHistoryDescriptor()

        assertEquals(initialDescriptor.sourceUpdatedAt, afterRecheckDescriptor.sourceUpdatedAt)

        val changedClock = Clock.fixed(Instant.parse("2026-03-27T13:00:00Z"), ZoneOffset.UTC)
        snapshotCache(changedClock).putSeries(
            identity = "VWRA.L",
            prices = prices + HistoricalPricePoint(
                date = LocalDate.parse("2026-03-04"),
                closePricePln = BigDecimal("103.55")
            )
        )
        val changedDescriptor = descriptor(changedClock).dailyHistoryDescriptor()

        assertNotEquals(initialDescriptor.sourceUpdatedAt, changedDescriptor.sourceUpdatedAt)
        assertEquals(Instant.parse("2026-03-27T13:00:00Z"), changedDescriptor.sourceUpdatedAt)
    }

    private fun descriptorService(marketDataCacheFingerprint: String): PortfolioReadModelCacheDescriptorService =
        PortfolioReadModelCacheDescriptorService(
            accountRepository = InMemoryAccountRepository(),
            appPreferenceRepository = InMemoryAppPreferenceRepository(),
            operationalStateService = OperationalStateService(
                repository = InMemoryOperationalStateRepository(),
                json = AppJsonFactory.create(),
                clock = fixedClock()
            ),
            instrumentRepository = InMemoryInstrumentRepository(),
            portfolioTargetRepository = InMemoryPortfolioTargetRepository(),
            transactionRepository = InMemoryTransactionRepository(),
            marketDataCacheFingerprint = marketDataCacheFingerprint,
            clock = fixedClock()
        )

    private fun fixedClock(): Clock = Clock.fixed(Instant.parse("2026-03-20T12:00:00Z"), ZoneOffset.UTC)

    @kotlinx.serialization.Serializable
    private data class CachedPayload(val value: String)

    private companion object {
        const val CACHE_VERSION_MODULUS = 100_000_000
    }
}
