package net.bobinski.portfolio.api.plugins

import io.ktor.server.application.Application
import io.ktor.server.application.install
import net.bobinski.portfolio.api.auth.config.AuthConfig
import net.bobinski.portfolio.api.backup.config.BackupConfig
import net.bobinski.portfolio.api.dependency.RepositoryBindingMode
import net.bobinski.portfolio.api.persistence.config.PersistenceConfig
import net.bobinski.portfolio.api.dependency.appModule
import net.bobinski.portfolio.api.marketdata.config.MarketDataConfig
import net.bobinski.portfolio.api.marketdata.config.MarketDataRecheckConfig
import net.bobinski.portfolio.api.readmodel.config.ReadModelRefreshConfig
import org.koin.ktor.plugin.Koin

fun Application.configureDependencyInjection(
    repositoryBindingMode: RepositoryBindingMode = RepositoryBindingMode.SQLITE_RUNTIME
) {
    val persistenceConfig = PersistenceConfig.from(environment.config)
    val marketDataConfig = MarketDataConfig.from(environment.config)
    val marketDataRecheckConfig = MarketDataRecheckConfig.from(environment.config)
    val backupConfig = BackupConfig.from(environment.config)
    val readModelRefreshConfig = ReadModelRefreshConfig.from(environment.config)
    val authConfig = AuthConfig.from(environment.config)
    validateStartupConfiguration(
        persistenceConfig = persistenceConfig,
        marketDataConfig = marketDataConfig,
        marketDataRecheckConfig = marketDataRecheckConfig,
        backupConfig = backupConfig,
        readModelRefreshConfig = readModelRefreshConfig,
        authConfig = authConfig
    )

    install(Koin) {
        modules(
            appModule(
                config = persistenceConfig,
                marketDataConfig = marketDataConfig,
                marketDataRecheckConfig = marketDataRecheckConfig,
                backupConfig = backupConfig,
                readModelRefreshConfig = readModelRefreshConfig,
                authConfig = authConfig,
                repositoryBindingMode = repositoryBindingMode
            )
        )
    }
}
