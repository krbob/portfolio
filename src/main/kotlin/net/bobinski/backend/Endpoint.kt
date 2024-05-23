package net.bobinski.backend

import io.ktor.http.HttpStatusCode
import io.ktor.server.application.call
import io.ktor.server.response.respond
import io.ktor.server.response.respondText
import io.ktor.server.routing.Routing
import io.ktor.server.routing.get

enum class Endpoint(private val configuration: Routing.() -> Unit) {
    ANALYSIS({
        get("/analysis/{stock}") {
            try {
                val stock = checkNotNull(call.parameters["stock"])
                call.respond(AnalysisEndpoint.forStock(stock))
            } catch (e: IllegalStateException) {
                call.respondText(e.message.orEmpty(), status = HttpStatusCode.BadRequest)
            } catch (e: IllegalArgumentException) {
                call.respondText(e.message.orEmpty(), status = HttpStatusCode.NotFound)
            } catch (e: Exception) {
                call.respondText(e.message.orEmpty(), status = HttpStatusCode.InternalServerError)
            }
        }
    });

    operator fun invoke(routing: Routing) = routing.configuration()
}