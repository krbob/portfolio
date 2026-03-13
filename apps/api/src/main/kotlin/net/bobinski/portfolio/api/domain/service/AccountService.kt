package net.bobinski.portfolio.api.domain.service

import net.bobinski.portfolio.api.domain.model.Account
import net.bobinski.portfolio.api.domain.model.AccountType
import net.bobinski.portfolio.api.domain.repository.AccountRepository
import java.time.Clock
import java.time.Instant
import java.util.UUID

class AccountService(
    private val accountRepository: AccountRepository,
    private val clock: Clock
) {
    suspend fun list(): List<Account> = accountRepository.list()

    suspend fun create(command: CreateAccountCommand): Account {
        val now = Instant.now(clock)
        return accountRepository.save(
            Account(
                id = UUID.randomUUID(),
                name = command.name.trim(),
                institution = command.institution.trim(),
                type = command.type,
                baseCurrency = command.baseCurrency.uppercase(),
                isActive = true,
                createdAt = now,
                updatedAt = now
            )
        )
    }
}

data class CreateAccountCommand(
    val name: String,
    val institution: String,
    val type: AccountType,
    val baseCurrency: String
)
