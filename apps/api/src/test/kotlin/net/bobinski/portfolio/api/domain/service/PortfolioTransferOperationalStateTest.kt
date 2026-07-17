package net.bobinski.portfolio.api.domain.service

import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import kotlinx.coroutines.runBlocking
import net.bobinski.portfolio.api.config.AppJsonFactory
import net.bobinski.portfolio.api.domain.model.AppPreference
import net.bobinski.portfolio.api.domain.model.OperationalStateEntry
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryAccountRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryAppPreferenceRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryAuditEventRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryInstrumentRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryOperationalStateRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryPortfolioTargetRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryTransactionImportProfileRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryTransactionRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class PortfolioTransferOperationalStateTest {
    private val clock = Clock.fixed(Instant.parse("2026-03-27T12:00:00Z"), ZoneOffset.UTC)

    @Test
    fun `legacy manual instrument remains importable and exportable without blocking`() = runBlocking {
        val legacyInstrument = InstrumentSnapshot(
            id = "31000000-0000-0000-0000-000000000001",
            name = "Legacy manual ETF",
            kind = "ETF",
            assetClass = "EQUITIES",
            symbol = "VWCE.DE",
            currency = "EUR",
            valuationSource = "MANUAL",
            edoTerms = null,
            isActive = true,
            createdAt = "2026-03-20T10:00:00Z",
            updatedAt = "2026-03-21T11:00:00Z"
        )

        ImportMode.entries.forEach { mode ->
            val fixture = fixture()
            val request = PortfolioImportRequest(
                mode = mode,
                snapshot = emptySnapshot(appPreferences = emptyList()).copy(
                    instruments = listOf(legacyInstrument)
                )
            )

            val preview = fixture.transferService.previewImport(request)

            assertTrue(preview.isValid)
            assertEquals(0, preview.blockingIssueCount)
            assertEquals(1, preview.snapshotInstrumentCount)

            val result = fixture.transferService.importState(request)

            assertEquals(1, result.instrumentCount)
            val imported = fixture.instrumentRepository.list().single()
            assertEquals("ETF", imported.kind.name)
            assertEquals("MANUAL", imported.valuationSource.name)
            assertEquals("VWCE.DE", imported.symbol)
            assertEquals(legacyInstrument, fixture.transferService.exportState().instruments.single())
        }
    }

    @Test
    fun `export and preview counts include user settings but exclude operational state`() = runBlocking {
        val fixture = fixture()
        listOf(
            preference(PortfolioBenchmarkSettingsService.PREFERENCE_KEY, "{\"enabled\":true}"),
            preference(PortfolioRebalancingSettingsService.PREFERENCE_KEY, "{\"threshold\":\"5\"}"),
            preference("portfolio.alert-settings", "{\"enabled\":true}"),
            preference(OperationalStateKeys.ACTIVE_ALERTS, "{\"activeAlertIds\":[]}"),
            preference("${OperationalStateKeys.MARKET_DATA_SNAPSHOT_PREFIX}quote.hash", "{\"price\":\"101\"}"),
            preference("${OperationalStateKeys.PORTFOLIO_MARKET_DATA_PREFIX}quote.hash", "{\"price\":\"102\"}")
        ).forEach { stored -> fixture.appPreferenceRepository.save(stored) }

        val exported = fixture.transferService.exportState()
        val preview = fixture.transferService.previewImport(
            PortfolioImportRequest(
                mode = ImportMode.MERGE,
                snapshot = exported.copy(
                    appPreferences = exported.appPreferences + listOf(
                        preferenceSnapshot(OperationalStateKeys.ACTIVE_ALERTS, "{\"activeAlertIds\":[\"old\"]}"),
                        preferenceSnapshot(
                            "${OperationalStateKeys.PORTFOLIO_MARKET_DATA_PREFIX}quote.backup",
                            "{\"price\":\"99\"}"
                        )
                    )
                )
            )
        )

        assertEquals(
            listOf(
                "portfolio.alert-settings",
                PortfolioBenchmarkSettingsService.PREFERENCE_KEY,
                PortfolioRebalancingSettingsService.PREFERENCE_KEY
            ),
            exported.appPreferences.map(AppPreferenceSnapshot::key)
        )
        assertEquals(3, preview.snapshotAppPreferenceCount)
        assertEquals(3, preview.existingAppPreferenceCount)
        assertEquals(3, preview.matchingAppPreferenceCount)
        assertEquals(3, preview.diff.appPreferences.unchangedCount)
        assertEquals(0, preview.diff.appPreferences.createdCount)
    }

    @Test
    fun `merge and replace imports preserve operational state and ignore runtime entries from old snapshots`() =
        runBlocking {
            ImportMode.entries.forEach { mode ->
                val fixture = fixture()
                val currentOperationalState = OperationalStateEntry(
                    key = OperationalStateKeys.ACTIVE_ALERTS,
                    valueJson = "{\"activeAlertIds\":[\"current\"]}",
                    updatedAt = Instant.parse("2026-03-27T11:00:00Z")
                )
                fixture.operationalStateRepository.save(currentOperationalState)
                fixture.appPreferenceRepository.save(
                    preference(PortfolioBenchmarkSettingsService.PREFERENCE_KEY, "{\"enabled\":true}")
                )
                fixture.appPreferenceRepository.save(
                    preference(OperationalStateKeys.ACTIVE_ALERTS, "{\"activeAlertIds\":[\"legacy\"]}")
                )

                val result = fixture.transferService.importState(
                    PortfolioImportRequest(
                        mode = mode,
                        snapshot = emptySnapshot(
                            appPreferences = listOf(
                                preferenceSnapshot("portfolio.alert-settings", "{\"enabled\":false}"),
                                preferenceSnapshot(
                                    OperationalStateKeys.ACTIVE_ALERTS,
                                    "{\"activeAlertIds\":[\"incoming\"]}"
                                ),
                                preferenceSnapshot(
                                    "${OperationalStateKeys.PORTFOLIO_MARKET_DATA_PREFIX}quote.hash",
                                    "{\"price\":\"999\"}"
                                )
                            )
                        )
                    )
                )

                assertEquals(1, result.appPreferenceCount)
                assertEquals(currentOperationalState, fixture.operationalStateRepository.get(OperationalStateKeys.ACTIVE_ALERTS))
                assertNotNull(fixture.appPreferenceRepository.get(OperationalStateKeys.ACTIVE_ALERTS))
                assertNull(
                    fixture.appPreferenceRepository.get(
                        "${OperationalStateKeys.PORTFOLIO_MARKET_DATA_PREFIX}quote.hash"
                    )
                )

                OperationalStateService(
                    repository = fixture.operationalStateRepository,
                    json = AppJsonFactory.create(),
                    clock = clock,
                    legacyPreferenceRepository = fixture.appPreferenceRepository
                ).listByPrefix("portfolio.alerts")

                assertEquals(currentOperationalState, fixture.operationalStateRepository.get(OperationalStateKeys.ACTIVE_ALERTS))
                assertNull(fixture.appPreferenceRepository.get(OperationalStateKeys.ACTIVE_ALERTS))
            }
        }

    private fun fixture(): Fixture {
        val appPreferenceRepository = InMemoryAppPreferenceRepository()
        val instrumentRepository = InMemoryInstrumentRepository()
        val operationalStateRepository = InMemoryOperationalStateRepository()
        val auditLogService = AuditLogService(InMemoryAuditEventRepository(), clock)
        return Fixture(
            appPreferenceRepository = appPreferenceRepository,
            instrumentRepository = instrumentRepository,
            operationalStateRepository = operationalStateRepository,
            transferService = PortfolioTransferService(
                accountRepository = InMemoryAccountRepository(),
                appPreferenceRepository = appPreferenceRepository,
                instrumentRepository = instrumentRepository,
                portfolioTargetRepository = InMemoryPortfolioTargetRepository(),
                transactionRepository = InMemoryTransactionRepository(),
                transactionImportProfileRepository = InMemoryTransactionImportProfileRepository(),
                transactionRunner = object : PersistenceTransactionRunner {
                    override suspend fun <T> inTransaction(block: suspend () -> T): T = block()
                },
                auditLogService = auditLogService,
                clock = clock
            )
        )
    }

    private fun emptySnapshot(appPreferences: List<AppPreferenceSnapshot>) = PortfolioSnapshot(
        schemaVersion = 4,
        exportedAt = Instant.now(clock),
        accounts = emptyList(),
        appPreferences = appPreferences,
        instruments = emptyList(),
        transactions = emptyList()
    )

    private fun preference(key: String, valueJson: String) = AppPreference(
        key = key,
        valueJson = valueJson,
        updatedAt = Instant.parse("2026-03-27T10:00:00Z")
    )

    private fun preferenceSnapshot(key: String, valueJson: String) = AppPreferenceSnapshot(
        key = key,
        valueJson = valueJson,
        updatedAt = "2026-03-27T10:00:00Z"
    )

    private data class Fixture(
        val appPreferenceRepository: InMemoryAppPreferenceRepository,
        val instrumentRepository: InMemoryInstrumentRepository,
        val operationalStateRepository: InMemoryOperationalStateRepository,
        val transferService: PortfolioTransferService
    )
}
