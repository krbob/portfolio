package net.bobinski.portfolio.api.domain.service

import net.bobinski.portfolio.api.domain.model.AuditEventCategory
import net.bobinski.portfolio.api.domain.model.Account
import net.bobinski.portfolio.api.domain.model.AccountType
import net.bobinski.portfolio.api.domain.repository.AccountRepository
import java.time.Clock
import java.time.Instant
import java.util.UUID

class AccountService(
    private val accountRepository: AccountRepository,
    private val auditLogService: AuditLogService,
    private val clock: Clock
) {
    suspend fun list(): List<Account> = accountRepository.list()

    suspend fun create(command: CreateAccountCommand): Account {
        val now = Instant.now(clock)
        val nextDisplayOrder = accountRepository.list()
            .maxOfOrNull(Account::displayOrder)
            ?.plus(1)
            ?: 0
        val account = accountRepository.save(
            Account(
                id = UUID.randomUUID(),
                name = command.name.trim(),
                institution = command.institution.trim(),
                type = command.type,
                baseCurrency = command.baseCurrency.uppercase(),
                displayOrder = nextDisplayOrder,
                isActive = true,
                createdAt = now,
                updatedAt = now
            )
        )
        auditLogService.record(
            category = AuditEventCategory.ACCOUNTS,
            action = "ACCOUNT_CREATED",
            entityType = "ACCOUNT",
            entityId = account.id.toString(),
            message = "Created account ${account.name}.",
            metadata = mapOf(
                "institution" to account.institution,
                "type" to account.type.name,
                "baseCurrency" to account.baseCurrency,
                "displayOrder" to account.displayOrder.toString()
            )
        )
        return account
    }

    suspend fun reorder(command: ReorderAccountsCommand): List<Account> {
        val accounts = accountRepository.list()
        if (accounts.isEmpty()) {
            require(command.accountIds.isEmpty()) { "accountIds must be empty when no accounts exist." }
            return emptyList()
        }

        require(command.accountIds.isNotEmpty()) { "accountIds must not be empty." }
        require(command.accountIds.distinct().size == command.accountIds.size) {
            "accountIds must not contain duplicates."
        }

        val existingIds = accounts.map(Account::id)
        require(existingIds.size == command.accountIds.size && existingIds.toSet() == command.accountIds.toSet()) {
            "accountIds must contain every existing account exactly once."
        }

        val accountsById = accounts.associateBy(Account::id)
        val now = Instant.now(clock)
        val reorderedAccounts = command.accountIds.mapIndexed { index, accountId ->
            val account = accountsById.getValue(accountId)
            if (account.displayOrder == index) {
                account
            } else {
                account.copy(displayOrder = index, updatedAt = now)
            }
        }

        accountRepository.saveAll(reorderedAccounts)
        auditLogService.record(
            category = AuditEventCategory.ACCOUNTS,
            action = "ACCOUNT_ORDER_UPDATED",
            entityType = "ACCOUNT_COLLECTION",
            entityId = "ALL",
            message = "Updated account display order.",
            metadata = mapOf(
                "accountCount" to reorderedAccounts.size.toString(),
                "orderedAccountIds" to reorderedAccounts.joinToString(",") { it.id.toString() }
            )
        )
        return reorderedAccounts
    }
}

data class CreateAccountCommand(
    val name: String,
    val institution: String,
    val type: AccountType,
    val baseCurrency: String
)

data class ReorderAccountsCommand(
    val accountIds: List<UUID>
)
