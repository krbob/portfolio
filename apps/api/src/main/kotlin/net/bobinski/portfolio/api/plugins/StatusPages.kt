package net.bobinski.portfolio.api.plugins

import io.ktor.server.application.Application
import io.ktor.server.application.install
import io.ktor.server.plugins.BadRequestException
import io.ktor.server.plugins.statuspages.StatusPages
import io.ktor.server.request.ContentTransformationException
import io.ktor.server.response.respond
import io.ktor.http.HttpStatusCode
import kotlinx.serialization.Serializable
import net.bobinski.portfolio.api.domain.error.ResourceNotFoundException
import java.time.format.DateTimeParseException

fun Application.configureStatusPages() {
    install(StatusPages) {
        exception<IllegalArgumentException> { call, cause ->
            call.respond(HttpStatusCode.BadRequest, ErrorResponse(cause.message ?: "Bad request."))
        }
        exception<NumberFormatException> { call, cause ->
            call.respond(HttpStatusCode.BadRequest, ErrorResponse(cause.message ?: "Invalid number format."))
        }
        exception<DateTimeParseException> { call, cause ->
            call.respond(HttpStatusCode.BadRequest, ErrorResponse(cause.message ?: "Invalid date format."))
        }
        exception<BadRequestException> { call, cause ->
            call.respond(HttpStatusCode.BadRequest, ErrorResponse(cause.message ?: "Bad request."))
        }
        exception<ContentTransformationException> { call, _ ->
            call.respond(HttpStatusCode.BadRequest, ErrorResponse("Malformed JSON request body."))
        }
        exception<ResourceNotFoundException> { call, cause ->
            call.respond(HttpStatusCode.NotFound, ErrorResponse(cause.message ?: "Not found."))
        }
    }
}

internal suspend fun io.ktor.server.application.ApplicationCall.respondUnauthorized(message: String) {
    respond(HttpStatusCode.Unauthorized, ErrorResponse(message))
}

@Serializable
data class ErrorResponse(val message: String)
