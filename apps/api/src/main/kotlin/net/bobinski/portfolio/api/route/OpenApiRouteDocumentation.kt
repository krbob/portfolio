package net.bobinski.portfolio.api.route

import io.ktor.openapi.Operation
import io.ktor.server.routing.Route
import io.ktor.server.routing.openapi.describe
import io.ktor.utils.io.ExperimentalKtorApi

@OptIn(ExperimentalKtorApi::class)
internal fun Route.documented(
    operationId: String,
    summary: String,
    description: String? = null,
    tag: String? = null,
    block: Operation.Builder.() -> Unit = {}
): Route = describe {
    this.operationId = operationId
    this.summary = summary
    if (description != null) {
        this.description = description
    }
    if (tag != null) {
        this.tag(tag)
    }
    block()
}
