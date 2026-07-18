package net.bobinski.portfolio.api.domain.service

import java.math.BigDecimal
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import java.util.UUID
import kotlinx.coroutines.runBlocking
import net.bobinski.portfolio.api.config.AppJsonFactory
import net.bobinski.portfolio.api.domain.model.Account
import net.bobinski.portfolio.api.domain.model.AccountType
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryAccountRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryAppPreferenceRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryAuditEventRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class PortfolioWithdrawalSettingsServiceTest {
    private val clock = Clock.fixed(Instant.parse("2026-07-18T10:00:00Z"), ZoneOffset.UTC)

    @Test
    fun `defaults are conservative and include every account in repository order`() = runBlocking {
        val repository = InMemoryAccountRepository()
        repository.saveAll(listOf(brokerageAccount(), bondAccount(isActive = false)))
        val service = service(repository)

        val settings = service.settings()

        assertEquals(listOf(BROKERAGE_ACCOUNT_ID, BOND_ACCOUNT_ID), settings.accountRules.map { it.accountId })
        assertEquals(WithdrawalTaxWrapper.STANDARD, settings.accountRules[0].taxWrapper)
        assertTrue(settings.accountRules[0].enabled)
        assertEquals(BigDecimal("0.00"), settings.accountRules[0].taxBufferRatePct)
        assertEquals(WithdrawalTaxWrapper.NONE, settings.accountRules[1].taxWrapper)
        assertFalse(settings.accountRules[1].enabled)
    }

    @Test
    fun `saved priority and manual estimates survive while new accounts are appended`() = runBlocking {
        val repository = InMemoryAccountRepository()
        repository.saveAll(listOf(brokerageAccount(), bondAccount()))
        val service = service(repository)

        service.update(
            SaveWithdrawalPlanningSettingsCommand(
                accountRules = listOf(
                    WithdrawalPlanningAccountRule(
                        accountId = BOND_ACCOUNT_ID,
                        enabled = true,
                        taxWrapper = WithdrawalTaxWrapper.IKE,
                        taxBufferRatePct = BigDecimal("1.234")
                    ),
                    WithdrawalPlanningAccountRule(
                        accountId = BROKERAGE_ACCOUNT_ID,
                        enabled = false,
                        taxWrapper = WithdrawalTaxWrapper.OKI,
                        taxBufferRatePct = BigDecimal("0")
                    )
                )
            )
        )
        repository.save(cashAccount())

        val settings = service.settings()

        assertEquals(
            listOf(BOND_ACCOUNT_ID, BROKERAGE_ACCOUNT_ID, CASH_ACCOUNT_ID),
            settings.accountRules.map { it.accountId }
        )
        assertEquals(BigDecimal("1.23"), settings.accountRules[0].taxBufferRatePct)
        assertEquals(WithdrawalTaxWrapper.OKI, settings.accountRules[1].taxWrapper)
        assertFalse(settings.accountRules[1].enabled)
        assertEquals(WithdrawalTaxWrapper.NONE, settings.accountRules[2].taxWrapper)
    }

    @Test
    fun `saved enabled rule becomes disabled when its account becomes inactive`() = runBlocking {
        val repository = InMemoryAccountRepository()
        repository.save(bondAccount())
        val service = service(repository)
        service.update(
            SaveWithdrawalPlanningSettingsCommand(
                accountRules = listOf(
                    WithdrawalPlanningAccountRule(
                        accountId = BOND_ACCOUNT_ID,
                        enabled = true,
                        taxWrapper = WithdrawalTaxWrapper.NONE,
                        taxBufferRatePct = BigDecimal.ZERO
                    )
                )
            )
        )

        repository.save(bondAccount(isActive = false))

        assertFalse(service.settings().accountRules.single().enabled)
    }

    @Test
    fun `update normalizes an enabled rule for an inactive account to disabled`() = runBlocking {
        val repository = InMemoryAccountRepository()
        repository.save(bondAccount(isActive = false))
        val service = service(repository)

        val updated = service.update(
            SaveWithdrawalPlanningSettingsCommand(
                accountRules = listOf(
                    WithdrawalPlanningAccountRule(
                        accountId = BOND_ACCOUNT_ID,
                        enabled = true,
                        taxWrapper = WithdrawalTaxWrapper.NONE,
                        taxBufferRatePct = BigDecimal.ZERO
                    )
                )
            )
        )

        assertFalse(updated.accountRules.single().enabled)
        assertFalse(service.settings().accountRules.single().enabled)
    }

    @Test
    fun `update requires one valid rule per account`() = runBlocking {
        val repository = InMemoryAccountRepository()
        repository.save(brokerageAccount())
        val service = service(repository)

        assertThrows(IllegalArgumentException::class.java) {
            runBlocking {
                service.update(SaveWithdrawalPlanningSettingsCommand(accountRules = emptyList()))
            }
        }
        assertThrows(IllegalArgumentException::class.java) {
            runBlocking {
                service.update(
                    SaveWithdrawalPlanningSettingsCommand(
                        accountRules = listOf(
                            WithdrawalPlanningAccountRule(
                                accountId = BROKERAGE_ACCOUNT_ID,
                                enabled = true,
                                taxWrapper = WithdrawalTaxWrapper.STANDARD,
                                taxBufferRatePct = BigDecimal("100")
                            )
                        )
                    )
                )
            }
        }
    }

    private fun service(accountRepository: InMemoryAccountRepository): PortfolioWithdrawalSettingsService =
        PortfolioWithdrawalSettingsService(
            appPreferenceService = AppPreferenceService(
                repository = InMemoryAppPreferenceRepository(),
                json = AppJsonFactory.create(),
                clock = clock
            ),
            accountRepository = accountRepository,
            auditLogService = AuditLogService(InMemoryAuditEventRepository(), clock),
            clock = clock
        )

    private fun brokerageAccount() = account(
        id = BROKERAGE_ACCOUNT_ID,
        name = "Brokerage",
        type = AccountType.BROKERAGE,
        createdAt = Instant.parse("2026-01-01T00:00:00Z")
    )

    private fun bondAccount(isActive: Boolean = true) = account(
        id = BOND_ACCOUNT_ID,
        name = "Bonds",
        type = AccountType.BOND_REGISTER,
        createdAt = Instant.parse("2026-02-01T00:00:00Z"),
        isActive = isActive
    )

    private fun cashAccount() = account(
        id = CASH_ACCOUNT_ID,
        name = "Cash",
        type = AccountType.CASH,
        createdAt = Instant.parse("2026-03-01T00:00:00Z")
    )

    private fun account(
        id: UUID,
        name: String,
        type: AccountType,
        createdAt: Instant,
        isActive: Boolean = true
    ) = Account(
        id = id,
        name = name,
        institution = "Institution",
        type = type,
        baseCurrency = "PLN",
        isActive = isActive,
        createdAt = createdAt,
        updatedAt = createdAt
    )

    private companion object {
        val BROKERAGE_ACCOUNT_ID: UUID = UUID.fromString("10000000-0000-0000-0000-000000000001")
        val BOND_ACCOUNT_ID: UUID = UUID.fromString("10000000-0000-0000-0000-000000000002")
        val CASH_ACCOUNT_ID: UUID = UUID.fromString("10000000-0000-0000-0000-000000000003")
    }
}
