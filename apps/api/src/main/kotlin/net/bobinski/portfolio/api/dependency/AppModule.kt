package net.bobinski.portfolio.api.dependency

import net.bobinski.portfolio.api.auth.config.AuthConfig
import net.bobinski.portfolio.api.backup.config.BackupConfig
import net.bobinski.portfolio.api.domain.repository.AppPreferenceRepository
import net.bobinski.portfolio.api.config.AppJsonFactory
import net.bobinski.portfolio.api.domain.repository.AccountRepository
import net.bobinski.portfolio.api.domain.repository.AuditEventRepository
import net.bobinski.portfolio.api.domain.repository.InstrumentRepository
import net.bobinski.portfolio.api.domain.repository.PortfolioTargetRepository
import net.bobinski.portfolio.api.domain.repository.ReadModelCacheRepository
import net.bobinski.portfolio.api.domain.repository.TransactionRepository
import net.bobinski.portfolio.api.domain.repository.TransactionImportProfileRepository
import net.bobinski.portfolio.api.domain.service.AccountService
import net.bobinski.portfolio.api.domain.service.AppPreferenceService
import net.bobinski.portfolio.api.domain.service.AuditLogService
import net.bobinski.portfolio.api.domain.service.InstrumentService
import net.bobinski.portfolio.api.domain.service.PortfolioAllocationService
import net.bobinski.portfolio.api.domain.service.PortfolioBackupService
import net.bobinski.portfolio.api.domain.service.PortfolioBenchmarkSettingsService
import net.bobinski.portfolio.api.domain.service.PortfolioHistoryService
import net.bobinski.portfolio.api.domain.service.PortfolioReadModelService
import net.bobinski.portfolio.api.domain.service.PortfolioReadModelCacheDescriptorService
import net.bobinski.portfolio.api.domain.service.PortfolioRebalancingSettingsService
import net.bobinski.portfolio.api.domain.service.PortfolioReturnsService
import net.bobinski.portfolio.api.domain.service.PortfolioTargetService
import net.bobinski.portfolio.api.domain.service.PortfolioTransferService
import net.bobinski.portfolio.api.domain.service.ReadModelCacheService
import net.bobinski.portfolio.api.domain.service.TransactionFxConversionService
import net.bobinski.portfolio.api.domain.service.TransactionCsvImportService
import net.bobinski.portfolio.api.domain.service.TransactionImportProfileService
import net.bobinski.portfolio.api.domain.service.TransactionService
import net.bobinski.portfolio.api.marketdata.client.EdoCalculatorClient
import net.bobinski.portfolio.api.marketdata.client.GoldApiClient
import net.bobinski.portfolio.api.marketdata.client.StockAnalystClient
import net.bobinski.portfolio.api.marketdata.config.MarketDataConfig
import net.bobinski.portfolio.api.marketdata.service.CurrentInstrumentValuationProvider
import net.bobinski.portfolio.api.marketdata.service.EdoLotValuationProvider
import net.bobinski.portfolio.api.marketdata.service.FxRateHistoryProvider
import net.bobinski.portfolio.api.marketdata.service.HistoricalInstrumentValuationProvider
import net.bobinski.portfolio.api.marketdata.service.InflationAdjustmentProvider
import net.bobinski.portfolio.api.marketdata.service.MarketDataFailureAuditService
import net.bobinski.portfolio.api.marketdata.service.ReferenceSeriesProvider
import net.bobinski.portfolio.api.marketdata.service.RemoteEdoLotValuationProvider
import net.bobinski.portfolio.api.marketdata.service.RemoteHistoricalInstrumentValuationProvider
import net.bobinski.portfolio.api.marketdata.service.RemoteCurrentInstrumentValuationProvider
import net.bobinski.portfolio.api.marketdata.service.RemoteFxRateHistoryProvider
import net.bobinski.portfolio.api.marketdata.service.RemoteInflationAdjustmentProvider
import net.bobinski.portfolio.api.marketdata.service.RemoteReferenceSeriesProvider
import net.bobinski.portfolio.api.marketdata.service.RemoteValuationProbeService
import net.bobinski.portfolio.api.domain.service.ValuationProbeService
import net.bobinski.portfolio.api.persistence.config.PersistenceConfig
import net.bobinski.portfolio.api.persistence.db.PersistenceResources
import net.bobinski.portfolio.api.readmodel.ReadModelRefreshService
import net.bobinski.portfolio.api.readmodel.config.ReadModelRefreshConfig
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryAuditEventRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryAccountRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryAppPreferenceRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryInstrumentRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryPortfolioTargetRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryReadModelCacheRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryTransactionRepository
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryTransactionImportProfileRepository
import net.bobinski.portfolio.api.persistence.jdbc.JdbcAuditEventRepository
import net.bobinski.portfolio.api.persistence.jdbc.JdbcAccountRepository
import net.bobinski.portfolio.api.persistence.jdbc.JdbcAppPreferenceRepository
import net.bobinski.portfolio.api.persistence.jdbc.JdbcInstrumentRepository
import net.bobinski.portfolio.api.persistence.jdbc.JdbcPortfolioTargetRepository
import net.bobinski.portfolio.api.persistence.jdbc.JdbcReadModelCacheRepository
import net.bobinski.portfolio.api.persistence.jdbc.JdbcTransactionRepository
import net.bobinski.portfolio.api.persistence.jdbc.JdbcTransactionImportProfileRepository
import net.bobinski.portfolio.api.system.SystemReadinessService
import java.net.http.HttpClient
import org.koin.dsl.module
import java.time.Clock
import javax.sql.DataSource
import kotlinx.serialization.json.Json

