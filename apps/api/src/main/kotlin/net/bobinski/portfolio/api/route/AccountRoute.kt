package net.bobinski.portfolio.api.route

import io.ktor.http.HttpStatusCode
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.route
import kotlinx.serialization.Serializable
import net.bobinski.portfolio.api.domain.model.Account
import net.bobinski.portfolio.api.domain.model.AccountType
import net.bobinski.portfolio.api.domain.service.AccountService
import net.bobinski.portfolio.api.domain.service.CreateAccountCommand
import org.koin.ktor.ext.inject

fun Route.accountRoute() {
    val accountService: AccountService by inject()

    route("/v1/accounts") {
        get {
            call.respond(accountService.list().map { it.toResponse() })
        }

        post {
            val request = call.receive<CreateAccountRequest>()
            val account = accountService.create(
                CreateAccountCommand(
                    name = request.name,
                    institution = request.institution,
                    type = AccountType.valueOf(request.type),
                    baseCurrency = request.baseCurrency
                )
            )

            call.respond(HttpStatusCode.Created, account.toResponse())
        }
    }
}

@Serializable
data class CreateAccountRequest(
    val name: String,
    val institution: String,
    val type: String,
    val baseCurrency: String
)

@Serializable
data class AccountResponse(
    val id: String,
    val name: String,
    val institution: String,
    val type: String,
    val baseCurrency: String,
    val isActive: Boolean,
    val createdAt: String,
    val updatedAt: String
)

private fun Account.toResponse(): AccountResponse = AccountResponse(
    id = id.toString(),
    name = name,
    institution = institution,
    type = type.name,
    baseCurrency = baseCurrency,
    isActive = isActive,
    createdAt = createdAt.toString(),
    updatedAt = updatedAt.toString()
)
