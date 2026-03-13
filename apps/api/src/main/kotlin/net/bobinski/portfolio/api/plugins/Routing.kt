package net.bobinski.portfolio.api.plugins

import io.ktor.server.application.Application
import io.ktor.server.response.respondText
import io.ktor.server.routing.get
import io.ktor.server.routing.routing
import net.bobinski.portfolio.api.route.accountRoute
import net.bobinski.portfolio.api.route.instrumentRoute
import net.bobinski.portfolio.api.route.systemRoute
import net.bobinski.portfolio.api.route.transactionRoute

fun Application.configureRouting() {
    routing {
        get("/") {
            call.respondText("Portfolio API")
        }

        systemRoute(this@configureRouting)
        accountRoute()
        instrumentRoute()
        transactionRoute()
    }
}
