package net.bobinski.portfolio.api.plugins

import io.ktor.server.application.Application
import io.ktor.server.response.respondText
import io.ktor.server.routing.get
import io.ktor.server.routing.routing
import net.bobinski.portfolio.api.route.systemRoute

fun Application.configureRouting() {
    routing {
        get("/") {
            call.respondText("Portfolio API")
        }

        systemRoute(this@configureRouting)
    }
}
