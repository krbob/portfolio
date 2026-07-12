package net.bobinski.portfolio.api.plugins

import io.ktor.http.HttpStatusCode
import io.ktor.server.application.ApplicationCall
import io.ktor.server.response.respond
import kotlinx.serialization.Serializable

internal suspend fun ApplicationCall.respondError(
    status: HttpStatusCode,
    error: String,
    errorCode: ApiErrorCode,
    retryable: Boolean = false
) {
    respond(
        status,
        ErrorResponse(
            error = error,
            errorCode = errorCode,
            retryable = retryable,
            requestId = requestId,
            message = error
        )
    )
}

@Serializable
data class ErrorResponse(
    val error: String,
    val errorCode: ApiErrorCode,
    val retryable: Boolean,
    val requestId: String,
    val message: String = error
)

@Serializable
enum class ApiErrorCode {
    INVALID_REQUEST,
    ROUTE_NOT_FOUND,
    METHOD_NOT_ALLOWED,
    RESOURCE_NOT_FOUND,
    AUTHENTICATION_REQUIRED,
    INVALID_CREDENTIALS,
    RATE_LIMITED,
    ALERT_EVALUATION_FAILED,
    INTERNAL_ERROR
}
