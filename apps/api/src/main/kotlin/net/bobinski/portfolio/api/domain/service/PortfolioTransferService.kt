package net.bobinski.portfolio.api.domain.service

import net.bobinski.portfolio.api.domain.model.Account
import net.bobinski.portfolio.api.domain.model.AccountType
import net.bobinski.portfolio.api.domain.model.AssetClass
import net.bobinski.portfolio.api.domain.model.EdoTerms
import net.bobinski.portfolio.api.domain.model.Instrument
import net.bobinski.portfolio.api.domain.model.InstrumentKind
import net.bobinski.portfolio.api.domain.model.Transaction
import net.bobinski.portfolio.api.domain.model.TransactionType
import net.bobinski.portfolio.api.domain.model.ValuationSource
import net.bobinski.portfolio.api.domain.repository.AccountRepository
import net.bobinski.portfolio.api.domain.repository.InstrumentRepository
import net.bobinski.portfolio.api.domain.repository.TransactionRepository
import java.math.BigDecimal
import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.util.UUID

class PortfolioTransferService(
    private val accountRepository: AccountRepository,
    private val instrumentRepository: InstrumentRepository,
    private val transactionRepository: TransactionRepository,
    private val clock: Clock
) {
    suspend fun exportState(): PortfolioSnapshot {
        val accounts = accountRepository.list().sortedBy(Account::createdAt)
        val instruments = instrumentRepository.list().sortedBy(Instrument::createdAt)
        val transactions = transactionRepository.list()
            .sortedWith(compareBy<Transaction>({ it.tradeDate }, { it.createdAt }))

        return PortfolioSnapshot(
            schemaVersion = SCHEMA_VERSION,
            exportedAt = Instant.now(clock),
            accounts = accounts.map { it.toSnapshot() },
            instruments = instruments.map { it.toSnapshot() },
            transactions = transactions.map { it.toSnapshot() }
        )
    }

    suspend fun importState(request: PortfolioImportRequest): PortfolioImportResult {
        require(request.snapshot.schemaVersion == SCHEMA_VERSION) {
            "Unsupported snapshot schema version ${request.snapshot.schemaVersion}."
        }

        if (request.mode == ImportMode.REPLACE) {
            transactionRepository.deleteAll()
            instrumentRepository.deleteAll()
            accountRepository.deleteAll()
        }

        val accounts = request.snapshot.accounts
            .sortedBy(AccountSnapshot::createdAt)
            .map { snapshot ->
                accountRepository.save(snapshot.toDomain())
            }
        val instruments = request.snapshot.instruments
            .sortedBy(InstrumentSnapshot::createdAt)
            .map { snapshot ->
                instrumentRepository.save(snapshot.toDomain())
            }
        val transactions = request.snapshot.transactions
            .sortedWith(compareBy<TransactionSnapshot>({ it.tradeDate }, { it.createdAt }))
            .map { snapshot ->
                transactionRepository.save(snapshot.toDomain())
            }

        return PortfolioImportResult(
            mode = request.mode,
            accountCount = accounts.size,
            instrumentCount = instruments.size,
            transactionCount = transactions.size
        )
    }

    private fun Account.toSnapshot(): AccountSnapshot = AccountSnapshot(
        id = id.toString(),
        name = name,
        institution = institution,
        type = type.name,
        baseCurrency = baseCurrency,
        isActive = isActive,
        createdAt = createdAt.toString(),
        updatedAt = updatedAt.toString()
    )

    private fun Instrument.toSnapshot(): InstrumentSnapshot = InstrumentSnapshot(
        id = id.toString(),
        name = name,
        kind = kind.name,
        assetClass = assetClass.name,
        symbol = symbol,
        currency = currency,
        valuationSource = valuationSource.name,
        edoTerms = edoTerms?.let { terms ->
            EdoTermsSnapshot(
                purchaseDate = terms.purchaseDate.toString(),
                firstPeriodRateBps = terms.firstPeriodRateBps,
                marginBps = terms.marginBps,
                principalUnits = terms.principalUnits,
                maturityDate = terms.maturityDate.toString()
            )
        },
        isActive = isActive,
        createdAt = createdAt.toString(),
        updatedAt = updatedAt.toString()
    )

    private fun Transaction.toSnapshot(): TransactionSnapshot = TransactionSnapshot(
        id = id.toString(),
        accountId = accountId.toString(),
        instrumentId = instrumentId?.toString(),
        type = type.name,
        tradeDate = tradeDate.toString(),
        settlementDate = settlementDate?.toString(),
        quantity = quantity?.toPlainString(),
        unitPrice = unitPrice?.toPlainString(),
        grossAmount = grossAmount.toPlainString(),
        feeAmount = feeAmount.toPlainString(),
        taxAmount = taxAmount.toPlainString(),
        currency = currency,
        fxRateToPln = fxRateToPln?.toPlainString(),
        notes = notes,
        createdAt = createdAt.toString(),
        updatedAt = updatedAt.toString()
    )

    private fun AccountSnapshot.toDomain(): Account = Account(
        id = UUID.fromString(id),
        name = name,
        institution = institution,
        type = AccountType.valueOf(type),
        baseCurrency = baseCurrency,
        isActive = isActive,
        createdAt = Instant.parse(createdAt),
        updatedAt = Instant.parse(updatedAt)
    )

    private fun InstrumentSnapshot.toDomain(): Instrument = Instrument(
        id = UUID.fromString(id),
        name = name,
        kind = InstrumentKind.valueOf(kind),
        assetClass = AssetClass.valueOf(assetClass),
        symbol = symbol,
        currency = currency,
        valuationSource = ValuationSource.valueOf(valuationSource),
        edoTerms = edoTerms?.toDomain(),
        isActive = isActive,
        createdAt = Instant.parse(createdAt),
        updatedAt = Instant.parse(updatedAt)
    )

    private fun EdoTermsSnapshot.toDomain(): EdoTerms = EdoTerms(
        purchaseDate = LocalDate.parse(purchaseDate),
        firstPeriodRateBps = firstPeriodRateBps,
        marginBps = marginBps,
        principalUnits = principalUnits,
        maturityDate = LocalDate.parse(maturityDate)
    )

    private fun TransactionSnapshot.toDomain(): Transaction = Transaction(
        id = UUID.fromString(id),
        accountId = UUID.fromString(accountId),
        instrumentId = instrumentId?.let(UUID::fromString),
        type = TransactionType.valueOf(type),
        tradeDate = LocalDate.parse(tradeDate),
        settlementDate = settlementDate?.let(LocalDate::parse),
        quantity = quantity?.toBigDecimalOrNull(),
        unitPrice = unitPrice?.toBigDecimalOrNull(),
        grossAmount = grossAmount.toBigDecimal(),
        feeAmount = feeAmount.toBigDecimal(),
        taxAmount = taxAmount.toBigDecimal(),
        currency = currency,
        fxRateToPln = fxRateToPln?.toBigDecimalOrNull(),
        notes = notes,
        createdAt = Instant.parse(createdAt),
        updatedAt = Instant.parse(updatedAt)
    )

    private companion object {
        const val SCHEMA_VERSION = 1
    }
}

