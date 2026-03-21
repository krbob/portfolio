package net.bobinski.portfolio.api

import io.ktor.server.application.Application
import net.bobinski.portfolio.api.dependency.RepositoryBindingMode
import net.bobinski.portfolio.api.plugins.configureBackupLifecycle
import net.bobinski.portfolio.api.plugins.configureAuthentication
import net.bobinski.portfolio.api.plugins.configureApiResponseCaching
import net.bobinski.portfolio.api.plugins.configureDependencyInjection
import net.bobinski.portfolio.api.plugins.configureMonitoring
import net.bobinski.portfolio.api.plugins.configurePersistenceLifecycle
import net.bobinski.portfolio.api.plugins.configureReadModelRefreshLifecycle
import net.bobinski.portfolio.api.plugins.configureRouting
import net.bobinski.portfolio.api.plugins.configureSerialization
import net.bobinski.portfolio.api.plugins.configureStatusPages

fun main(args: Array<String>) {
    io.ktor.server.netty.EngineMain.main(args)
}

fun Application.module() {
    runtimeModule()
}

internal fun Application.runtimeModule(
    repositoryBindingMode: RepositoryBindingMode = RepositoryBindingMode.SQLITE_RUNTIME
) {
    configureDependencyInjection(repositoryBindingMode)
    if (repositoryBindingMode == RepositoryBindingMode.SQLITE_RUNTIME) {
        configurePersistenceLifecycle()
    }
    configureBackupLifecycle()
    configureReadModelRefreshLifecycle()
    configureAuthentication()
    configureMonitoring()
    configureStatusPages()
    configureSerialization()
    configureApiResponseCaching()
    configureRouting()
}
