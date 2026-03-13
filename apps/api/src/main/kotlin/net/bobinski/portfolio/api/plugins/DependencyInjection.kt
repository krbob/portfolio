package net.bobinski.portfolio.api.plugins

import io.ktor.server.application.Application
import io.ktor.server.application.install
import net.bobinski.portfolio.api.backup.config.BackupConfig
import net.bobinski.portfolio.api.marketdata.config.MarketDataConfig
import net.bobinski.portfolio.api.persistence.config.PersistenceConfig
import net.bobinski.portfolio.api.dependency.appModule
import org.koin.ktor.plugin.Koin

fun Application.configureDependencyInjection() {
    val persistenceConfig = PersistenceConfig.from(environment.config)
    val marketDataConfig = MarketDataConfig.from(environment.config)
    val backupConfig = BackupConfig.from(environment.config)

    install(Koin) {
        modules(appModule(persistenceConfig, marketDataConfig, backupConfig))
    }
}