data class PortfolioSnapshot(
    val schemaVersion: Int,
    val exportedAt: Instant,
    val accounts: List<AccountSnapshot>,
    val instruments: List<InstrumentSnapshot>,
    val transactions: List<TransactionSnapshot>
)

data class AccountSnapshot(
    val id: String,
    val name: String,
    val institution: String,
    val type: String,
    val baseCurrency: String,
    val isActive: Boolean,
    val createdAt: String,
    val updatedAt: String
)

data class InstrumentSnapshot(
    val id: String,
    val name: String,
    val kind: String,
    val assetClass: String,
    val symbol: String?,
    val currency: String,
    val valuationSource: String,
    val edoTerms: EdoTermsSnapshot?,
    val isActive: Boolean,
    val createdAt: String,
    val updatedAt: String
)

data class EdoTermsSnapshot(
    val purchaseDate: String,
    val firstPeriodRateBps: Int,
    val marginBps: Int,
    val principalUnits: Int,
    val maturityDate: String
)

data class TransactionSnapshot(
    val id: String,
    val accountId: String,
    val instrumentId: String?,
    val type: String,
    val tradeDate: String,
    val settlementDate: String?,
    val quantity: String?,
    val unitPrice: String?,
    val grossAmount: String,
    val feeAmount: String,
    val taxAmount: String,
    val currency: String,
    val fxRateToPln: String?,
    val notes: String,
    val createdAt: String,
    val updatedAt: String
)

data class PortfolioImportRequest(
    val mode: ImportMode,
    val snapshot: PortfolioSnapshot
)

data class PortfolioImportResult(
    val mode: ImportMode,
    val accountCount: Int,
    val instrumentCount: Int,
    val transactionCount: Int
)

enum class ImportMode {
    MERGE,
    REPLACE
}
