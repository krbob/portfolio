package net.bobinski

import io.ktor.server.application.Application
import io.ktor.server.engine.embeddedServer
import io.ktor.server.netty.Netty
import net.bobinski.plugins.configureJson
import net.bobinski.plugins.configureLogging
import net.bobinski.plugins.configureRouting

fun main() {
    embeddedServer(
        factory = Netty,
        port = Config.PORT,
        host = "0.0.0.0",
        module = Application::module
    ).start(wait = true)
}

fun Application.module() {
    configureJson()
    configureRouting()
    configureLogging()
}
