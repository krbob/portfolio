package net.bobinski.portfolio.api.dependency

import net.bobinski.portfolio.api.domain.repository.AccountRepository
import net.bobinski.portfolio.api.domain.repository.InstrumentRepository
import net.bobinski.portfolio.api.domain.repository.TransactionRepository
import net.bobinski.portfolio.api.domain.service.AccountService
import net.bobinski.portfolio.api.domain.service.InstrumentService
import net.bobinski.portfolio.api.domain.service.PortfolioReadModelService
import net.bobinski.portfolio.api.domain.service.TransactionService
import net.bobinski.portfolio.api.persistence.config.PersistenceConfig
import net.bobinski.portfolio.api.persistence.db.PersistenceResources
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryAccountRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryInstrumentRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryTransactionRepository
import net.bobinski.portfolio.api.persistence.jdbc.JdbcAccountRepository
import net.bobinski.portfolio.api.persistence.jdbc.JdbcInstrumentRepository
import net.bobinski.portfolio.api.persistence.jdbc.JdbcTransactionRepository
import org.koin.dsl.module
import java.time.Clock
import javax.sql.DataSource

fun appModule(config: PersistenceConfig) = module {
    single<Clock> { Clock.systemUTC() }
    single { config }

    if (config.isPostgresEnabled) {
        single(createdAtStart = true) { PersistenceResources(config) }
        single<DataSource> { get<PersistenceResources>().dataSource }
        single<AccountRepository> { JdbcAccountRepository(dataSource = get()) }
        single<InstrumentRepository> { JdbcInstrumentRepository(dataSource = get()) }
        single<TransactionRepository> { JdbcTransactionRepository(dataSource = get()) }
    } else {
        single<AccountRepository> { InMemoryAccountRepository() }
        single<InstrumentRepository> { InMemoryInstrumentRepository() }
        single<TransactionRepository> { InMemoryTransactionRepository() }
    }

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
    single {
        PortfolioReadModelService(
            accountRepository = get(),
            instrumentRepository = get(),
            transactionRepository = get(),
            clock = get()
        )
    }
}
