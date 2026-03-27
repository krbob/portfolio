package net.bobinski.portfolio.api.persistence.jdbc

import java.math.BigDecimal
import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.time.YearMonth
import java.time.ZoneOffset
import java.util.UUID
import kotlin.io.path.createTempDirectory
import kotlin.io.path.deleteIfExists
import kotlin.io.path.div
import kotlinx.coroutines.runBlocking
import net.bobinski.portfolio.api.domain.model.Account
import net.bobinski.portfolio.api.domain.model.AccountType
import net.bobinski.portfolio.api.domain.model.AssetClass
import net.bobinski.portfolio.api.domain.model.EdoTerms
import net.bobinski.portfolio.api.domain.model.Instrument
import net.bobinski.portfolio.api.domain.model.InstrumentKind
import net.bobinski.portfolio.api.domain.model.PortfolioTarget
import net.bobinski.portfolio.api.domain.model.Transaction
import net.bobinski.portfolio.api.domain.model.TransactionType
import net.bobinski.portfolio.api.domain.model.ValuationSource
import net.bobinski.portfolio.api.domain.repository.AccountRepository
import net.bobinski.portfolio.api.domain.repository.AppPreferenceRepository
import net.bobinski.portfolio.api.domain.repository.AuditEventRepository
import net.bobinski.portfolio.api.domain.repository.InstrumentRepository
import net.bobinski.portfolio.api.domain.repository.PortfolioTargetRepository
import net.bobinski.portfolio.api.domain.repository.TransactionRepository
import net.bobinski.portfolio.api.domain.repository.TransactionImportProfileRepository
import net.bobinski.portfolio.api.domain.service.AppPreferenceService
import net.bobinski.portfolio.api.domain.service.AuditLogService
import net.bobinski.portfolio.api.domain.service.PersistenceTransactionRunner
import net.bobinski.portfolio.api.domain.service.PortfolioAllocationService
import net.bobinski.portfolio.api.domain.service.PortfolioOverview
import net.bobinski.portfolio.api.domain.service.PortfolioReadModelService
import net.bobinski.portfolio.api.domain.service.PortfolioRebalancingSettingsService
import net.bobinski.portfolio.api.domain.service.PortfolioTransferService
import net.bobinski.portfolio.api.domain.service.TransactionFxConversionService
import net.bobinski.portfolio.api.marketdata.service.CurrentInstrumentValuationProvider
import net.bobinski.portfolio.api.marketdata.service.FxRateHistoryProvider
import net.bobinski.portfolio.api.marketdata.service.FxRateHistoryResult
import net.bobinski.portfolio.api.marketdata.service.InstrumentValuationFailureType
import net.bobinski.portfolio.api.marketdata.service.InstrumentValuationResult
import net.bobinski.portfolio.api.persistence.config.JournalMode
import net.bobinski.portfolio.api.persistence.config.PersistenceConfig
import net.bobinski.portfolio.api.persistence.config.SynchronousMode
import net.bobinski.portfolio.api.persistence.db.PersistenceResources
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryAccountRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryAppPreferenceRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryAuditEventRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryInstrumentRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryPortfolioTargetRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryTransactionRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryTransactionImportProfileRepository
import kotlinx.serialization.json.Json
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

class JdbcParityTest {

    @Test
    fun `sqlite matches in-memory behavior for core portfolio read paths`() = runBlocking {
        val inMemoryOutputs = inMemoryHarness().use { harness ->
            harness.seedFixture()
            harness.outputs()
        }
        val sqliteOutputs = sqliteHarness().use { harness ->
            harness.seedFixture()
            harness.outputs()
        }

        assertEquals(inMemoryOutputs, sqliteOutputs)
    }

    private fun inMemoryHarness(): Harness = Harness(
        accountRepository = InMemoryAccountRepository(),
        appPreferenceRepository = InMemoryAppPreferenceRepository(),
        instrumentRepository = InMemoryInstrumentRepository(),
        transactionRepository = InMemoryTransactionRepository(),
        transactionImportProfileRepository = InMemoryTransactionImportProfileRepository(),
        portfolioTargetRepository = InMemoryPortfolioTargetRepository(),
        auditEventRepository = InMemoryAuditEventRepository(),
        transactionRunner = object : PersistenceTransactionRunner {
            override suspend fun <T> inTransaction(block: suspend () -> T): T = block()
        },
        closeAction = {}
    )

