package net.bobinski.portfolio.api.persistence.jdbc

import java.math.BigDecimal
import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.time.YearMonth
import java.time.temporal.ChronoUnit
import java.util.UUID
import kotlin.io.path.createTempDirectory
import kotlin.io.path.deleteIfExists
import kotlin.io.path.div
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
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
import net.bobinski.portfolio.api.domain.repository.TransactionRepository
import net.bobinski.portfolio.api.domain.service.AccountSnapshot
import net.bobinski.portfolio.api.domain.service.AuditLogService
import net.bobinski.portfolio.api.domain.service.ImportMode
import net.bobinski.portfolio.api.domain.service.InstrumentSnapshot
import net.bobinski.portfolio.api.domain.service.PortfolioImportRequest
import net.bobinski.portfolio.api.domain.service.PortfolioSnapshot
import net.bobinski.portfolio.api.domain.service.PortfolioTransferService
import net.bobinski.portfolio.api.domain.service.TransactionSnapshot
import net.bobinski.portfolio.api.persistence.config.JournalMode
import net.bobinski.portfolio.api.persistence.config.PersistenceConfig
import net.bobinski.portfolio.api.persistence.config.SynchronousMode
import net.bobinski.portfolio.api.persistence.db.PersistenceResources
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryAuditEventRepository
import org.sqlite.SQLiteDataSource
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class JdbcWriteRepositoriesTest {

    @Test
    fun `sqlite write repositories persist accounts instruments transactions and targets`() = runBlocking {
        sqliteDatabase { dataSource ->
            val accountRepository = JdbcAccountRepository(dataSource)
            val instrumentRepository = JdbcInstrumentRepository(dataSource)
            val transactionRepository = JdbcTransactionRepository(dataSource)
            val portfolioTargetRepository = JdbcPortfolioTargetRepository(dataSource)

            val account = account()
            val instrument = edoInstrument()
            val transaction = buyTransaction(account.id, instrument.id)
            val target = portfolioTarget()

            accountRepository.save(account)
            instrumentRepository.save(instrument)
            transactionRepository.save(transaction)
            portfolioTargetRepository.replaceAll(listOf(target))

            assertEquals(listOf(account), accountRepository.list())
            assertEquals(instrument, instrumentRepository.get(instrument.id))
            assertEquals(transaction, transactionRepository.get(transaction.id))
            assertEquals(listOf(target), portfolioTargetRepository.list())

            assertTrue(transactionRepository.delete(transaction.id))
            assertNull(transactionRepository.get(transaction.id))
            assertFalse(transactionRepository.delete(transaction.id))
        }
    }

    @Test
    fun `sqlite instrument repository updates edo terms atomically`() = runBlocking {
        sqliteDatabase { dataSource ->
            val instrumentRepository = JdbcInstrumentRepository(dataSource)
            val initial = edoInstrument()
            val initialEdoTerms = requireNotNull(initial.edoTerms)
            val updated = initial.copy(
                name = "EDO 2036/03 updated",
                edoTerms = initialEdoTerms.copy(
                    marginBps = 180
                ),
                updatedAt = initial.updatedAt.plus(1, ChronoUnit.DAYS)
            )

            instrumentRepository.save(initial)
            instrumentRepository.save(updated)

            assertEquals(updated, instrumentRepository.get(updated.id))
        }
    }

    @Test
    fun `sqlite transaction repository persists redeem transactions on fresh schema`() = runBlocking {
        sqliteDatabase { dataSource ->
            val accountRepository = JdbcAccountRepository(dataSource)
            val instrumentRepository = JdbcInstrumentRepository(dataSource)
            val transactionRepository = JdbcTransactionRepository(dataSource)

            val account = account()
            val instrument = edoInstrument()
            val redeemTransaction = redeemTransaction(account.id, instrument.id)

            accountRepository.save(account)
            instrumentRepository.save(instrument)
            transactionRepository.save(redeemTransaction)

            assertEquals(redeemTransaction, transactionRepository.get(redeemTransaction.id))
        }
    }

    @Test
    fun `state export keeps one sqlite read snapshot across repository reads`() = runBlocking {
        sqliteDatabase { dataSource ->
            val connectionManager = JdbcConnectionManager(dataSource)
            val accountDelegate = JdbcAccountRepository(connectionManager)
            val transactionRepository = JdbcTransactionRepository(connectionManager)
            val initialAccount = account()
            val concurrentAccount = account().copy(
                id = UUID.fromString("20000000-0000-0000-0000-000000000002"),
                name = "Concurrent brokerage"
            )
            val concurrentTransaction = depositTransaction(
                id = UUID.fromString("40000000-0000-0000-0000-000000000003"),
                accountId = concurrentAccount.id
            )
            val jdbcUrl = dataSource.connection.use { connection -> connection.metaData.url }
            val writerDataSource = SQLiteDataSource().apply { url = jdbcUrl }
            val writerAccountRepository = JdbcAccountRepository(writerDataSource)
            val writerTransactionRepository = JdbcTransactionRepository(writerDataSource)
            var concurrentWriteCompleted = false
            val interleavingAccountRepository = object : AccountRepository {
                override suspend fun list(): List<Account> {
                    val accounts = accountDelegate.list()
                    if (!concurrentWriteCompleted) {
                        writerAccountRepository.save(concurrentAccount)
                        writerTransactionRepository.save(concurrentTransaction)
                        concurrentWriteCompleted = true
                    }
                    return accounts
                }

                override suspend fun get(id: UUID): Account? = accountDelegate.get(id)

                override suspend fun save(account: Account): Account = accountDelegate.save(account)

                override suspend fun saveAll(accounts: List<Account>) = accountDelegate.saveAll(accounts)

                override suspend fun deleteAll() = accountDelegate.deleteAll()
            }
            val transferService = PortfolioTransferService(
                accountRepository = interleavingAccountRepository,
                appPreferenceRepository = JdbcAppPreferenceRepository(connectionManager),
                instrumentRepository = JdbcInstrumentRepository(connectionManager),
                portfolioTargetRepository = JdbcPortfolioTargetRepository(connectionManager),
                transactionRepository = transactionRepository,
                transactionImportProfileRepository = JdbcTransactionImportProfileRepository(connectionManager, Json.Default),
                transactionRunner = connectionManager,
                auditLogService = AuditLogService(InMemoryAuditEventRepository(), Clock.systemUTC()),
                clock = Clock.systemUTC()
            )
            accountDelegate.save(initialAccount)

            val snapshot = transferService.exportState()

            assertTrue(concurrentWriteCompleted)
            assertEquals(listOf(initialAccount.id.toString()), snapshot.accounts.map { account -> account.id })
            assertTrue(snapshot.transactions.isEmpty())
            assertEquals(concurrentTransaction, writerTransactionRepository.get(concurrentTransaction.id))
        }
    }

    @Test
    fun `replace import rolls back all sqlite writes when a transaction save fails`() = runBlocking {
        sqliteDatabase { dataSource ->
            val connectionManager = JdbcConnectionManager(dataSource)
            val accountRepository = JdbcAccountRepository(connectionManager)
            val appPreferenceRepository = JdbcAppPreferenceRepository(connectionManager)
            val instrumentRepository = JdbcInstrumentRepository(connectionManager)
            val transactionDelegate = JdbcTransactionRepository(connectionManager)
            val failingTransactionId = UUID.fromString("40000000-0000-0000-0000-000000000099")
            val transactionRepository = object : TransactionRepository {
                override suspend fun list(): List<Transaction> = transactionDelegate.list()

                override suspend fun get(id: UUID): Transaction? = transactionDelegate.get(id)

                override suspend fun save(transaction: Transaction): Transaction {
                    if (transaction.id == failingTransactionId) {
                        error("Simulated transaction write failure.")
                    }
                    return transactionDelegate.save(transaction)
                }

                override suspend fun delete(id: UUID): Boolean = transactionDelegate.delete(id)

                override suspend fun deleteAll() = transactionDelegate.deleteAll()
            }
            val portfolioTargetRepository = JdbcPortfolioTargetRepository(connectionManager)
            val transactionImportProfileRepository = JdbcTransactionImportProfileRepository(connectionManager, Json.Default)
            val transferService = PortfolioTransferService(
                accountRepository = accountRepository,
                appPreferenceRepository = appPreferenceRepository,
                instrumentRepository = instrumentRepository,
                portfolioTargetRepository = portfolioTargetRepository,
                transactionRepository = transactionRepository,
                transactionImportProfileRepository = transactionImportProfileRepository,
                transactionRunner = connectionManager,
                auditLogService = AuditLogService(InMemoryAuditEventRepository(), Clock.systemUTC()),
                clock = Clock.systemUTC()
            )

            val existingAccount = account()
            val existingInstrument = edoInstrument()
            val existingTransaction = buyTransaction(existingAccount.id, existingInstrument.id)

            accountRepository.save(existingAccount)
            instrumentRepository.save(existingInstrument)
            transactionDelegate.save(existingTransaction)

            val importRequest = PortfolioImportRequest(
                mode = ImportMode.REPLACE,
                snapshot = PortfolioSnapshot(
                    schemaVersion = 4,
                    exportedAt = Instant.parse("2026-03-20T12:00:00Z"),
                    accounts = listOf(
                        AccountSnapshot(
                            id = "21000000-0000-0000-0000-000000000001",
                            name = "Imported account",
                            institution = "Imported broker",
                            type = "BROKERAGE",
                            baseCurrency = "PLN",
                            displayOrder = 0,
                            isActive = true,
                            createdAt = "2026-03-20T12:00:00Z",
                            updatedAt = "2026-03-20T12:00:00Z"
                        )
                    ),
                    appPreferences = emptyList(),
                    instruments = listOf(
                        InstrumentSnapshot(
                            id = "31000000-0000-0000-0000-000000000001",
                            name = "Imported ETF",
                            kind = "ETF",
                            assetClass = "EQUITIES",
                            symbol = "VWRA.L",
                            currency = "USD",
                            valuationSource = "STOCK_ANALYST",
                            edoTerms = null,
                            isActive = true,
                            createdAt = "2026-03-20T12:00:00Z",
                            updatedAt = "2026-03-20T12:00:00Z"
                        )
                    ),
                    targets = emptyList(),
                    importProfiles = emptyList(),
                    transactions = listOf(
                        TransactionSnapshot(
                            id = "41000000-0000-0000-0000-000000000001",
                            accountId = "21000000-0000-0000-0000-000000000001",
                            instrumentId = null,
                            type = "DEPOSIT",
                            tradeDate = "2026-03-20",
                            settlementDate = "2026-03-20",
                            quantity = null,
                            unitPrice = null,
                            grossAmount = "1000.00",
                            feeAmount = "0.00",
                            taxAmount = "0.00",
                            currency = "PLN",
                            fxRateToPln = null,
                            notes = "",
                            createdAt = "2026-03-20T12:00:00Z",
                            updatedAt = "2026-03-20T12:00:00Z"
                        ),
                        TransactionSnapshot(
                            id = failingTransactionId.toString(),
                            accountId = "21000000-0000-0000-0000-000000000001",
                            instrumentId = "31000000-0000-0000-0000-000000000001",
                            type = "BUY",
                            tradeDate = "2026-03-21",
                            settlementDate = "2026-03-21",
                            quantity = "2",
                            unitPrice = "100.00",
                            grossAmount = "200.00",
                            feeAmount = "0.00",
                            taxAmount = "0.00",
                            currency = "USD",
                            fxRateToPln = "3.9500",
                            notes = "",
                            createdAt = "2026-03-21T12:00:00Z",
                            updatedAt = "2026-03-21T12:00:00Z"
                        )
                    )
                )
            )

            var failure: IllegalStateException? = null
            try {
                transferService.importState(importRequest)
            } catch (exception: IllegalStateException) {
                failure = exception
            }
            assertEquals("Simulated transaction write failure.", failure?.message)

            assertEquals(listOf(existingAccount), accountRepository.list())
            assertEquals(existingInstrument, instrumentRepository.get(existingInstrument.id))
            assertEquals(existingTransaction, transactionDelegate.get(existingTransaction.id))
            assertNull(accountRepository.get(UUID.fromString("21000000-0000-0000-0000-000000000001")))
            assertNull(instrumentRepository.get(UUID.fromString("31000000-0000-0000-0000-000000000001")))
            assertNull(transactionDelegate.get(failingTransactionId))
        }
    }

    private fun sqliteDatabase(block: suspend (javax.sql.DataSource) -> Unit) {
        val directory = createTempDirectory("portfolio-sqlite-write-repositories-test")
        val databasePath = directory.resolve("portfolio.db")

        try {
            PersistenceResources(sqlitePersistenceConfig(databasePath.toString())).use { resources ->
                runBlocking {
                    block(resources.dataSource)
                }
            }
        } finally {
            (directory / "portfolio.db").deleteIfExists()
            (directory / "portfolio.db-shm").deleteIfExists()
            (directory / "portfolio.db-wal").deleteIfExists()
            directory.deleteIfExists()
        }
    }

    private fun sqlitePersistenceConfig(databasePath: String) = PersistenceConfig(
        databasePath = databasePath,
        journalMode = JournalMode.WAL,
        synchronousMode = SynchronousMode.FULL,
        busyTimeoutMs = 5_000
    )

    private fun account() = Account(
        id = UUID.fromString("20000000-0000-0000-0000-000000000001"),
        name = "Brokerage",
        institution = "Broker",
        type = AccountType.BROKERAGE,
        baseCurrency = "PLN",
        isActive = true,
        createdAt = Instant.parse("2025-03-01T12:00:00Z"),
        updatedAt = Instant.parse("2025-03-01T12:00:00Z")
    )

    private fun edoInstrument() = Instrument(
        id = UUID.fromString("30000000-0000-0000-0000-000000000001"),
        name = "EDO 2036/03",
        kind = InstrumentKind.BOND_EDO,
        assetClass = AssetClass.BONDS,
        symbol = null,
        currency = "PLN",
        valuationSource = ValuationSource.EDO_CALCULATOR,
        edoTerms = EdoTerms(
            seriesMonth = YearMonth.parse("2026-03"),
            firstPeriodRateBps = 270,
            marginBps = 150
        ),
        isActive = true,
        createdAt = Instant.parse("2026-03-01T12:00:00Z"),
        updatedAt = Instant.parse("2026-03-01T12:00:00Z")
    )

    private fun buyTransaction(accountId: UUID, instrumentId: UUID) = Transaction(
        id = UUID.fromString("40000000-0000-0000-0000-000000000001"),
        accountId = accountId,
        instrumentId = instrumentId,
        type = TransactionType.BUY,
        tradeDate = LocalDate.parse("2026-03-01"),
        settlementDate = LocalDate.parse("2026-03-03"),
        quantity = BigDecimal("10"),
        unitPrice = BigDecimal("100.00"),
        grossAmount = BigDecimal("1000.00"),
        feeAmount = BigDecimal("0.00"),
        taxAmount = BigDecimal("0.00"),
        currency = "PLN",
        fxRateToPln = null,
        notes = "Initial EDO purchase",
        createdAt = Instant.parse("2026-03-01T12:05:00Z"),
        updatedAt = Instant.parse("2026-03-01T12:05:00Z")
    )

    private fun redeemTransaction(accountId: UUID, instrumentId: UUID) = Transaction(
        id = UUID.fromString("40000000-0000-0000-0000-000000000002"),
        accountId = accountId,
        instrumentId = instrumentId,
        type = TransactionType.REDEEM,
        tradeDate = LocalDate.parse("2026-03-15"),
        settlementDate = LocalDate.parse("2026-03-15"),
        quantity = BigDecimal("4"),
        unitPrice = BigDecimal("101.50"),
        grossAmount = BigDecimal("406.00"),
        feeAmount = BigDecimal("0.00"),
        taxAmount = BigDecimal("6.50"),
        currency = "PLN",
        fxRateToPln = null,
        notes = "Maturity redemption",
        createdAt = Instant.parse("2026-03-15T12:05:00Z"),
        updatedAt = Instant.parse("2026-03-15T12:05:00Z")
    )

    private fun depositTransaction(id: UUID, accountId: UUID) = Transaction(
        id = id,
        accountId = accountId,
        instrumentId = null,
        type = TransactionType.DEPOSIT,
        tradeDate = LocalDate.parse("2026-03-15"),
        settlementDate = LocalDate.parse("2026-03-15"),
        quantity = null,
        unitPrice = null,
        grossAmount = BigDecimal("1000.00"),
        feeAmount = BigDecimal.ZERO,
        taxAmount = BigDecimal.ZERO,
        currency = "PLN",
        fxRateToPln = null,
        notes = "Concurrent deposit",
        createdAt = Instant.parse("2026-03-15T12:05:00Z"),
        updatedAt = Instant.parse("2026-03-15T12:05:00Z")
    )

    private fun portfolioTarget() = PortfolioTarget(
        id = UUID.fromString("50000000-0000-0000-0000-000000000001"),
        assetClass = AssetClass.BONDS,
        targetWeight = BigDecimal("0.20"),
        createdAt = Instant.parse("2026-03-01T12:10:00Z"),
        updatedAt = Instant.parse("2026-03-01T12:10:00Z")
    )
}
