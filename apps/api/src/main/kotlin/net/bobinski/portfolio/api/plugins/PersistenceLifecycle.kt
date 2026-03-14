package net.bobinski.portfolio.api.plugins

import io.ktor.server.application.Application
import io.ktor.server.application.ApplicationStopped
import net.bobinski.portfolio.api.persistence.db.PersistenceResources
import org.koin.ktor.ext.get
import org.slf4j.LoggerFactory

fun Application.configurePersistenceLifecycle() {
    val logger = LoggerFactory.getLogger("PersistenceLifecycle")

    monitor.subscribe(ApplicationStopped) {
        runCatching {
            get<PersistenceResources>().close()
        }.onFailure { exception ->
            logger.warn("Failed to close persistence resources cleanly.", exception)
        }
    }
}
