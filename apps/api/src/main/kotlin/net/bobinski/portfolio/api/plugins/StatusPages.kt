package net.bobinski.portfolio.api.plugins

import io.ktor.http.HttpStatusCode
import io.ktor.server.application.Application
import io.ktor.server.application.install
import io.ktor.server.application.log
import io.ktor.server.plugins.BadRequestException
import io.ktor.server.plugins.statuspages.StatusPages
import io.ktor.server.request.ContentTransformationException
import java.time.format.DateTimeParseException
import kotlinx.coroutines.CancellationException
import net.bobinski.portfolio.api.domain.error.ResourceNotFoundException
import net.bobinski.portfolio.api.notification.PortfolioAlertEvaluationException

fun Application.configureStatusPages() {
    install(StatusPages) {
        exception<NumberFormatException> { call, cause ->
            call.respondError(
                HttpStatusCode.BadRequest,
                cause.message ?: "Invalid number format.",
                ApiErrorCode.INVALID_REQUEST
            )
        }
        exception<DateTimeParseException> { call, cause ->
            call.respondError(
                HttpStatusCode.BadRequest,
                cause.message ?: "Invalid date format.",
                ApiErrorCode.INVALID_REQUEST
            )
        }
        exception<ContentTransformationException> { call, _ ->
            call.respondError(
                HttpStatusCode.BadRequest,
                "Malformed JSON request body.",
                ApiErrorCode.INVALID_REQUEST
            )
        }
        exception<BadRequestException> { call, cause ->
            call.respondError(
                HttpStatusCode.BadRequest,
                cause.message ?: "Bad request.",
                ApiErrorCode.INVALID_REQUEST
            )
        }
        exception<IllegalArgumentException> { call, cause ->
            call.respondError(
                HttpStatusCode.BadRequest,
                cause.message ?: "Bad request.",
                ApiErrorCode.INVALID_REQUEST
            )
        }
        exception<ResourceNotFoundException> { call, cause ->
            call.respondError(
                HttpStatusCode.NotFound,
                cause.message ?: "Not found.",
                ApiErrorCode.RESOURCE_NOT_FOUND
            )
        }
        exception<PortfolioAlertEvaluationException> { call, cause ->
            call.application.log.warn(cause.message, cause)
            call.respondError(
                HttpStatusCode.ServiceUnavailable,
                "Portfolio alerts could not be evaluated.",
                ApiErrorCode.ALERT_EVALUATION_FAILED,
                retryable = true
            )
        }
        status(HttpStatusCode.NotFound) { call, status ->
            call.respondError(status, "Route not found.", ApiErrorCode.ROUTE_NOT_FOUND)
        }
        status(HttpStatusCode.MethodNotAllowed) { call, status ->
            call.respondError(status, "Method not allowed.", ApiErrorCode.METHOD_NOT_ALLOWED)
        }
        exception<Exception> { call, cause ->
            if (cause is CancellationException) throw cause
            call.application.log.error("Unhandled application error.", cause)
            call.respondError(
                HttpStatusCode.InternalServerError,
                "Unexpected error occurred.",
                ApiErrorCode.INTERNAL_ERROR
            )
        }
    }
}

internal suspend fun io.ktor.server.application.ApplicationCall.respondUnauthorized(message: String) {
    respondError(
        HttpStatusCode.Unauthorized,
        message,
        ApiErrorCode.AUTHENTICATION_REQUIRED
    )
}
