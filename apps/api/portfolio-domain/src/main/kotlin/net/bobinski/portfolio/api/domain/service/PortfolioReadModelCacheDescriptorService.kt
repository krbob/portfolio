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
import net.bobinski.portfolio.api.marketdata.service.MarketDataSnapshotMetadata
import net.bobinski.portfolio.api.marketdata.service.MarketDataSnapshotPreferences

class PortfolioReadModelCacheDescriptorService(
    private val accountRepository: AccountRepository,
    private val appPreferenceRepository: AppPreferenceRepository,
    private val operationalStateService: OperationalStateService,
    private val instrumentRepository: InstrumentRepository,
    private val portfolioTargetRepository: PortfolioTargetRepository,
    private val transactionRepository: TransactionRepository,
    private val marketDataCacheFingerprint: String,
    private val clock: Clock
) {
    companion object {
        private const val FINGERPRINT_MODULUS = 100_000_000
    }

    suspend fun valuationDescriptor(): ReadModelCacheDescriptor = descriptor(
        cacheKey = "portfolio.valuation-snapshot",
        modelName = "VALUATION_SNAPSHOT",
        modelVersion = 1,
        includeTargets = false
    )

    suspend fun dailyHistoryDescriptor(): ReadModelCacheDescriptor = descriptor(
        cacheKey = "portfolio.daily-history",
        modelName = "DAILY_HISTORY",
        modelVersion = 10,
        preferenceUpdatedAt = preferenceUpdatedAt(PortfolioBenchmarkSettingsService.PREFERENCE_KEY)
    )

    suspend fun returnsDescriptor(): ReadModelCacheDescriptor = descriptor(
        cacheKey = "portfolio.returns",
        modelName = "RETURNS",
        modelVersion = 8,
        preferenceUpdatedAt = preferenceUpdatedAt(PortfolioBenchmarkSettingsService.PREFERENCE_KEY)
    )

    private suspend fun descriptor(
        cacheKey: String,
        modelName: String,
        modelVersion: Int,
        preferenceUpdatedAt: Instant? = null,
        includeTargets: Boolean = true,
        parameters: Map<String, String> = emptyMap()
    ): ReadModelCacheDescriptor {
        val accounts = accountRepository.list()
        val instruments = instrumentRepository.list()
        val targets = if (includeTargets) portfolioTargetRepository.list() else emptyList()
        val transactions = transactionRepository.list()
        val marketDataSnapshotUpdatedAt = marketDataSnapshotCanonicalUpdatedAt()
        val today = LocalDate.now(clock)
        val canonicalRevision = maxUpdatedAt(
            accounts = accounts,
            instruments = instruments,
            targets = targets,
            transactions = transactions,
            preferenceUpdatedAt = preferenceUpdatedAt
        )

        return ReadModelCacheDescriptor(
            cacheKey = cacheKey,
            modelName = modelName,
            modelVersion = cacheDescriptorVersion(modelVersion),
            inputsFrom = transactions.minOfOrNull(Transaction::tradeDate) ?: today,
            inputsTo = today,
            sourceUpdatedAt = listOfNotNull(canonicalRevision, marketDataSnapshotUpdatedAt).maxOrNull(),
            canonicalRevision = canonicalRevision,
            parameters = parameters.toSortedMap()
        )
    }

    private suspend fun preferenceUpdatedAt(key: String): Instant? = appPreferenceRepository.get(key)?.updatedAt

    private fun cacheDescriptorVersion(baseVersion: Int): Int =
        (baseVersion * FINGERPRINT_MODULUS) + marketDataFingerprint()

    private suspend fun marketDataSnapshotCanonicalUpdatedAt(): Instant? {
        val payloads = operationalStateService.listByPrefix(MarketDataSnapshotPreferences.PAYLOAD_KEY_PREFIX)
        if (payloads.isEmpty()) {
            return null
        }

        val metadataBySuffix = operationalStateService.listByPrefix(MarketDataSnapshotPreferences.METADATA_KEY_PREFIX)
            .associateBy(
                keySelector = { preference ->
                    preference.key.removePrefix(MarketDataSnapshotPreferences.METADATA_KEY_PREFIX)
                },
                valueTransform = { preference ->
                    operationalStateService.decodeOrNull(preference, MarketDataSnapshotMetadata.serializer())
                }
            )

        return payloads.asSequence()
            .mapNotNull { preference ->
                val suffix = preference.key.removePrefix(MarketDataSnapshotPreferences.PAYLOAD_KEY_PREFIX)
                metadataBySuffix[suffix]
                    ?.canonicalUpdatedAt
                    ?.let(Instant::parse)
                    ?: preference.updatedAt
            }
            .maxOrNull()
    }

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