    private fun sqliteHarness(): Harness {
        val directory = createTempDirectory("portfolio-sqlite-parity-test")
        val databasePath = directory.resolve("portfolio.db")
        val resources = PersistenceResources(
            PersistenceConfig(
                databasePath = databasePath.toString(),
                journalMode = JournalMode.WAL,
                synchronousMode = SynchronousMode.FULL,
                busyTimeoutMs = 5_000
            )
        )
        val connectionManager = JdbcConnectionManager(resources.dataSource)

        return Harness(
            accountRepository = JdbcAccountRepository(connectionManager),
            appPreferenceRepository = JdbcAppPreferenceRepository(connectionManager),
            instrumentRepository = JdbcInstrumentRepository(connectionManager),
            transactionRepository = JdbcTransactionRepository(connectionManager),
            transactionImportProfileRepository = JdbcTransactionImportProfileRepository(connectionManager, Json.Default),
            portfolioTargetRepository = JdbcPortfolioTargetRepository(connectionManager),
            auditEventRepository = JdbcAuditEventRepository(resources.dataSource, Json.Default),
            transactionRunner = connectionManager,
            closeAction = {
                resources.close()
                (directory / "portfolio.db").deleteIfExists()
                (directory / "portfolio.db-shm").deleteIfExists()
                (directory / "portfolio.db-wal").deleteIfExists()
                directory.deleteIfExists()
            }
        )
    }

