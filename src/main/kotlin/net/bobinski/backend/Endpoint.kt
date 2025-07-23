package net.bobinski.backend

import io.ktor.http.HttpStatusCode
import io.ktor.server.response.respond
import io.ktor.server.response.respondText
import io.ktor.server.routing.Routing
import io.ktor.server.routing.get
import net.bobinski.Logger

enum class Endpoint(private val configuration: Routing.() -> Unit) {
    ANALYSIS({
        get("/analysis/{stock}") {
            try {
                val stock = checkNotNull(call.parameters["stock"])
                val conversion = call.request.queryParameters["conversion"]
                call.respond(AnalysisEndpoint.forStock(stock, conversion))
            } catch (e: IllegalStateException) {
                call.respondText(e.message.orEmpty(), status = HttpStatusCode.BadRequest)
            } catch (e: IllegalArgumentException) {
                call.respondText(e.message.orEmpty(), status = HttpStatusCode.NotFound)
            } catch (e: Exception) {
                Logger.get(ANALYSIS::class.java)
                    .error("InternalServerError exception: ${e.message}", e)
                call.respondText(e.message.orEmpty(), status = HttpStatusCode.InternalServerError)
            }
        }
    });

    operator fun invoke(routing: Routing) = routing.configuration()
}