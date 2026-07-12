package net.bobinski.portfolio.api.domain.service

import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.Serializable
import net.bobinski.portfolio.api.config.AppJsonFactory
import net.bobinski.portfolio.api.domain.model.AppPreference
import net.bobinski.portfolio.api.domain.model.OperationalStateEntry
import net.bobinski.portfolio.api.domain.repository.AppPreferenceRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryAppPreferenceRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryOperationalStateRepository
import org.junit.jupiter.api.Assertions.assertEquals
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
    fun `read-through keeps newer operational state and removes only the observed legacy version`() = runBlocking {
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
        assertNull(legacyRepository.get(OperationalStateKeys.ACTIVE_ALERTS))
    }

    @Test
    fun `read-through promotes newer legacy state over an older operational entry`() = runBlocking {
        val legacyRepository = InMemoryAppPreferenceRepository()
        val operationalRepository = InMemoryOperationalStateRepository()
        operationalRepository.save(
            OperationalStateEntry(
                key = OperationalStateKeys.ACTIVE_ALERTS,
                valueJson = json.encodeToString(TestState.serializer(), TestState(listOf("old-operational"))),
                updatedAt = Instant.parse("2026-03-20T11:00:00Z")
            )
        )
        legacyRepository.save(
            AppPreference(
                key = OperationalStateKeys.ACTIVE_ALERTS,
                valueJson = json.encodeToString(TestState.serializer(), TestState(listOf("new-legacy"))),
                updatedAt = Instant.parse("2026-03-27T11:00:00Z")
            )
        )

        val state = service(operationalRepository, legacyRepository).getOrNull(
            key = OperationalStateKeys.ACTIVE_ALERTS,
            serializer = TestState.serializer()
        )

        assertEquals(TestState(listOf("new-legacy")), state)
        assertEquals(
            Instant.parse("2026-03-27T11:00:00Z"),
            operationalRepository.get(OperationalStateKeys.ACTIVE_ALERTS)?.updatedAt
        )
        assertNull(legacyRepository.get(OperationalStateKeys.ACTIVE_ALERTS))
    }

    @Test
    fun `prefix listing promotes newer legacy market data over an older operational entry`() = runBlocking {
        val legacyRepository = InMemoryAppPreferenceRepository()
        val operationalRepository = InMemoryOperationalStateRepository()
        val key = "${OperationalStateKeys.MARKET_DATA_SNAPSHOT_PREFIX}quote.hash"
        operationalRepository.save(
            OperationalStateEntry(
                key = key,
                valueJson = "{\"price\":\"90.00\"}",
                updatedAt = Instant.parse("2026-03-20T11:00:00Z")
            )
        )
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
        assertEquals("{\"price\":\"101.00\"}", entries.single().valueJson)
        assertEquals(Instant.parse("2026-03-26T11:00:00Z"), operationalRepository.get(key)?.updatedAt)
        assertNull(legacyRepository.get(key))
    }

    @Test
    fun `concurrent late legacy write is not deleted and is reconciled on the next read`() = runBlocking {
        val delegate = InMemoryAppPreferenceRepository()
        val operationalRepository = InMemoryOperationalStateRepository()
        val key = OperationalStateKeys.ACTIVE_ALERTS
        val observed = AppPreference(
            key = key,
            valueJson = json.encodeToString(TestState.serializer(), TestState(listOf("observed"))),
            updatedAt = Instant.parse("2026-03-27T10:00:00Z")
        )
        val concurrent = AppPreference(
            key = key,
            valueJson = json.encodeToString(TestState.serializer(), TestState(listOf("concurrent"))),
            updatedAt = Instant.parse("2026-03-27T11:00:00Z")
        )
        delegate.save(observed)
        val legacyRepository = ReplacingOnDeletePreferenceRepository(
            delegate = delegate,
            replacement = concurrent
        )
        val stateService = service(operationalRepository, legacyRepository)

        val firstRead = stateService.getOrNull(key, TestState.serializer())

        assertEquals(TestState(listOf("observed")), firstRead)
        assertEquals(concurrent, delegate.get(key))

        val secondRead = stateService.getOrNull(key, TestState.serializer())

        assertEquals(TestState(listOf("concurrent")), secondRead)
        assertEquals(concurrent.updatedAt, operationalRepository.get(key)?.updatedAt)
        assertNull(delegate.get(key))
    }

    private fun service(
        operationalRepository: InMemoryOperationalStateRepository,
        legacyRepository: AppPreferenceRepository
    ): OperationalStateService = OperationalStateService(
        repository = operationalRepository,
        json = json,
        clock = clock,
        legacyPreferenceRepository = legacyRepository
    )

    @Serializable
    private data class TestState(val ids: List<String>)
}

private class ReplacingOnDeletePreferenceRepository(
    private val delegate: AppPreferenceRepository,
    private val replacement: AppPreference
) : AppPreferenceRepository by delegate {
    private var replaced = false

    override suspend fun deleteIfUnchanged(preference: AppPreference): Boolean {
        if (!replaced) {
            replaced = true
            delegate.save(replacement)
        }
        return delegate.deleteIfUnchanged(preference)
    }
}
