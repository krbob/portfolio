package net.bobinski.portfolio.api

import io.ktor.server.application.Application
import net.bobinski.portfolio.api.plugins.configureMonitoring
import net.bobinski.portfolio.api.plugins.configureRouting
import net.bobinski.portfolio.api.plugins.configureSerialization

fun main(args: Array<String>) {
    io.ktor.server.netty.EngineMain.main(args)
}

fun Application.module() {
    configureMonitoring()
    configureSerialization()
    configureRouting()
}
