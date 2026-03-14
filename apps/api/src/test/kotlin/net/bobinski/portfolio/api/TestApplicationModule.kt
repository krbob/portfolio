package net.bobinski.portfolio.api

import io.ktor.server.application.Application
import net.bobinski.portfolio.api.dependency.RepositoryBindingMode

fun Application.module() {
    runtimeModule(RepositoryBindingMode.IN_MEMORY_TEST)
}
