package net.bobinski.plugins

import io.ktor.http.ContentType
import io.ktor.http.withCharset
import io.ktor.serialization.kotlinx.json.json
import io.ktor.server.application.Application
import io.ktor.server.application.install
import io.ktor.server.plugins.contentnegotiation.ContentNegotiation

fun Application.configureJson() {
    install(ContentNegotiation) {
        json(contentType = ContentType.Application.Json.withCharset(Charsets.UTF_8))
    }
}