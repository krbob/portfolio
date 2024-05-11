package net.bobinski.backend

import io.ktor.http.HttpStatusCode
import io.ktor.server.application.call
import io.ktor.server.response.respond
import io.ktor.server.response.respondText
import io.ktor.server.routing.Routing
import io.ktor.server.routing.get

enum class Endpoint(private val configuration: Routing.() -> Unit) {
    ANALYSIS({
        get("{stock?}") {
            val stock = call.parameters["stock"]!!
            try {
                call.respond(AnalysisEndpoint.forStock(stock))
            } catch (e: IllegalArgumentException) {
                call.respondText(e.message.orEmpty(), status = HttpStatusCode.NotFound)
            }
        }
    });

    operator fun invoke(routing: Routing) = routing.configuration()
}