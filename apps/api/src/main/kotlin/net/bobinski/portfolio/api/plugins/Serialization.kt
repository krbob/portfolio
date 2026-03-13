package net.bobinski.portfolio.api.plugins

import io.ktor.serialization.kotlinx.json.json
import io.ktor.server.application.Application
import io.ktor.server.application.install
import io.ktor.server.plugins.contentnegotiation.ContentNegotiation
import net.bobinski.portfolio.api.config.AppJsonFactory

fun Application.configureSerialization() {
    install(ContentNegotiation) {
        json(AppJsonFactory.create())
    }
}
