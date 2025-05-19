package net.bobinski.plugins

import io.ktor.server.application.Application
import io.ktor.server.routing.routing
import net.bobinski.backend.Endpoint

fun Application.configureRouting() {
    routing {
        Endpoint.ANALYSIS(this)
        Endpoint.ANALYSIS_WITH_CONVERSION(this)
    }
}
