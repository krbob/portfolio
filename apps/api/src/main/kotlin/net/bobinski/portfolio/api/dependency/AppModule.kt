package net.bobinski.portfolio.api.dependency

import net.bobinski.portfolio.api.domain.repository.AccountRepository
import net.bobinski.portfolio.api.domain.repository.InstrumentRepository
import net.bobinski.portfolio.api.domain.repository.TransactionRepository
import net.bobinski.portfolio.api.domain.service.AccountService
import net.bobinski.portfolio.api.domain.service.InstrumentService
import net.bobinski.portfolio.api.domain.service.TransactionService
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryAccountRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryInstrumentRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryTransactionRepository
import org.koin.dsl.module
import java.time.Clock

val appModule = module {
    single<Clock> { Clock.systemUTC() }

    single<AccountRepository> { InMemoryAccountRepository() }
    single<InstrumentRepository> { InMemoryInstrumentRepository() }
    single<TransactionRepository> { InMemoryTransactionRepository() }

    single { AccountService(accountRepository = get(), clock = get()) }
    single { InstrumentService(instrumentRepository = get(), clock = get()) }
    single {
        TransactionService(
            transactionRepository = get(),
            accountRepository = get(),
            instrumentRepository = get(),
            clock = get()
        )
    }
}
