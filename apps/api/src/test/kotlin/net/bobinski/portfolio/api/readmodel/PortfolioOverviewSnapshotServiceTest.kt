package net.bobinski.portfolio.api.readmodel

import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import java.util.concurrent.atomic.AtomicInteger
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.async
import kotlinx.coroutines.runBlocking
import net.bobinski.portfolio.api.config.AppJsonFactory
import net.bobinski.portfolio.api.domain.service.ReadModelCacheDescriptor
import net.bobinski.portfolio.api.domain.service.ReadModelComputationCoordinator
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryReadModelCacheRepository
import net.bobinski.portfolio.api.route.PortfolioOverviewResponse
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class PortfolioOverviewSnapshotServiceTest {
    @Test
    fun `saved overview remains immediately readable while concurrent live reads wait for one refresh`() = runBlocking {
        ReadModelComputationCoordinator().use { coordinator ->
            val repository = InMemoryReadModelCacheRepository()
            val entered = CompletableDeferred<Unit>()
            val release = CompletableDeferred<Unit>()
            val calls = AtomicInteger()
            val initial = service(repository, coordinator) { overview("100.00") }
            initial.overview()
            val refreshing = service(repository, coordinator, secondsLater = 61) {
                calls.incrementAndGet()
                entered.complete(Unit)
                release.await()
                overview("120.00")
            }
            val first = async { refreshing.overview() }
            entered.await()
            val second = async(start = CoroutineStart.UNDISPATCHED) { refreshing.overview() }
            repeat(3) {
                val preview = refreshing.overview(preferCached = true)
                assertEquals("100.00", preview.totalCurrentValuePln)
                assertEquals(NOW.toString(), preview.valuationSnapshot?.generatedAt)
                assertTrue(preview.valuationSnapshot?.refreshRequired == true)
                assertTrue(preview.valuationSnapshot?.fromCache == true)
            }
            release.complete(Unit)
            assertEquals("120.00", first.await().totalCurrentValuePln)
            assertEquals("120.00", second.await().totalCurrentValuePln)
            assertEquals(1, calls.get())
            val preview = refreshing.overview(preferCached = true)
            assertFalse(preview.valuationSnapshot!!.refreshRequired)
            assertEquals("120.00", preview.totalCurrentValuePln)
            assertEquals(1, repository.list().size)
        }
    }

    @Test
    fun `saved overview survives service recreation and midnight with its original date`() = runBlocking {
        val repository = InMemoryReadModelCacheRepository()
        ReadModelComputationCoordinator().use { coordinator ->
            service(repository, coordinator) { overview("100.00") }.overview()
        }
        ReadModelComputationCoordinator().use { coordinator ->
            val nextDay = descriptor().copy(inputsTo = LocalDate.parse("2026-09-10"))
            val restored = service(repository, coordinator, secondsLater = 86_400, describe = { nextDay }) {
                error("Cached preview must not contact upstream")
            }.overview(preferCached = true)
            assertEquals("2026-09-09", restored.asOf)
            assertEquals(NOW.toString(), restored.valuationSnapshot?.generatedAt)
            assertTrue(restored.valuationSnapshot?.refreshRequired == true)
        }
    }

    @Test
    fun `failed or partial refresh preserves the last complete valuation and its timestamp`() = runBlocking {
        ReadModelComputationCoordinator().use { coordinator ->
            val repository = InMemoryReadModelCacheRepository()
            service(repository, coordinator) { overview("100.00") }.overview()
            val saved = repository.list().single()
            for (partial in listOf(false, true)) {
                val failed = service(repository, coordinator, secondsLater = 61) {
                    if (!partial) error("Provider unavailable")
                    overview("20.00").copy(valuationState = "PARTIALLY_VALUED", valuedHoldingCount = 0)
                }.overview()
                assertEquals("100.00", failed.totalCurrentValuePln)
                assertEquals(NOW.toString(), failed.valuationSnapshot?.generatedAt)
                assertTrue(failed.valuationSnapshot?.refreshFailed == true)
                assertTrue(failed.valuationSnapshot?.fromCache == true)
                assertEquals(saved, repository.list().single())
            }
        }
    }

    @Test
    fun `different ledger cannot use an old overview even if its revision timestamp is unchanged`() = runBlocking {
        ReadModelComputationCoordinator().use { coordinator ->
            val repository = InMemoryReadModelCacheRepository()
            service(repository, coordinator) { overview("100.00") }.overview()
            val changed = descriptor().copy(parameters = mapOf("canonicalInputs" to "different-ledger"))
            val updated = service(repository, coordinator, describe = { changed }) { overview("200.00") }
            assertEquals("200.00", updated.overview(preferCached = true).totalCurrentValuePln)
            assertEquals(1, repository.list().size)
        }
    }

    @Test
    fun `ledger mutation during refresh cannot publish obsolete totals`() = runBlocking {
        ReadModelComputationCoordinator().use { coordinator ->
            val repository = InMemoryReadModelCacheRepository()
            service(repository, coordinator) { overview("100.00") }.overview()
            val saved = repository.list().single()
            var current = descriptor()
            val refreshing = service(repository, coordinator, describe = { current }) {
                current = current.copy(parameters = mapOf("canonicalInputs" to "edited-ledger"))
                overview("120.00")
            }
            assertThrows(IllegalStateException::class.java) { runBlocking { refreshing.overview() } }
            assertEquals(saved, repository.list().single())
        }
    }

    @Test
    fun `partial first valuation is returned explicitly without saving it as a good snapshot`() = runBlocking {
        ReadModelComputationCoordinator().use { coordinator ->
            val repository = InMemoryReadModelCacheRepository()
            val result = service(repository, coordinator) {
                overview("20.00").copy(valuationState = "STALE")
            }.overview(preferCached = true)
            assertEquals("20.00", result.totalCurrentValuePln)
            assertTrue(result.valuationSnapshot?.refreshFailed == true)
            assertFalse(result.valuationSnapshot!!.fromCache)
            assertTrue(repository.list().isEmpty())
        }
    }

    private fun service(
        repository: InMemoryReadModelCacheRepository,
        coordinator: ReadModelComputationCoordinator,
        secondsLater: Long = 0,
        describe: suspend () -> ReadModelCacheDescriptor = { descriptor() },
        compute: suspend () -> PortfolioOverviewResponse
    ) = PortfolioOverviewSnapshotService(
        repository, AppJsonFactory.create(), Clock.fixed(NOW.plusSeconds(secondsLater), ZoneOffset.UTC),
        coordinator, describe, compute
    )

    private fun descriptor() = ReadModelCacheDescriptor(
        cacheKey = "portfolio.overview", modelName = "OVERVIEW", modelVersion = 1,
        inputsFrom = LocalDate.parse("2026-01-01"), inputsTo = LocalDate.parse("2026-09-09"),
        sourceUpdatedAt = NOW.minusSeconds(100), parameters = mapOf("canonicalInputs" to "original-ledger")
    )

    private fun overview(value: String) = PortfolioOverviewResponse(
        asOf = "2026-09-09", valuationState = "MARK_TO_MARKET", totalBookValuePln = "100.00",
        totalCurrentValuePln = value, investedBookValuePln = "100.00", investedCurrentValuePln = value,
        cashBalancePln = "0.00", netContributionsPln = "100.00", equityBookValuePln = "100.00",
        equityCurrentValuePln = value, bondBookValuePln = "0.00", bondCurrentValuePln = "0.00",
        cashBookValuePln = "0.00", cashCurrentValuePln = "0.00", totalUnrealizedGainPln = "0.00",
        accountCount = 1, instrumentCount = 1, activeHoldingCount = 1, valuedHoldingCount = 1,
        unvaluedHoldingCount = 0, valuationIssueCount = 0, missingFxTransactions = 0,
        unsupportedCorrectionTransactions = 0
    )

    private companion object {
        val NOW: Instant = Instant.parse("2026-09-09T10:00:00Z")
    }
}