fun appModule(
    config: PersistenceConfig,
    marketDataConfig: MarketDataConfig,
    backupConfig: BackupConfig,
    readModelRefreshConfig: ReadModelRefreshConfig,
    authConfig: AuthConfig,
    repositoryBindingMode: RepositoryBindingMode = RepositoryBindingMode.SQLITE_RUNTIME
) = module {
    single<Clock> { Clock.systemUTC() }
    single { config }
    single { marketDataConfig }
    single { backupConfig }
    single { readModelRefreshConfig }
    single { authConfig }
    single<Json> { AppJsonFactory.create() }
    single<HttpClient> { HttpClient.newBuilder().build() }
    single { StockAnalystClient(httpClient = get(), json = get(), baseUrl = marketDataConfig.stockAnalystBaseUrl) }
    single { GoldApiClient(httpClient = get(), json = get(), baseUrl = marketDataConfig.goldApiBaseUrl) }
    single { EdoCalculatorClient(httpClient = get(), json = get(), baseUrl = marketDataConfig.edoCalculatorBaseUrl) }
    single<CurrentInstrumentValuationProvider> {
        RemoteCurrentInstrumentValuationProvider(
            config = get(),
            stockAnalystClient = get(),
            marketDataFailureAuditService = get()
        )
    }
    single<HistoricalInstrumentValuationProvider> {
        RemoteHistoricalInstrumentValuationProvider(
            config = get(),
            stockAnalystClient = get(),
            marketDataFailureAuditService = get()
        )
    }
    single<EdoLotValuationProvider> {
        RemoteEdoLotValuationProvider(
            config = get(),
            edoCalculatorClient = get(),
            marketDataFailureAuditService = get()
        )
    }
    single<ReferenceSeriesProvider> {
        RemoteReferenceSeriesProvider(
            config = get(),
            stockAnalystClient = get(),
            goldApiClient = get(),
            marketDataFailureAuditService = get()
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

    if (repositoryBindingMode == RepositoryBindingMode.SQLITE_RUNTIME) {
        single(createdAtStart = true) { PersistenceResources(config) }
        single<DataSource> { get<PersistenceResources>().dataSource }
        single<AppPreferenceRepository> { JdbcAppPreferenceRepository(dataSource = get()) }
        single<AuditEventRepository> { JdbcAuditEventRepository(dataSource = get(), json = get()) }
        single<AccountRepository> { JdbcAccountRepository(dataSource = get()) }
        single<InstrumentRepository> { JdbcInstrumentRepository(dataSource = get()) }
        single<PortfolioTargetRepository> { JdbcPortfolioTargetRepository(dataSource = get()) }
        single<ReadModelCacheRepository> { JdbcReadModelCacheRepository(dataSource = get()) }
        single<TransactionRepository> { JdbcTransactionRepository(dataSource = get()) }
        single<TransactionImportProfileRepository> { JdbcTransactionImportProfileRepository(dataSource = get(), json = get()) }
    } else {
        single<AppPreferenceRepository> { InMemoryAppPreferenceRepository() }
        single<AuditEventRepository> { InMemoryAuditEventRepository() }
        single<AccountRepository> { InMemoryAccountRepository() }
        single<InstrumentRepository> { InMemoryInstrumentRepository() }
        single<PortfolioTargetRepository> { InMemoryPortfolioTargetRepository() }
        single<ReadModelCacheRepository> { InMemoryReadModelCacheRepository() }
        single<TransactionRepository> { InMemoryTransactionRepository() }
        single<TransactionImportProfileRepository> { InMemoryTransactionImportProfileRepository() }
    }

    single { AppPreferenceService(repository = get(), json = get(), clock = get()) }
    single { ReadModelCacheService(repository = get(), json = get(), clock = get()) }
    single { AuditLogService(auditEventRepository = get(), clock = get()) }
    single { MarketDataFailureAuditService(auditLogService = get()) }
    single { AccountService(accountRepository = get(), auditLogService = get(), clock = get()) }
    if (repositoryBindingMode == RepositoryBindingMode.SQLITE_RUNTIME) {
        single<ValuationProbeService> {
            RemoteValuationProbeService(
                marketDataConfig = get(),
                stockAnalystClient = get()
            )
        }
    } else {
        single<ValuationProbeService> { object : ValuationProbeService {
            override suspend fun verifyStockAnalystSymbol(symbol: String) {}
        } }
    }
    single { InstrumentService(instrumentRepository = get(), auditLogService = get(), valuationProbeService = get(), clock = get()) }
    single {
        TransactionImportProfileService(
            repository = get(),
            accountRepository = get(),
            auditLogService = get(),
            clock = get()
        )
    }
    single {
        TransactionCsvImportService(
            profileRepository = get(),
            accountRepository = get(),
            instrumentRepository = get(),
            transactionService = get()
        )
    }
    single {
        TransactionService(
            transactionRepository = get(),
            accountRepository = get(),
            instrumentRepository = get(),
            auditLogService = get(),
            clock = get()
        )
    }
    single {
        PortfolioTargetService(
            portfolioTargetRepository = get(),
            clock = get()
        )
    }
    single {
        PortfolioBenchmarkSettingsService(
            appPreferenceService = get(),
            auditLogService = get(),
            clock = get()
        )
    }
    single {
        PortfolioRebalancingSettingsService(
            appPreferenceService = get(),
            auditLogService = get(),
            clock = get()
        )
    }
    single {
        PortfolioReadModelService(
            accountRepository = get(),
            instrumentRepository = get(),
            transactionRepository = get(),
            currentInstrumentValuationProvider = get(),
            edoLotValuationProvider = get(),
            transactionFxConversionService = get(),
            clock = get(),
            marketDataStaleAfterDays = marketDataConfig.staleAfterDays
        )
    }
    single {
        PortfolioReadModelCacheDescriptorService(
            accountRepository = get(),
            appPreferenceRepository = get(),
            instrumentRepository = get(),
            portfolioTargetRepository = get(),
            transactionRepository = get(),
            marketDataCacheFingerprint = listOf(
                marketDataConfig.enabled.toString(),
                marketDataConfig.stockAnalystBaseUrl,
                marketDataConfig.edoCalculatorBaseUrl,
                marketDataConfig.goldApiBaseUrl,
                marketDataConfig.goldApiKey.orEmpty(),
                marketDataConfig.staleAfterDays.toString(),
                marketDataConfig.usdPlnSymbol,
                marketDataConfig.goldBenchmarkSymbol,
                marketDataConfig.equityBenchmarkSymbol,
                marketDataConfig.bondBenchmarkSymbol
            ).joinToString(separator = "|"),
            clock = get()
        )
    }
    single {
        PortfolioAllocationService(
            portfolioTargetRepository = get(),
            portfolioReadModelService = get(),
            rebalancingSettingsService = get()
        )
    }
    single {
        PortfolioHistoryService(
            accountRepository = get(),
            instrumentRepository = get(),
            portfolioTargetRepository = get(),
            transactionRepository = get(),
            historicalInstrumentValuationProvider = get(),
            edoLotValuationProvider = get(),
            referenceSeriesProvider = get(),
            inflationAdjustmentProvider = get(),
            transactionFxConversionService = get(),
            benchmarkSettingsService = get(),
            clock = get(),
            marketDataStaleAfterDays = marketDataConfig.staleAfterDays
        )
    }
    single {
        PortfolioReturnsService(
            transactionRepository = get(),
            portfolioHistoryService = get(),
            transactionFxConversionService = get(),
            referenceSeriesProvider = get(),
            inflationAdjustmentProvider = get(),
            benchmarkSettingsService = get(),
            clock = get()
        )
    }
    single {
        PortfolioTransferService(
            accountRepository = get(),
            appPreferenceRepository = get(),
            instrumentRepository = get(),
            portfolioTargetRepository = get(),
            transactionRepository = get(),
            transactionImportProfileRepository = get(),
            auditLogService = get(),
            clock = get()
        )
    }
    single {
        PortfolioBackupService(
            config = get(),
            transferService = get(),
            auditLogService = get(),
            json = get(),
            clock = get()
        )
    }
    single {
        ReadModelRefreshService(
            config = get(),
            readModelCacheService = get(),
            descriptorService = get(),
            portfolioHistoryService = get(),
            portfolioReturnsService = get(),
            auditLogService = get(),
            clock = get()
        )
    }
    single {
        SystemReadinessService(
            persistenceConfig = get(),
            backupConfig = get(),
            marketDataConfig = get(),
            authConfig = get(),
            clock = get(),
            dataSource = if (repositoryBindingMode == RepositoryBindingMode.SQLITE_RUNTIME) get<DataSource>() else null,
            stockAnalystClient = get(),
            edoCalculatorClient = get(),
            goldApiClient = get()
        )
    }
}
