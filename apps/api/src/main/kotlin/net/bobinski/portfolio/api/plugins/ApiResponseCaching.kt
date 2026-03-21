package net.bobinski.portfolio.api.plugins

import io.ktor.http.HttpHeaders
import io.ktor.server.application.Application
import io.ktor.server.application.ApplicationCallPipeline
import io.ktor.server.application.call
import io.ktor.server.request.path

fun Application.configureApiResponseCaching() {
    intercept(ApplicationCallPipeline.Plugins) {
        if (call.request.path().startsWith("/v1/")) {
            call.response.headers.append(HttpHeaders.CacheControl, "no-store")
            call.response.headers.append(HttpHeaders.Pragma, "no-cache")
            call.response.headers.append(HttpHeaders.Expires, "0")
        }
        proceed()
    }
}
