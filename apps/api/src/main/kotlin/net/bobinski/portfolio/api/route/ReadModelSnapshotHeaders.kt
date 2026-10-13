package net.bobinski.portfolio.api.route

import io.ktor.openapi.Operation
import kotlin.reflect.typeOf
import io.ktor.server.application.ApplicationCall
import net.bobinski.portfolio.api.readmodel.ReadModelSnapshot

internal fun ApplicationCall.prefersCachedReadModel(): Boolean = request.queryParameters["preferCached"]?.let {
    requireNotNull(it.toBooleanStrictOrNull()) { "preferCached must be true or false." }
} ?: false

internal fun ApplicationCall.snapshotHeaders(snapshot: ReadModelSnapshot<*>) {
    response.headers.append("X-Read-Model-Generated-At", snapshot.generatedAt.toString())
    response.headers.append("X-Read-Model-From-Cache", snapshot.fromCache.toString())
    response.headers.append("X-Read-Model-Refresh-Required", snapshot.refreshRequired.toString())
    response.headers.append("X-Read-Model-Refresh-Failed", snapshot.refreshFailed.toString())
}

internal fun Operation.Builder.snapshotReadDocumentation() {
    parameters {
        query("preferCached") {
            description = "Return a complete compatible preview; follow refreshRequired with a live read. Defaults to false."
            required = false
            schema = buildSchema(typeOf<Boolean>())
        }
    }
    responses {
        response(200) {
            headers {
                header("X-Read-Model-Generated-At") {
                    description = "UTC generation time of the returned result, retained on fallback."
                    required = true
                    schema = buildSchema(typeOf<String>())
                }
                for (name in listOf("X-Read-Model-From-Cache", "X-Read-Model-Refresh-Required", "X-Read-Model-Refresh-Failed")) {
                    header(name) { required = true; schema = buildSchema(typeOf<Boolean>()) }
                }
            }
        }
    }
}
