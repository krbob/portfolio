package net.bobinski.portfolio.api.dependency

import net.bobinski.portfolio.api.backup.config.BackupConfig
import net.bobinski.portfolio.api.config.AppJsonFactory
import net.bobinski.portfolio.api.domain.repository.AccountRepository
import net.bobinski.portfolio.api.domain.repository.InstrumentRepository
import net.bobinski.portfolio.api.domain.repository.TransactionRepository
import net.bobinski.portfolio.api.domain.service.AccountService
import net.bobinski.portfolio.api.domain.service.InstrumentService
import net.bobinski.portfolio.api.domain.service.PortfolioBackupService
import net.bobinski.portfolio.api.domain.service.PortfolioHistoryService
import net.bobinski.portfolio.api.domain.service.PortfolioReadModelService
import net.bobinski.portfolio.api.domain.service.PortfolioReturnsService
import net.bobinski.portfolio.api.domain.service.PortfolioTransferService
import net.bobinski.portfolio.api.domain.service.TransactionFxConversionService
import net.bobinski.portfolio.api.domain.service.TransactionService
import net.bobinski.portfolio.api.marketdata.client.EdoCalculatorClient
import net.bobinski.portfolio.api.marketdata.client.StockAnalystClient
import net.bobinski.portfolio.api.marketdata.config.MarketDataConfig
import net.bobinski.portfolio.api.marketdata.service.CurrentInstrumentValuationProvider
import net.bobinski.portfolio.api.marketdata.service.FxRateHistoryProvider
import net.bobinski.portfolio.api.marketdata.service.HistoricalInstrumentValuationProvider
import net.bobinski.portfolio.api.marketdata.service.InflationAdjustmentProvider
import net.bobinski.portfolio.api.marketdata.service.ReferenceSeriesProvider
import net.bobinski.portfolio.api.marketdata.service.RemoteHistoricalInstrumentValuationProvider
import net.bobinski.portfolio.api.marketdata.service.RemoteCurrentInstrumentValuationProvider
import net.bobinski.portfolio.api.marketdata.service.RemoteFxRateHistoryProvider
import net.bobinski.portfolio.api.marketdata.service.RemoteInflationAdjustmentProvider
import net.bobinski.portfolio.api.marketdata.service.RemoteReferenceSeriesProvider
import net.bobinski.portfolio.api.persistence.config.PersistenceConfig
import net.bobinski.portfolio.api.persistence.db.PersistenceResources
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryAccountRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryInstrumentRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryTransactionRepository
import net.bobinski.portfolio.api.persistence.jdbc.JdbcAccountRepository
import net.bobinski.portfolio.api.persistence.jdbc.JdbcInstrumentRepository
import net.bobinski.portfolio.api.persistence.jdbc.JdbcTransactionRepository
import java.net.http.HttpClient
import org.koin.dsl.module
import java.time.Clock
import javax.sql.DataSource
import kotlinx.serialization.json.Json

fun appModule(
    config: PersistenceConfig,
    marketDataConfig: MarketDataConfig,
    backupConfig: BackupConfig
) = module {
    single<Clock> { Clock.systemUTC() }
    single { config }
    single { marketDataConfig }
    single { backupConfig }
    single<Json> { AppJsonFactory.create() }
    single<HttpClient> { HttpClient.newBuilder().build() }
    single { StockAnalystClient(httpClient = get(), json = get(), baseUrl = marketDataConfig.stockAnalystBaseUrl) }
    single { EdoCalculatorClient(httpClient = get(), json = get(), baseUrl = marketDataConfig.edoCalculatorBaseUrl) }
    single<CurrentInstrumentValuationProvider> {
        RemoteCurrentInstrumentValuationProvider(
            config = get(),
            stockAnalystClient = get(),
            edoCalculatorClient = get()
        )
    }
    single<HistoricalInstrumentValuationProvider> {
        RemoteHistoricalInstrumentValuationProvider(
            config = get(),
            stockAnalystClient = get(),
            edoCalculatorClient = get()
        )
    }
    single<ReferenceSeriesProvider> {
        RemoteReferenceSeriesProvider(
            config = get(),
            stockAnalystClient = get()
        )
    }
    single<FxRateHistoryProvider> {
        RemoteFxRateHistoryProvider(
            config = get(),
            stockAnalystClient = get()
        )
    }
    single<InflationAdjustmentProvider> {
        RemoteInflationAdjustmentProvider(
            config = get(),
            edoCalculatorClient = get()
        )
    }
    single {
        TransactionFxConversionService(
            fxRateHistoryProvider = get()
        )
    }

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
            currentInstrumentValuationProvider = get(),
            transactionFxConversionService = get(),
            clock = get()
        )
    }
    single {
        PortfolioHistoryService(
            accountRepository = get(),
            instrumentRepository = get(),
            transactionRepository = get(),
            historicalInstrumentValuationProvider = get(),
            referenceSeriesProvider = get(),
            transactionFxConversionService = get(),
            clock = get()
        )
    }
    single {
        PortfolioReturnsService(
            transactionRepository = get(),
            portfolioHistoryService = get(),
            transactionFxConversionService = get(),
            referenceSeriesProvider = get(),
            inflationAdjustmentProvider = get(),
            clock = get()
        )
    }
    single {
        PortfolioTransferService(
            accountRepository = get(),
            instrumentRepository = get(),
            transactionRepository = get(),
            clock = get()
        )
    }
    single {
        PortfolioBackupService(
            config = get(),
            transferService = get(),
            json = get(),
            clock = get()
        )
    }
}
