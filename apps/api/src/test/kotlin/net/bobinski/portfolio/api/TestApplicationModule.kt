package net.bobinski.portfolio.api

import io.ktor.server.application.Application

fun Application.module() {
    val method = Class.forName("net.bobinski.portfolio.api.ApplicationKt")
        .getDeclaredMethod("module", Application::class.java)
    method.invoke(null, this)
}
