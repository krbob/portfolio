package net.bobinski.portfolio.api.domain.service

import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import net.bobinski.portfolio.api.domain.model.Account
import net.bobinski.portfolio.api.domain.model.Instrument
import net.bobinski.portfolio.api.domain.model.PortfolioTarget
import net.bobinski.portfolio.api.domain.model.Transaction
import net.bobinski.portfolio.api.domain.repository.AccountRepository
import net.bobinski.portfolio.api.domain.repository.InstrumentRepository
import net.bobinski.portfolio.api.domain.repository.PortfolioTargetRepository
import net.bobinski.portfolio.api.domain.repository.TransactionRepository

class PortfolioReadModelCacheDescriptorService(
    private val accountRepository: AccountRepository,
    private val instrumentRepository: InstrumentRepository,
    private val portfolioTargetRepository: PortfolioTargetRepository,
    private val transactionRepository: TransactionRepository,
    private val clock: Clock
) {
    suspend fun dailyHistoryDescriptor(): ReadModelCacheDescriptor = descriptor(
        cacheKey = "portfolio.daily-history",
        modelName = "DAILY_HISTORY",
        modelVersion = 7
    )

    suspend fun returnsDescriptor(): ReadModelCacheDescriptor = descriptor(
        cacheKey = "portfolio.returns",
        modelName = "RETURNS",
        modelVersion = 4
    )

    private suspend fun descriptor(
        cacheKey: String,
        modelName: String,
        modelVersion: Int
    ): ReadModelCacheDescriptor {
        val accounts = accountRepository.list()
        val instruments = instrumentRepository.list()
        val targets = portfolioTargetRepository.list()
        val transactions = transactionRepository.list()
        val today = LocalDate.now(clock)

        return ReadModelCacheDescriptor(
            cacheKey = cacheKey,
            modelName = modelName,
            modelVersion = modelVersion,
            inputsFrom = transactions.minOfOrNull(Transaction::tradeDate) ?: today,
            inputsTo = today,
            sourceUpdatedAt = maxUpdatedAt(accounts, instruments, targets, transactions)
        )
    }

    private fun maxUpdatedAt(
        accounts: List<Account>,
        instruments: List<Instrument>,
        targets: List<PortfolioTarget>,
        transactions: List<Transaction>
    ): Instant? = listOfNotNull(
        accounts.maxOfOrNull(Account::updatedAt),
        instruments.maxOfOrNull(Instrument::updatedAt),
        targets.maxOfOrNull(PortfolioTarget::updatedAt),
        transactions.maxOfOrNull(Transaction::updatedAt)
    ).maxOrNull()
}
