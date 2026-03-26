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
}

data class CreateAccountCommand(
    val name: String,
    val institution: String,
    val type: AccountType,
    val baseCurrency: String
)
