package net.bobinski.portfolio.api.domain.service

import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.Serializable
import net.bobinski.portfolio.api.config.AppJsonFactory
import net.bobinski.portfolio.api.domain.model.AppPreference
import net.bobinski.portfolio.api.domain.model.OperationalStateEntry
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryAppPreferenceRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryOperationalStateRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test

class OperationalStateServiceTest {
    private val clock = Clock.fixed(Instant.parse("2026-03-27T12:00:00Z"), ZoneOffset.UTC)
    private val json = AppJsonFactory.create()

    @Test
    fun `typed read migrates a legacy preference and removes the duplicate`() = runBlocking {
        val legacyRepository = InMemoryAppPreferenceRepository()
        val operationalRepository = InMemoryOperationalStateRepository()
        val legacyUpdatedAt = Instant.parse("2026-03-26T08:30:00Z")
        legacyRepository.save(
            AppPreference(
                key = OperationalStateKeys.ACTIVE_ALERTS,
                valueJson = json.encodeToString(TestState.serializer(), TestState(listOf("alert-1"))),
                updatedAt = legacyUpdatedAt
            )
        )
        val service = service(operationalRepository, legacyRepository)

        val state = service.get(
            key = OperationalStateKeys.ACTIVE_ALERTS,
            serializer = TestState.serializer(),
            defaultValue = { TestState(emptyList()) }
        )

        assertEquals(TestState(listOf("alert-1")), state)
        assertEquals(legacyUpdatedAt, operationalRepository.get(OperationalStateKeys.ACTIVE_ALERTS)?.updatedAt)
        assertNull(legacyRepository.get(OperationalStateKeys.ACTIVE_ALERTS))
    }

    @Test
    fun `read-through never overwrites newer operational state`() = runBlocking {
        val legacyRepository = InMemoryAppPreferenceRepository()
        val operationalRepository = InMemoryOperationalStateRepository()
        operationalRepository.save(
            OperationalStateEntry(
                key = OperationalStateKeys.ACTIVE_ALERTS,
                valueJson = json.encodeToString(TestState.serializer(), TestState(listOf("current"))),
                updatedAt = Instant.parse("2026-03-27T11:00:00Z")
            )
        )
        legacyRepository.save(
            AppPreference(
                key = OperationalStateKeys.ACTIVE_ALERTS,
                valueJson = json.encodeToString(TestState.serializer(), TestState(listOf("legacy"))),
                updatedAt = Instant.parse("2026-03-20T11:00:00Z")
            )
        )

        val state = service(operationalRepository, legacyRepository).getOrNull(
            key = OperationalStateKeys.ACTIVE_ALERTS,
            serializer = TestState.serializer()
        )

        assertEquals(TestState(listOf("current")), state)
        assertNotNull(legacyRepository.get(OperationalStateKeys.ACTIVE_ALERTS))
    }

    @Test
    fun `prefix listing migrates legacy market data entries`() = runBlocking {
        val legacyRepository = InMemoryAppPreferenceRepository()
        val operationalRepository = InMemoryOperationalStateRepository()
        val key = "${OperationalStateKeys.MARKET_DATA_SNAPSHOT_PREFIX}quote.hash"
        legacyRepository.save(
            AppPreference(
                key = key,
                valueJson = "{\"price\":\"101.00\"}",
                updatedAt = Instant.parse("2026-03-26T11:00:00Z")
            )
        )

        val entries = service(operationalRepository, legacyRepository)
            .listByPrefix(OperationalStateKeys.MARKET_DATA_SNAPSHOT_PREFIX)

        assertEquals(listOf(key), entries.map(OperationalStateEntry::key))
        assertNotNull(operationalRepository.get(key))
        assertNull(legacyRepository.get(key))
    }

    private fun service(
        operationalRepository: InMemoryOperationalStateRepository,
        legacyRepository: InMemoryAppPreferenceRepository
    ): OperationalStateService = OperationalStateService(
        repository = operationalRepository,
        json = json,
        clock = clock,
        legacyPreferenceRepository = legacyRepository
    )

    @Serializable
    private data class TestState(val ids: List<String>)
}
