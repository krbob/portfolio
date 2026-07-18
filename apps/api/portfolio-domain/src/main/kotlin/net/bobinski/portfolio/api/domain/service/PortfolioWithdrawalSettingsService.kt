package net.bobinski.portfolio.api.domain.service

import java.math.BigDecimal
import java.math.RoundingMode
import java.time.Clock
import java.time.Instant
import java.util.UUID
import kotlinx.serialization.Serializable
import net.bobinski.portfolio.api.domain.model.Account
import net.bobinski.portfolio.api.domain.model.AccountType
import net.bobinski.portfolio.api.domain.model.AuditEventCategory
import net.bobinski.portfolio.api.domain.repository.AccountRepository

/**
 * Stores withdrawal-planning preferences independently from the canonical account ledger.
 *
 * Tax wrappers are labels and buffer rates are deliberately user supplied. This service does
 * not encode jurisdiction-specific tax rules or infer a wrapper from an account name.
 */
class PortfolioWithdrawalSettingsService(
    private val appPreferenceService: AppPreferenceService,
    private val accountRepository: AccountRepository,
    private val auditLogService: AuditLogService,
    private val clock: Clock
) {
    suspend fun settings(): WithdrawalPlanningSettings {
        val accounts = accountRepository.list()
        val stored = appPreferenceService.get(
            key = PREFERENCE_KEY,
            serializer = StoredWithdrawalPlanningSettings.serializer(),
            defaultValue = { StoredWithdrawalPlanningSettings() }
        )
        return normalize(stored, accounts)
    }

    suspend fun update(command: SaveWithdrawalPlanningSettingsCommand): WithdrawalPlanningSettings {
        val accounts = accountRepository.list()
        val accountsById = accounts.associateBy(Account::id)
        val accountIds = accountsById.keys
        require(command.accountRules.map(WithdrawalPlanningAccountRule::accountId).distinct().size == command.accountRules.size) {
            "Withdrawal account rules must contain unique account IDs."
        }
        require(command.accountRules.map(WithdrawalPlanningAccountRule::accountId).toSet() == accountIds) {
            "Withdrawal settings must contain exactly one rule for every account."
        }

        val normalizedRules = command.accountRules.map { rule ->
            rule.copy(
                enabled = rule.enabled && accountsById.getValue(rule.accountId).isActive,
                taxBufferRatePct = normalizeTaxBuffer(rule.taxBufferRatePct)
            )
        }
        val stored = StoredWithdrawalPlanningSettings(
            accountRules = normalizedRules.map { rule ->
                StoredWithdrawalPlanningAccountRule(
                    accountId = rule.accountId.toString(),
                    enabled = rule.enabled,
                    taxWrapper = rule.taxWrapper.name,
                    taxBufferRatePct = rule.taxBufferRatePct.toPlainString()
                )
            }
        )
        appPreferenceService.put(
            key = PREFERENCE_KEY,
            serializer = StoredWithdrawalPlanningSettings.serializer(),
            value = stored
        )
        auditLogService.record(
            category = AuditEventCategory.SYSTEM,
            action = "WITHDRAWAL_PLANNING_SETTINGS_UPDATED",
            entityType = "WITHDRAWAL_PLANNING_SETTINGS",
            message = "Updated withdrawal planning settings.",
            metadata = mapOf(
                "accountCount" to normalizedRules.size.toString(),
                "enabledAccountCount" to normalizedRules.count(WithdrawalPlanningAccountRule::enabled).toString(),
                "updatedAt" to Instant.now(clock).toString()
            )
        )
        return WithdrawalPlanningSettings(normalizedRules)
    }

    private fun normalize(
        stored: StoredWithdrawalPlanningSettings,
        accounts: List<Account>
    ): WithdrawalPlanningSettings {
        val accountsById = accounts.associateBy(Account::id)
        val storedRules = stored.accountRules.mapNotNull { rule ->
            val accountId = runCatching { UUID.fromString(rule.accountId) }.getOrNull() ?: return@mapNotNull null
            val account = accountsById[accountId] ?: return@mapNotNull null
            val taxWrapper = runCatching { WithdrawalTaxWrapper.valueOf(rule.taxWrapper) }.getOrNull()
                ?: return@mapNotNull null
            val taxBuffer = rule.taxBufferRatePct.toBigDecimalOrNull()
                ?.let(::normalizeStoredTaxBuffer)
                ?: return@mapNotNull null
            WithdrawalPlanningAccountRule(
                accountId = accountId,
                enabled = rule.enabled && account.isActive,
                taxWrapper = taxWrapper,
                taxBufferRatePct = taxBuffer
            )
        }.distinctBy(WithdrawalPlanningAccountRule::accountId)
        val configuredIds = storedRules.map(WithdrawalPlanningAccountRule::accountId).toSet()
        val newAccountRules = accounts
            .filterNot { account -> account.id in configuredIds }
            .map(::defaultRule)
        return WithdrawalPlanningSettings(storedRules + newAccountRules)
    }

    private fun defaultRule(account: Account): WithdrawalPlanningAccountRule = WithdrawalPlanningAccountRule(
        accountId = account.id,
        enabled = account.isActive,
        taxWrapper = when (account.type) {
            AccountType.BROKERAGE -> WithdrawalTaxWrapper.STANDARD
            AccountType.BOND_REGISTER, AccountType.CASH -> WithdrawalTaxWrapper.NONE
        },
        taxBufferRatePct = BigDecimal.ZERO.setScale(PERCENTAGE_SCALE)
    )

    private fun normalizeTaxBuffer(value: BigDecimal): BigDecimal {
        val normalized = value.setScale(PERCENTAGE_SCALE, RoundingMode.HALF_UP)
        require(normalized >= BigDecimal.ZERO && normalized < HUNDRED) {
            "Tax buffer rate must be at least zero and lower than 100 percent."
        }
        return normalized
    }

    private fun normalizeStoredTaxBuffer(value: BigDecimal): BigDecimal = value
        .coerceIn(BigDecimal.ZERO, MAX_STORED_TAX_BUFFER)
        .setScale(PERCENTAGE_SCALE, RoundingMode.HALF_UP)

    companion object {
        const val PREFERENCE_KEY = "portfolio.withdrawal-planning-settings"
        private const val PERCENTAGE_SCALE = 2
        private val HUNDRED = BigDecimal("100")
        private val MAX_STORED_TAX_BUFFER = BigDecimal("99.99")
    }
}

data class SaveWithdrawalPlanningSettingsCommand(
    val accountRules: List<WithdrawalPlanningAccountRule>
)

@Serializable
private data class StoredWithdrawalPlanningSettings(
    val accountRules: List<StoredWithdrawalPlanningAccountRule> = emptyList()
)

@Serializable
private data class StoredWithdrawalPlanningAccountRule(
    val accountId: String,
    val enabled: Boolean,
    val taxWrapper: String,
    val taxBufferRatePct: String
)

private fun BigDecimal.coerceIn(minimum: BigDecimal, maximum: BigDecimal): BigDecimal = when {
    this < minimum -> minimum
    this > maximum -> maximum
    else -> this
}