    private inner class Harness(
        private val accountRepository: AccountRepository,
        private val appPreferenceRepository: AppPreferenceRepository,
        private val instrumentRepository: InstrumentRepository,
        private val transactionRepository: TransactionRepository,
        private val transactionImportProfileRepository: TransactionImportProfileRepository,
        private val portfolioTargetRepository: PortfolioTargetRepository,
        private val auditEventRepository: AuditEventRepository,
        private val transactionRunner: PersistenceTransactionRunner,
        private val closeAction: () -> Unit
    ) : AutoCloseable {
        private val clock = Clock.fixed(Instant.parse("2026-03-15T12:00:00Z"), ZoneOffset.UTC)
        private val auditLogService = AuditLogService(auditEventRepository = auditEventRepository, clock = clock)
        private val rebalancingSettingsService = PortfolioRebalancingSettingsService(
            appPreferenceService = AppPreferenceService(
                repository = appPreferenceRepository,
                json = Json,
                clock = clock
            ),
            auditLogService = auditLogService,
            clock = clock
        )
        private val readModelService = PortfolioReadModelService(
            accountRepository = accountRepository,
            instrumentRepository = instrumentRepository,
            transactionRepository = transactionRepository,
            currentInstrumentValuationProvider = UnsupportedValuationProvider,
            edoLotValuationProvider = UnsupportedEdoLotValuationProvider,
            transactionFxConversionService = TransactionFxConversionService(NoopFxRateHistoryProvider),
            clock = clock
        )
        private val allocationService = PortfolioAllocationService(
            portfolioTargetRepository = portfolioTargetRepository,
            portfolioReadModelService = readModelService,
            rebalancingSettingsService = rebalancingSettingsService
        )
        private val transferService = PortfolioTransferService(
            accountRepository = accountRepository,
            appPreferenceRepository = appPreferenceRepository,
            instrumentRepository = instrumentRepository,
            portfolioTargetRepository = portfolioTargetRepository,
            transactionRepository = transactionRepository,
            transactionImportProfileRepository = transactionImportProfileRepository,
            transactionRunner = transactionRunner,
            auditLogService = auditLogService,
            clock = clock
        )
        suspend fun seedFixture() {
            accountRepository.save(account("Primary Brokerage", "Broker A", UUID.fromString("70000000-0000-0000-0000-000000000001")))
            accountRepository.save(account("Retirement Brokerage", "Broker B", UUID.fromString("70000000-0000-0000-0000-000000000002")))

            instrumentRepository.save(vwraInstrument())
            instrumentRepository.save(edoInstrument())

            transactionRepository.save(
                transaction(
                    id = UUID.fromString("71000000-0000-0000-0000-000000000001"),
                    accountId = UUID.fromString("70000000-0000-0000-0000-000000000001"),
                    instrumentId = null,
                    type = TransactionType.DEPOSIT,
                    tradeDate = LocalDate.parse("2025-01-10"),
                    quantity = null,
                    unitPrice = null,
                    grossAmount = BigDecimal("15000.00"),
                    currency = "PLN"
                )
            )
            transactionRepository.save(
                transaction(
                    id = UUID.fromString("71000000-0000-0000-0000-000000000002"),
                    accountId = UUID.fromString("70000000-0000-0000-0000-000000000001"),
                    instrumentId = UUID.fromString("70010000-0000-0000-0000-000000000001"),
                    type = TransactionType.BUY,
                    tradeDate = LocalDate.parse("2025-01-15"),
                    quantity = BigDecimal("8.5000"),
                    unitPrice = BigDecimal("450.00"),
                    grossAmount = BigDecimal("3825.00"),
                    currency = "PLN",
                    feeAmount = BigDecimal("5.00")
                )
            )
            transactionRepository.save(
                transaction(
                    id = UUID.fromString("71000000-0000-0000-0000-000000000003"),
                    accountId = UUID.fromString("70000000-0000-0000-0000-000000000002"),
                    instrumentId = null,
                    type = TransactionType.DEPOSIT,
                    tradeDate = LocalDate.parse("2025-02-01"),
                    quantity = null,
                    unitPrice = null,
                    grossAmount = BigDecimal("8000.00"),
                    currency = "PLN"
                )
            )
            transactionRepository.save(
                transaction(
                    id = UUID.fromString("71000000-0000-0000-0000-000000000004"),
                    accountId = UUID.fromString("70000000-0000-0000-0000-000000000002"),
                    instrumentId = UUID.fromString("70010000-0000-0000-0000-000000000002"),
                    type = TransactionType.BUY,
                    tradeDate = LocalDate.parse("2025-02-05"),
                    quantity = BigDecimal("25"),
                    unitPrice = BigDecimal("100.00"),
                    grossAmount = BigDecimal("2500.00"),
                    currency = "PLN"
                )
            )

            portfolioTargetRepository.replaceAll(
                listOf(
                    target(
                        id = UUID.fromString("72000000-0000-0000-0000-000000000001"),
                        assetClass = AssetClass.EQUITIES,
                        targetWeight = BigDecimal("0.80")
                    ),
                    target(
                        id = UUID.fromString("72000000-0000-0000-0000-000000000002"),
                        assetClass = AssetClass.BONDS,
                        targetWeight = BigDecimal("0.20")
                    )
                )
            )
        }

        suspend fun outputs(): HarnessOutputs = HarnessOutputs(
            overview = readModelService.overview(),
            holdings = readModelService.holdings(),
            allocationSummary = allocationService.summary(),
            exportedState = transferService.exportState()
        )

        override fun close() {
            closeAction()
        }
    }

    private data class HarnessOutputs(
        val overview: PortfolioOverview,
        val holdings: List<net.bobinski.portfolio.api.domain.service.HoldingSnapshot>,
        val allocationSummary: net.bobinski.portfolio.api.domain.service.PortfolioAllocationSummary,
        val exportedState: net.bobinski.portfolio.api.domain.service.PortfolioSnapshot
    )

    private fun account(name: String, institution: String, id: UUID) = Account(
        id = id,
        name = name,
        institution = institution,
        type = AccountType.BROKERAGE,
        baseCurrency = "PLN",
        isActive = true,
        createdAt = Instant.parse("2025-01-01T12:00:00Z"),
        updatedAt = Instant.parse("2025-01-01T12:00:00Z")
    )

