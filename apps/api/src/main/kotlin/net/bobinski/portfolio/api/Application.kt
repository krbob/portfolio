package net.bobinski.portfolio.api

import io.ktor.server.application.Application
import net.bobinski.portfolio.api.plugins.configureDependencyInjection
import net.bobinski.portfolio.api.plugins.configureMonitoring
import net.bobinski.portfolio.api.plugins.configureRouting
import net.bobinski.portfolio.api.plugins.configureSerialization
import net.bobinski.portfolio.api.plugins.configureStatusPages

fun main(args: Array<String>) {
    io.ktor.server.netty.EngineMain.main(args)
}

fun Application.module() {
    configureDependencyInjection()
    configureMonitoring()
    configureStatusPages()
    configureSerialization()
    configureRouting()
}
