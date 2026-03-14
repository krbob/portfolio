package net.bobinski.portfolio.api.plugins

import io.ktor.server.application.Application
import io.ktor.server.application.install
import net.bobinski.portfolio.api.auth.config.AuthConfig
import net.bobinski.portfolio.api.backup.config.BackupConfig
import net.bobinski.portfolio.api.dependency.RepositoryBindingMode
import net.bobinski.portfolio.api.persistence.config.PersistenceConfig
import net.bobinski.portfolio.api.dependency.appModule
import net.bobinski.portfolio.api.marketdata.config.MarketDataConfig
import org.koin.ktor.plugin.Koin

fun Application.configureDependencyInjection(
    repositoryBindingMode: RepositoryBindingMode = RepositoryBindingMode.SQLITE_RUNTIME
) {
    val persistenceConfig = PersistenceConfig.from(environment.config)
    val marketDataConfig = MarketDataConfig.from(environment.config)
    val backupConfig = BackupConfig.from(environment.config)
    val authConfig = AuthConfig.from(environment.config)
    validateStartupConfiguration(
        persistenceConfig = persistenceConfig,
        marketDataConfig = marketDataConfig,
        backupConfig = backupConfig,
        authConfig = authConfig
    )

    install(Koin) {
        modules(appModule(persistenceConfig, marketDataConfig, backupConfig, repositoryBindingMode))
    }
}