    private fun vwraInstrument() = Instrument(
        id = UUID.fromString("70010000-0000-0000-0000-000000000001"),
        name = "Vanguard FTSE All-World",
        kind = InstrumentKind.ETF,
        assetClass = AssetClass.EQUITIES,
        symbol = "VWRA.L",
        currency = "USD",
        valuationSource = ValuationSource.STOCK_ANALYST,
        isActive = true,
        createdAt = Instant.parse("2025-01-01T12:10:00Z"),
        updatedAt = Instant.parse("2025-01-01T12:10:00Z")
    )

    private fun edoInstrument() = Instrument(
        id = UUID.fromString("70010000-0000-0000-0000-000000000002"),
        name = "EDO 2035/02",
        kind = InstrumentKind.BOND_EDO,
        assetClass = AssetClass.BONDS,
        symbol = null,
        currency = "PLN",
        valuationSource = ValuationSource.EDO_CALCULATOR,
        edoTerms = EdoTerms(
            seriesMonth = YearMonth.parse("2025-02"),
            firstPeriodRateBps = 270,
            marginBps = 150
        ),
        isActive = true,
        createdAt = Instant.parse("2025-02-01T12:10:00Z"),
        updatedAt = Instant.parse("2025-02-01T12:10:00Z")
    )

    private fun transaction(
        id: UUID,
        accountId: UUID,
        instrumentId: UUID?,
        type: TransactionType,
        tradeDate: LocalDate,
        quantity: BigDecimal?,
        unitPrice: BigDecimal?,
        grossAmount: BigDecimal,
        currency: String,
        feeAmount: BigDecimal = BigDecimal.ZERO,
        taxAmount: BigDecimal = BigDecimal.ZERO
    ) = Transaction(
        id = id,
        accountId = accountId,
        instrumentId = instrumentId,
        type = type,
        tradeDate = tradeDate,
        settlementDate = tradeDate,
        quantity = quantity,
        unitPrice = unitPrice,
        grossAmount = grossAmount,
        feeAmount = feeAmount,
        taxAmount = taxAmount,
        currency = currency,
        fxRateToPln = null,
        notes = "",
        createdAt = tradeDate.atStartOfDay().toInstant(ZoneOffset.UTC),
        updatedAt = tradeDate.atStartOfDay().toInstant(ZoneOffset.UTC)
    )

    private fun target(
        id: UUID,
        assetClass: AssetClass,
        targetWeight: BigDecimal
    ) = PortfolioTarget(
        id = id,
        assetClass = assetClass,
        targetWeight = targetWeight,
        createdAt = Instant.parse("2026-03-15T12:00:00Z"),
        updatedAt = Instant.parse("2026-03-15T12:00:00Z")
    )

    private object UnsupportedValuationProvider : CurrentInstrumentValuationProvider {
        override suspend fun value(instrument: Instrument): InstrumentValuationResult =
            InstrumentValuationResult.Failure(
                type = InstrumentValuationFailureType.UNSUPPORTED,
                reason = "Parity test uses book basis only."
            )
    }

    private object UnsupportedEdoLotValuationProvider : net.bobinski.portfolio.api.marketdata.service.EdoLotValuationProvider {
        override suspend fun value(lotTerms: net.bobinski.portfolio.api.domain.model.EdoLotTerms): InstrumentValuationResult =
            InstrumentValuationResult.Failure(
                type = InstrumentValuationFailureType.UNSUPPORTED,
                reason = "Parity test uses book basis only."
            )

        override suspend fun dailyPriceSeries(
            lotTerms: net.bobinski.portfolio.api.domain.model.EdoLotTerms,
            from: LocalDate,
            to: LocalDate
        ) = throw UnsupportedOperationException("Not used in parity tests.")
    }

    private object NoopFxRateHistoryProvider : FxRateHistoryProvider {
        override suspend fun dailyRateToPln(
            currency: String,
            from: LocalDate,
            to: LocalDate
        ): FxRateHistoryResult = FxRateHistoryResult.Failure("Parity test uses only PLN cash flows.")
    }
}
