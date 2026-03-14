package net.bobinski.portfolio.api.persistence.sqlite

import java.math.BigDecimal
import java.time.Instant
import java.time.LocalDate
import java.time.temporal.ChronoUnit
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
import net.bobinski.portfolio.api.persistence.config.PersistenceConfig
import net.bobinski.portfolio.api.persistence.config.PersistenceMode
import net.bobinski.portfolio.api.persistence.config.SqliteConfig
import net.bobinski.portfolio.api.persistence.config.SqliteJournalMode
import net.bobinski.portfolio.api.persistence.config.SqliteSynchronousMode
import net.bobinski.portfolio.api.persistence.db.PersistenceResources
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class SqliteWriteRepositoriesTest {

    @Test
    fun `sqlite write repositories persist accounts instruments transactions and targets`() = runBlocking {
        sqliteDatabase { dataSource ->
            val accountRepository = SqliteAccountRepository(dataSource)
            val instrumentRepository = SqliteInstrumentRepository(dataSource)
            val transactionRepository = SqliteTransactionRepository(dataSource)
            val portfolioTargetRepository = SqlitePortfolioTargetRepository(dataSource)

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
            val instrumentRepository = SqliteInstrumentRepository(dataSource)
            val initial = edoInstrument()
            val initialEdoTerms = requireNotNull(initial.edoTerms)
            val updated = initial.copy(
                name = "EDO 2036/03 updated",
                edoTerms = initialEdoTerms.copy(
                    marginBps = 180,
                    maturityDate = initialEdoTerms.maturityDate.plusDays(1)
                ),
                updatedAt = initial.updatedAt.plus(1, ChronoUnit.DAYS)
            )

            instrumentRepository.save(initial)
            instrumentRepository.save(updated)

            assertEquals(updated, instrumentRepository.get(updated.id))
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
        mode = PersistenceMode.SQLITE,
        jdbcUrl = "jdbc:postgresql://127.0.0.1:15432/portfolio",
        username = "portfolio",
        password = "portfolio",
        sqlite = SqliteConfig(
            databasePath = databasePath,
            journalMode = SqliteJournalMode.WAL,
            synchronousMode = SqliteSynchronousMode.FULL,
            busyTimeoutMs = 5_000
        )
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
            purchaseDate = LocalDate.parse("2026-03-01"),
            firstPeriodRateBps = 270,
            marginBps = 150,
            principalUnits = 10,
            maturityDate = LocalDate.parse("2036-03-01")
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

    private fun portfolioTarget() = PortfolioTarget(
        id = UUID.fromString("50000000-0000-0000-0000-000000000001"),
        assetClass = AssetClass.BONDS,
        targetWeight = BigDecimal("0.20"),
        createdAt = Instant.parse("2026-03-01T12:10:00Z"),
        updatedAt = Instant.parse("2026-03-01T12:10:00Z")
    )
}
