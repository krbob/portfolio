package net.bobinski.portfolio.api.domain.service

import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.security.MessageDigest
import net.bobinski.portfolio.api.domain.model.Account
import net.bobinski.portfolio.api.domain.model.Instrument
import net.bobinski.portfolio.api.domain.model.PortfolioTarget
import net.bobinski.portfolio.api.domain.model.Transaction
import net.bobinski.portfolio.api.domain.repository.AccountRepository
import net.bobinski.portfolio.api.domain.repository.AppPreferenceRepository
import net.bobinski.portfolio.api.domain.repository.InstrumentRepository
import net.bobinski.portfolio.api.domain.repository.PortfolioTargetRepository
import net.bobinski.portfolio.api.domain.repository.TransactionRepository
import net.bobinski.portfolio.api.marketdata.service.MarketDataSnapshotPreferences

class PortfolioReadModelCacheDescriptorService(
    private val accountRepository: AccountRepository,
    private val appPreferenceRepository: AppPreferenceRepository,
    private val instrumentRepository: InstrumentRepository,
    private val portfolioTargetRepository: PortfolioTargetRepository,
    private val transactionRepository: TransactionRepository,
    private val marketDataCacheFingerprint: String,
    private val clock: Clock
) {
    companion object {
        private const val FINGERPRINT_MODULUS = 100_000_000
    }

    suspend fun dailyHistoryDescriptor(): ReadModelCacheDescriptor = descriptor(
        cacheKey = "portfolio.daily-history",
        modelName = "DAILY_HISTORY",
        modelVersion = 9
    )

    suspend fun returnsDescriptor(): ReadModelCacheDescriptor = descriptor(
        cacheKey = "portfolio.returns",
        modelName = "RETURNS",
        modelVersion = 6,
        preferenceUpdatedAt = appPreferenceRepository.get(PortfolioBenchmarkSettingsService.PREFERENCE_KEY)?.updatedAt
    )

    private suspend fun descriptor(
        cacheKey: String,
        modelName: String,
        modelVersion: Int,
        preferenceUpdatedAt: Instant? = null
    ): ReadModelCacheDescriptor {
        val accounts = accountRepository.list()
        val instruments = instrumentRepository.list()
        val targets = portfolioTargetRepository.list()
        val transactions = transactionRepository.list()
        val marketDataSnapshotUpdatedAt = appPreferenceRepository.list()
            .asSequence()
            .filter { preference -> preference.key.startsWith(MarketDataSnapshotPreferences.PREFERENCE_KEY_PREFIX) }
            .map { preference -> preference.updatedAt }
            .maxOrNull()
        val today = LocalDate.now(clock)

        return ReadModelCacheDescriptor(
            cacheKey = cacheKey,
            modelName = modelName,
            modelVersion = cacheDescriptorVersion(modelVersion),
            inputsFrom = transactions.minOfOrNull(Transaction::tradeDate) ?: today,
            inputsTo = today,
            sourceUpdatedAt = maxUpdatedAt(
                accounts,
                instruments,
                targets,
                transactions,
                preferenceUpdatedAt,
                marketDataSnapshotUpdatedAt
            )
        )
    }

    private fun cacheDescriptorVersion(baseVersion: Int): Int =
        (baseVersion * FINGERPRINT_MODULUS) + marketDataFingerprint()

    private fun marketDataFingerprint(): Int {
        val digest = MessageDigest.getInstance("SHA-256")
            .digest(marketDataCacheFingerprint.toByteArray(Charsets.UTF_8))
        val raw = ((digest[0].toInt() and 0xff) shl 24) or
            ((digest[1].toInt() and 0xff) shl 16) or
            ((digest[2].toInt() and 0xff) shl 8) or
            (digest[3].toInt() and 0xff)
        return raw and (FINGERPRINT_MODULUS - 1)
    }

    private fun maxUpdatedAt(
        accounts: List<Account>,
        instruments: List<Instrument>,
        targets: List<PortfolioTarget>,
        transactions: List<Transaction>,
        preferenceUpdatedAt: Instant? = null,
        marketDataSnapshotUpdatedAt: Instant? = null
    ): Instant? = listOfNotNull(
        accounts.maxOfOrNull(Account::updatedAt),
        instruments.maxOfOrNull(Instrument::updatedAt),
        targets.maxOfOrNull(PortfolioTarget::updatedAt),
        transactions.maxOfOrNull(Transaction::updatedAt),
        preferenceUpdatedAt,
        marketDataSnapshotUpdatedAt
    ).maxOrNull()
}
