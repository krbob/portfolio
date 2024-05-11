package net.bobinski.plugins

import io.ktor.server.application.*
import io.ktor.server.routing.*
import net.bobinski.backend.Endpoint

fun Application.configureRouting() {
    routing {
        Endpoint.ANALYSIS(this)
    }
}
